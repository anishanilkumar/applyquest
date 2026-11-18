import { JobApplication } from '../types';
import { hasReachedInterview, isSubmitted } from './stages';

// P(interview) for a draft, from how earlier applications like it went.
//
// Each draft belongs to three segments: its effort tier, its role type and its
// fit band. A segment's rate is its interview count over its sent count,
// shrunk toward the overall rate p0 with K applications' worth of prior:
//   p̂ = (i + K·p0) / (n + K)
// and the draft's P is the geometric mean of its three p̂. Small segments stay
// near p0 instead of swinging to 0 or 0.5. A ranking signal, not a forecast.
export const K = 10;

export type SegmentKind = 'Tier' | 'Role' | 'Fit';

export interface Segment {
  kind: SegmentKind;
  name: string;
  interviews: number;
  sent: number;
  p: number;
}

export interface OddsModel {
  base: { interviews: number; sent: number; p: number };
  segments: Segment[];
  p: (app: JobApplication) => number;
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

export function oddsModel(applications: JobApplication[]): OddsModel {
  const sent = applications.filter(isSubmitted);
  const interviews = sent.filter(hasReachedInterview).length;
  const p0 = sent.length ? interviews / sent.length : 0;
  const shrink = (i: number, n: number) => (i + K * p0) / (n + K);

  const table = new Map<string, Segment>();
  for (const kind of Object.keys(KEYS) as SegmentKind[]) {
    for (const a of sent) {
      const name = KEYS[kind](a);
      const key = `${kind}:${name}`;
      const s = table.get(key) ?? { kind, name, interviews: 0, sent: 0, p: 0 };
      s.sent += 1;
      if (hasReachedInterview(a)) s.interviews += 1;
      table.set(key, s);
    }
  }
  table.forEach(s => { s.p = shrink(s.interviews, s.sent); });

  const p = (a: JobApplication) => {
    const parts = (Object.keys(KEYS) as SegmentKind[]).map(kind => table.get(`${kind}:${KEYS[kind](a)}`)?.p ?? p0);
    if (parts.some(x => x <= 0)) return 0;
    return Math.exp(parts.reduce((acc, x) => acc + Math.log(x), 0) / parts.length);
  };

  const segments = Array.from(table.values()).sort((a, b) => a.kind.localeCompare(b.kind) || b.sent - a.sent);
  return { base: { interviews, sent: sent.length, p: p0 }, segments, p };
}
