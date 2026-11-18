import { JobApplication } from '../types';
import { effectiveHistory } from './stages';

// Where a draft stands in the apply queue. A draft waits in Shortlisted until it
// is sent (Shortlisted -> Applied) or set aside (Shortlisted -> Not Applying,
// never counted as sent; drafts set aside earlier went to Rejected). Sent and set-aside drafts stay on the page for
// a while after the move, so a batch can be worked through and reviewed.
export type QueueState = 'todo' | 'sent' | 'skip';

export const QUEUE_WINDOW_DAYS = 14;

export interface QueueEntry {
  app: JobApplication;
  state: QueueState;
  movedAt?: string; // when it left Shortlisted
}

export function queueEntry(app: JobApplication, now: Date = new Date()): QueueEntry | null {
  if (app.status === 'Shortlisted') return { app, state: 'todo' };
  const left = effectiveHistory(app).find(h => h.oldStatus === 'Shortlisted');
  if (!left) return null;
  const since = now.getTime() - QUEUE_WINDOW_DAYS * 86_400_000;
  if (new Date(left.changedAt).getTime() < since) return null;
  if (left.newStatus === 'Applied') return { app, state: 'sent', movedAt: left.changedAt };
  if ((left.newStatus === 'Not Applying' || left.newStatus === 'Rejected') && app.status === left.newStatus) {
    return { app, state: 'skip', movedAt: left.changedAt };
  }
  return null;
}

export function queueEntries(apps: JobApplication[], now: Date = new Date()): QueueEntry[] {
  return apps.map(a => queueEntry(a, now)).filter((e): e is QueueEntry => e !== null);
}
