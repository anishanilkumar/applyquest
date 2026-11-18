import { fitBand, K, oddsModel } from '../utils/odds';
import { ApplicationEffort, ApplicationStatus, JobApplication } from '../types';

let n = 0;
function app(status: ApplicationStatus, effort: ApplicationEffort, roleType: string, fitScore: number,
  path: ApplicationStatus[] = []): JobApplication {
  n += 1;
  const history = path.slice(1).map((s, i) => ({
    id: `h${n}-${i}`, applicationId: `a${n}`, oldStatus: path[i], newStatus: s,
    changedAt: new Date(2026, 9, 1 + i).toISOString(),
  }));
  return { id: `a${n}`, status, effort, roleType, fitScore, history } as unknown as JobApplication;
}

const sent = (effort: ApplicationEffort, role: string, fit: number, interview = false) =>
  interview
    ? app('Phone Screen', effort, role, fit, ['Shortlisted', 'Applied', 'Replied', 'Phone Screen'])
    : app('Applied', effort, role, fit, ['Shortlisted', 'Applied']);

describe('fitBand', () => {
  it('uses the evaluation verdict bands', () => {
    expect([fitBand(80), fitBand(75), fitBand(60), fitBand(45), fitBand(10), fitBand(undefined)])
      .toEqual(['Strong (75+)', 'Strong (75+)', 'Good (60-74)', 'Moderate (45-59)', 'Weak (<45)', 'Unscored']);
  });
});

describe('oddsModel', () => {
  const history = [
    sent('Full', 'Backend', 80, true), sent('Full', 'Backend', 80),
    ...Array.from({ length: 8 }, () => sent('Generic', 'AI/ML', 50)),
  ];

  it('counts only sent applications in the base rate', () => {
    const drafts = [app('Shortlisted', 'Full', 'Backend', 80),
      app('Rejected', 'Generic', 'AI/ML', 50, ['Shortlisted', 'Rejected'])];
    const m = oddsModel([...history, ...drafts]);
    expect(m.base).toEqual({ interviews: 1, sent: 10, p: 0.1 });
  });

  it('shrinks each segment toward the base rate', () => {
    const m = oddsModel(history);
    const full = m.segments.find(s => s.kind === 'Tier' && s.name === 'Full')!;
    expect(full.p).toBeCloseTo((1 + K * 0.1) / (2 + K));
  });

  it('gives a draft the geometric mean of its three segment rates', () => {
    const m = oddsModel(history);
    const r = (1 + K * 0.1) / (2 + K);
    expect(m.p(app('Shortlisted', 'Full', 'Backend', 80))).toBeCloseTo(r);
    // A segment never seen falls back to the base rate.
    const draft = app('Shortlisted', 'Full', 'Data', 80);
    expect(m.p(draft)).toBeCloseTo(Math.cbrt(r * 0.1 * r));
    // Generic AI/ML has no interviews, so it ranks below Full Backend.
    expect(m.p(app('Shortlisted', 'Generic', 'AI/ML', 50))).toBeLessThan(m.p(draft));
  });

  it('is zero with no track record', () => {
    expect(oddsModel([]).p(app('Shortlisted', 'Full', 'Backend', 80))).toBe(0);
  });
});
