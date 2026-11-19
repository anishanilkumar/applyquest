import { JobApplication } from '../types';
import { hasPositiveResponse, hasReachedInterview, isSubmitted } from './stages';

// P(interview): a Beta-Binomial model of the track record. This mirrors the
// server's core/odds.py one for one, and __tests__/odds.test.ts mirrors
// tests/test_odds.py. Change both together. (Calibration lives only on the
// server, which stores the prediction made at sending.)
//
// Per segment s (effort tier, role type, fit band):
//   p_s ~ Beta(K·p0, K·(1 − p0))
//   p_s | data ~ Beta(K·p0 + Σ w·y, K·(1 − p0) + Σ w·f)
// y = 1 for an application that reached an interview. f = 1 for one closed
// without one, and G(t) for one still waiting t days after sending: the share
// of replies that would have arrived by now, so a fresh batch is only part of
// a "no". G blends the reply delays seen with a ramp over HORIZON_DAYS worth
// G_PRIOR observations. w = DECAY^(weeks since sent). A draft's P is the
// geometric mean of its three segment means: a ranking heuristic.
export const K = 10;
export const DECAY = 0.98;
export const HORIZON_DAYS = 42;
export const G_PRIOR = 5;
export const CREDIBLE = 0.9;

export type SegmentKind = 'Tier' | 'Role' | 'Fit';

export interface Segment {
  kind: SegmentKind | 'All';
  name: string;
  interviews: number;
  sent: number;
  alpha: number;
  beta: number;
  p: number;
  lo: number;
  hi: number;
}

export interface Evidence { app: JobApplication; y: number; f: number; w: number; ageDays: number }

export interface OddsModel {
  base: Segment;
  segments: Segment[];
  evidence: Evidence[];
  waiting: (t: number) => number;
  p: (app: JobApplication) => number;
  stillAlive: (p: number, ageDays: number) => number;
}

// The verdict bands of ai-job-search's job evaluation, as outcome_stats uses them.
export function fitBand(score?: number | null): string {
  if (score == null) return 'Unscored';
  if (score >= 75) return 'Strong (75+)';
  if (score >= 60) return 'Good (60-74)';
  if (score >= 45) return 'Moderate (45-59)';
  return 'Weak (<45)';
}

const KEYS: Record<SegmentKind, (a: JobApplication) => string> = {
  Tier: a => a.effort || 'Unknown',
  Role: a => a.roleType || 'Unknown',
  Fit: a => fitBand(a.fitScore),
};
const KINDS = Object.keys(KEYS) as SegmentKind[];

// --- The Beta distribution's quantile ----------------------------------------

// ln Γ(x), Lanczos (g = 7, n = 9): ample for the shapes here.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  const clamp = (v: number) => (Math.abs(v) > tiny ? v : tiny);
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 / clamp(1 - (qab * x) / qap);
  let h = d;
  for (let m = 1; m < 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 / clamp(1 + aa * d);
    c = clamp(1 + aa / c);
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 / clamp(1 + aa * d);
    c = clamp(1 + aa / c);
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return h;
}

export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(a, b, x)) / a;
  return 1 - (front * betacf(b, a, 1 - x)) / b;
}

export function betaQuantile(q: number, a: number, b: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- Reply delays and the censoring weight -----------------------------------

const POSITIVE = new Set(['Replied', 'Phone Screen', 'Technical Round 1', 'Technical Round 2', 'Final Round', 'Offer']);

// Calendar days between two YYYY-MM-DD dates (the server's history times are
// naive UTC, so their date part is the UTC date, as in odds.py).
const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export function replyDelays(sent: JobApplication[]): number[] {
  const out: number[] = [];
  for (const a of sent) {
    if (!a.appliedDate) continue;
    const hits = (a.history ?? []).filter(h => POSITIVE.has(h.newStatus) && h.changedAt).map(h => h.changedAt.slice(0, 10));
    if (hits.length && hasPositiveResponse(a)) {
      hits.sort();
      out.push(Math.max(0, daysBetween(a.appliedDate, hits[0])));
    }
  }
  return out.sort((x, y) => x - y);
}

export function waiting(delays: number[]): (t: number) => number {
  return (t: number) => {
    const ramp = Math.min(1, Math.max(0, t / HORIZON_DAYS));
    const m = delays.length;
    const seen = m ? delays.filter(d => d <= t).length / m : 0;
    return (m * seen + G_PRIOR * ramp) / (m + G_PRIOR);
  };
}

// --- The model ---------------------------------------------------------------

const PENDING = new Set(['Applied', 'Replied']);

function interval(a: number, b: number): [number, number] {
  if (a <= 0 || b <= 0) return [0, 0];
  const tail = (1 - CREDIBLE) / 2;
  return [betaQuantile(tail, a, b), betaQuantile(1 - tail, a, b)];
}

export function oddsModel(applications: JobApplication[], now: Date = new Date()): OddsModel {
  const today = now.toISOString().slice(0, 10);
  const sent = applications.filter(isSubmitted);
  const G = waiting(replyDelays(sent));

  const evidence: Evidence[] = sent.map(a => {
    const ageDays = a.appliedDate ? Math.max(0, daysBetween(a.appliedDate, today)) : 0;
    const w = DECAY ** (ageDays / 7);
    if (hasReachedInterview(a)) return { app: a, y: 1, f: 0, w, ageDays };
    if (PENDING.has(a.status)) return { app: a, y: 0, f: G(ageDays), w, ageDays };
    return { app: a, y: 0, f: 1, w, ageDays };
  });

  const succ = evidence.reduce((s, e) => s + e.w * e.y, 0);
  const trials = evidence.reduce((s, e) => s + e.w * (e.y + e.f), 0);
  const p0 = trials ? succ / trials : 0;

  const segment = (kind: Segment['kind'], name: string, rows: Evidence[]): Segment => {
    const alpha = K * p0 + rows.reduce((s, e) => s + e.w * e.y, 0);
    const beta = K * (1 - p0) + rows.reduce((s, e) => s + e.w * e.f, 0);
    const [lo, hi] = interval(alpha, beta);
    return {
      kind, name, interviews: rows.reduce((s, e) => s + e.y, 0), sent: rows.length,
      alpha, beta, p: alpha > 0 ? alpha / (alpha + beta) : 0, lo, hi,
    };
  };

  const base = segment('All', 'All', evidence);
  const groups = new Map<string, { kind: SegmentKind; name: string; rows: Evidence[] }>();
  for (const kind of KINDS) {
    for (const e of evidence) {
      const name = KEYS[kind](e.app);
      const key = `${kind}:${name}`;
      const g = groups.get(key) ?? { kind, name, rows: [] };
      g.rows.push(e);
      groups.set(key, g);
    }
  }
  const table = new Map<string, Segment>();
  groups.forEach((g, key) => table.set(key, segment(g.kind, g.name, g.rows)));
  const segments = Array.from(table.values()).sort((a, b) => a.kind.localeCompare(b.kind) || b.sent - a.sent);

  const p = (a: JobApplication) => {
    const parts = KINDS.map(kind => table.get(`${kind}:${KEYS[kind](a)}`)?.p ?? base.p);
    if (parts.some(x => x <= 0)) return 0;
    return Math.exp(parts.reduce((acc, x) => acc + Math.log(x), 0) / parts.length);
  };

  // P(interview | no reply yet after ageDays), by Bayes' rule on G.
  const stillAlive = (q: number, ageDays: number) => {
    const g = G(ageDays);
    return q * g < 1 ? (q * (1 - g)) / (1 - q * g) : 0;
  };

  return { base, segments, evidence, waiting: G, p, stillAlive };
}
