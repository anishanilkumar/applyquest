import { betaCdf, betaQuantile, DECAY, fitBand, K, oddsModel, replyDelays, waiting } from '../utils/odds';
import { ApplicationEffort, ApplicationStatus, JobApplication } from '../types';

// These mirror backend/tests/test_odds.py — the two must agree.

const NOW = new Date(Date.UTC(2026, 10, 19, 12));
const DAY = 86400000;

let n = 0;
function app(status: ApplicationStatus, effort: ApplicationEffort = 'Full', roleType = 'Backend', fitScore = 80,
  daysAgo = 0, path: ApplicationStatus[] = [], replyAfter?: number): JobApplication {
  n += 1;
  const sent = NOW.getTime() - daysAgo * DAY;
  const history = path.slice(1).map((s, i) => ({
    id: `h${n}-${i}`, applicationId: `a${n}`, oldStatus: path[i], newStatus: s,
    changedAt: new Date(sent + ((replyAfter ?? 1) + i) * DAY).toISOString().slice(0, 19),
  }));
  return {
    id: `a${n}`, status, effort, roleType, fitScore, history,
    appliedDate: new Date(sent).toISOString().slice(0, 10),
  } as unknown as JobApplication;
}

const INTERVIEW: ApplicationStatus[] = ['Shortlisted', 'Applied', 'Replied', 'Phone Screen'];
const REJECTED: ApplicationStatus[] = ['Shortlisted', 'Applied', 'Rejected'];
const sent = (effort: ApplicationEffort, role: string, fit: number, interview = false, daysAgo = 0) =>
  interview ? app('Phone Screen', effort, role, fit, daysAgo, INTERVIEW) : app('Rejected', effort, role, fit, daysAgo, REJECTED);

const HISTORY = [sent('Full', 'Backend', 80, true), sent('Full', 'Backend', 80),
  ...Array.from({ length: 8 }, () => sent('Generic', 'AI/ML', 50))];

it('fitBand uses the evaluation verdict bands', () => {
  expect([fitBand(80), fitBand(75), fitBand(60), fitBand(45), fitBand(10), fitBand(undefined)])
    .toEqual(['Strong (75+)', 'Strong (75+)', 'Good (60-74)', 'Moderate (45-59)', 'Weak (<45)', 'Unscored']);
});

it('matches closed forms and scipy for the Beta distribution', () => {
  expect(betaQuantile(0.3, 1, 1)).toBeCloseTo(0.3, 9);
  expect(betaQuantile(0.25, 2, 1)).toBeCloseTo(0.5, 9);
  expect(betaQuantile(0.5, 7, 7)).toBeCloseTo(0.5, 9);
  expect(betaCdf(0.2, 3, 40)).toBeCloseTo(0.994443827, 8);
  expect(betaQuantile(0.05, 11.33, 328.7)).toBeCloseTo(0.019038233, 8);
  expect(betaQuantile(0.95, 11.33, 328.7)).toBeCloseTo(0.050714908, 8);
});

it('counts only sent applications in the base rate', () => {
  const drafts = [app('Shortlisted'), app('Not Applying', 'Full', 'Backend', 80, 0, ['Shortlisted', 'Not Applying'])];
  const m = oddsModel([...HISTORY, ...drafts], NOW);
  expect([m.base.interviews, m.base.sent]).toEqual([1, 10]);
  expect(m.base.p).toBeCloseTo(0.1);
});

it('shrinks each segment toward the base rate', () => {
  const full = oddsModel(HISTORY, NOW).segments.find(s => s.kind === 'Tier' && s.name === 'Full')!;
  expect(full.p).toBeCloseTo((1 + K * 0.1) / (2 + K));
  expect(full.lo).toBeLessThan(full.p);
  expect(full.hi).toBeGreaterThan(full.p);
});

it('gives a draft the geometric mean of its three segments', () => {
  const m = oddsModel(HISTORY, NOW);
  const r = (1 + K * 0.1) / (2 + K);
  expect(m.p(app('Shortlisted'))).toBeCloseTo(r);
  const unseen = app('Shortlisted', 'Full', 'Data');
  expect(m.p(unseen)).toBeCloseTo(Math.cbrt(r * 0.1 * r));
  expect(m.p(app('Shortlisted', 'Generic', 'AI/ML', 50))).toBeLessThan(m.p(unseen));
});

it('is zero with no track record', () => {
  expect(oddsModel([], NOW).p(app('Shortlisted'))).toBe(0);
});

it('counts a fresh application as only part of a no', () => {
  const fresh = app('Applied', 'Full', 'Backend', 80, 7, ['Shortlisted', 'Applied']);
  const stale = app('Applied', 'Full', 'Backend', 80, 60, ['Shortlisted', 'Applied']);
  const ev = oddsModel([...HISTORY, fresh, stale], NOW).evidence;
  // HISTORY's one reply came a day after sending: G(7) = (1·1 + 5·7/42) / 6.
  expect(ev[ev.length - 2].f).toBeCloseTo((1 + (5 * 7) / 42) / 6);
  expect(ev[ev.length - 1].f).toBe(1);
  expect(oddsModel([...HISTORY, fresh], NOW).base.p).toBeGreaterThan(oddsModel([...HISTORY, stale], NOW).base.p);
});

it('blends reply delays with the ramp', () => {
  expect(waiting([])(21)).toBeCloseTo(0.5);
  expect(waiting([3, 5, 10, 12, 20])(10)).toBeCloseTo((5 * 3 / 5 + 5 * 10 / 42) / 10);
});

it('reads reply delays from history', () => {
  const apps = [app('Phone Screen', 'Full', 'Backend', 80, 30, INTERVIEW, 9), app('Rejected', 'Full', 'Backend', 80, 30, REJECTED)];
  expect(replyDelays(apps)).toEqual([10]);
});

it('lets older evidence fade', () => {
  const recent = oddsModel([...HISTORY.slice(1), sent('Full', 'Backend', 80, true, 0)], NOW);
  const old = oddsModel([...HISTORY.slice(1), sent('Full', 'Backend', 80, true, 70)], NOW);
  expect(recent.base.p).toBeGreaterThan(old.base.p);
  expect(old.evidence[old.evidence.length - 1].w).toBeCloseTo(DECAY ** 10);
});

it('lowers the chance as the silence grows', () => {
  const m = oddsModel(HISTORY, NOW);
  expect(m.stillAlive(0.05, 0)).toBeCloseTo(0.05);
  expect(m.stillAlive(0.05, 10)).toBeLessThan(0.05);
  expect(m.stillAlive(0.05, 60)).toBe(0);
});
