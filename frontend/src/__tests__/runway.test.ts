import { chanceOfOffer, computeRunway, paceFor } from '../utils/runway';
import { ApplicationStatus, JobApplication } from '../types';

const NOW = new Date('2026-10-15T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

let id = 0;
function app(status: ApplicationStatus, appliedDaysAgo: number, path: ApplicationStatus[] = []): JobApplication {
  id += 1;
  const history = path.slice(1).map((s, i) => ({
    id: `h${id}-${i}`, applicationId: `a${id}`, oldStatus: path[i], newStatus: s,
    changedAt: new Date(NOW.getTime() - (appliedDaysAgo - i - 1) * 86_400_000).toISOString(),
  }));
  return { id: `a${id}`, status, appliedDate: daysAgo(appliedDaysAgo), history } as unknown as JobApplication;
}

const SETTINGS = { deadline: new Date('2027-03-31T00:00:00Z'), hiringWeeks: 6, paperworkWeeks: 4 };

describe('computeRunway', () => {
  it('works back from the deadline to the last useful application date', () => {
    const r = computeRunway([], SETTINGS, NOW);
    expect(r.offerBy.toISOString().slice(0, 10)).toBe('2027-03-03');
    expect(r.lastApplyBy.toISOString().slice(0, 10)).toBe('2027-01-20');
    expect(Math.round(r.weeksLeft)).toBe(14);
  });

  it('leaves out drafts and counts pace from the last four weeks', () => {
    const apps = [
      app('Shortlisted', 1),
      app('Applied', 3), app('Applied', 10), app('Rejected', 20), app('Ghosted', 60),
    ];
    const r = computeRunway(apps, SETTINGS, NOW);
    expect(r.stages[0].trials).toBe(4);
    expect(r.pacePerWeek).toBeCloseTo(3 / 4);
  });

  it('pulls stage rates towards the prior, and flags a stage with no offers yet', () => {
    const apps = [
      app('Rejected', 50, ['Applied', 'Phone Screen', 'Rejected']),
      ...Array.from({ length: 19 }, () => app('Rejected', 50)),
    ];
    const [reply, interview, offer] = computeRunway(apps, SETTINGS, NOW).stages;
    expect(reply.successes).toBe(1);
    expect(reply.rate).toBeCloseTo(2 / 40);
    expect(interview.successes).toBe(1);
    expect(offer.successes).toBe(0);
    expect(offer.rate).toBeCloseTo(1 / 6);
    expect(offer.assumed).toBe(true);
  });

  it('gives live interviews a better chance than fresh applications, and ignores stale ones', () => {
    const base = Array.from({ length: 40 }, () => app('Rejected', 80));
    const stale = computeRunway([...base, app('Applied', 70)], SETTINGS, NOW);
    expect(stale.inFlight).toBe(0);
    const fresh = computeRunway([...base, app('Applied', 5)], SETTINGS, NOW);
    const interviewing = computeRunway([...base, app('Phone Screen', 5, ['Applied', 'Replied', 'Phone Screen'])], SETTINGS, NOW);
    expect(interviewing.inFlightChance).toBeGreaterThan(fresh.inFlightChance);
  });

  it('scales the reply rate for the what-if lever', () => {
    const apps = Array.from({ length: 40 }, () => app('Rejected', 50));
    const base = computeRunway(apps, SETTINGS, NOW);
    const doubled = computeRunway(apps, SETTINGS, NOW, 2);
    expect(doubled.stages[0].rate).toBeCloseTo(base.stages[0].rate * 2);
    expect(doubled.applicationsPerOffer).toBeCloseTo(base.applicationsPerOffer / 2);
  });

  it('has no weeks left once the last useful date has passed', () => {
    const r = computeRunway([], { ...SETTINGS, deadline: new Date('2026-11-01T00:00:00Z') }, NOW);
    expect(r.weeksLeft).toBe(0);
  });
});

describe('chance and pace', () => {
  it('inverts: the pace for a target reproduces the target', () => {
    const p = 0.004, weeks = 14, inFlight = 0.05;
    const pace = paceFor(0.8, p, weeks, inFlight);
    expect(chanceOfOffer(p, pace * weeks, inFlight)).toBeCloseTo(0.8);
  });

  it('needs no pace when what is in flight already meets the target', () => {
    expect(paceFor(0.5, 0.01, 10, 0.6)).toBe(0);
  });
});
