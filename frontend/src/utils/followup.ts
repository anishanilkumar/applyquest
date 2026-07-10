import { JobApplication, ApplicationStatus } from '../types';

export const DECISION_STALE_DAYS = 3;
const TERMINAL = new Set<ApplicationStatus>(['Rejected', 'Ghosted']);

export function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

export type FollowupClass = 'needs_followup' | 'awaiting_response' | 'needs_decision' | 'ok';

export function classifyApp(app: JobApplication): FollowupClass {
  if (!app.followupFlagged || TERMINAL.has(app.status)) return 'ok';
  if (app.followedUpAt) {
    const days = daysSince(app.followedUpAt);
    return days >= DECISION_STALE_DAYS ? 'needs_decision' : 'awaiting_response';
  }
  return 'needs_followup';
}

// Map each non-terminal status to its natural next stage
export const NEXT_STAGE: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  Shortlisted: 'Applied',
  Applied: 'Replied',
  Replied: 'Phone Screen',
  'Phone Screen': 'Technical Round 1',
  'Technical Round 1': 'Technical Round 2',
  'Technical Round 2': 'Final Round',
  'Final Round': 'Offer',
};
