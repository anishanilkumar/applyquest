import { byDay, countdown, isInProgress, upcomingInterviews, whenLabel } from '../utils/interviews';
import { Interview } from '../types';

const NOW = new Date(2026, 9, 15, 15, 0); // 15 Oct 2026, 15:00 local
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const iv = (id: string, startsAt: string, endsAt?: string): Interview =>
  ({ id, applicationId: 'a', startsAt, endsAt });

describe('interviews', () => {
  it('lists what is not over yet, soonest first, keeping one in progress', () => {
    const list = [iv('later', at(21, 19)), iv('past', at(14, 13, 30), at(14, 14)), iv('running', at(15, 14, 30), at(15, 15, 30)), iv('tomorrow', at(16, 16))];
    expect(upcomingInterviews(list, NOW).map(i => i.id)).toEqual(['running', 'tomorrow', 'later']);
    expect(isInProgress(list[2], NOW)).toBe(true);
  });

  it('treats an interview without an end as an hour long', () => {
    expect(upcomingInterviews([iv('x', at(15, 14, 30))], NOW)).toHaveLength(1);
    expect(upcomingInterviews([iv('x', at(15, 13, 30))], NOW)).toHaveLength(0);
  });

  it('labels days relative to today', () => {
    expect(whenLabel(iv('a', at(15, 18)), NOW)).toBe('Today 18:00');
    expect(whenLabel(iv('b', at(16, 16)), NOW)).toBe('Tomorrow 16:00');
    expect(whenLabel(iv('c', at(21, 19)), NOW)).toBe('Wed 21 Oct 19:00');
  });

  it('counts down in minutes, hours, then days', () => {
    expect(countdown(iv('a', at(15, 15, 25)), NOW)).toBe('in 25 min');
    expect(countdown(iv('b', at(16, 16)), NOW)).toBe('in 25 h');
    expect(countdown(iv('c', at(21, 19)), NOW)).toBe('in 6 days');
  });

  it('groups by local day in time order', () => {
    const days = byDay([iv('b', at(16, 16)), iv('a', at(16, 9)), iv('c', at(21, 19))]);
    expect(Array.from(days.keys())).toEqual(['2026-10-16', '2026-10-21']);
    expect(days.get('2026-10-16')!.map(i => i.id)).toEqual(['a', 'b']);
  });
});
