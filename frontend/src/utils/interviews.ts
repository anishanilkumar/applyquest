import { Interview } from '../types';

const DAY = 86_400_000;
// An interview with no end time is treated as an hour long.
const DEFAULT_LENGTH = 60 * 60_000;

export const endOf = (i: Interview): number =>
  i.endsAt ? new Date(i.endsAt).getTime() : new Date(i.startsAt).getTime() + DEFAULT_LENGTH;

// Interviews not yet over — including one in progress — soonest first.
export const upcomingInterviews = (interviews: Interview[], now: Date = new Date()): Interview[] =>
  interviews
    .filter(i => endOf(i) > now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

export const isInProgress = (i: Interview, now: Date = new Date()): boolean =>
  new Date(i.startsAt).getTime() <= now.getTime() && now.getTime() < endOf(i);

// Local calendar-day key, e.g. "2026-10-16", for grouping and calendar cells.
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const byDay = (interviews: Interview[]): Map<string, Interview[]> => {
  const days = new Map<string, Interview[]>();
  [...interviews]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .forEach(i => {
      const key = dayKey(new Date(i.startsAt));
      days.set(key, [...(days.get(key) ?? []), i]);
    });
  return days;
};

const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// "Today 16:00", "Tomorrow 09:30", "Tue 21 Oct 19:00" — in the viewer's timezone.
export const whenLabel = (i: Interview, now: Date = new Date()): string => {
  const start = new Date(i.startsAt);
  const days = Math.round((new Date(dayKey(start)).getTime() - new Date(dayKey(now)).getTime()) / DAY);
  if (days === 0) return `Today ${time(start)}`;
  if (days === 1) return `Tomorrow ${time(start)}`;
  return `${start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time(start)}`;
};

// "in 25 min", "in 25 h", "in 6 days", or "now" while it runs. Hours up to
// two days out: "in 1 day" for tomorrow afternoon hides whether it's 20 h or 40.
export const countdown = (i: Interview, now: Date = new Date()): string => {
  if (isInProgress(i, now)) return 'now';
  const ms = new Date(i.startsAt).getTime() - now.getTime();
  if (ms < 60 * 60_000) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < 2 * DAY) return `in ${Math.round(ms / (60 * 60_000))} h`;
  const d = Math.round(ms / DAY);
  return `in ${d} day${d === 1 ? '' : 's'}`;
};
