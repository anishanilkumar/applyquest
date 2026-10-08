import { JobApplication, ApplicationStatus, ApplicationHistory } from '../types';

// The forward pipeline, in order. Rejected and Ghosted sit outside it.
const PIPELINE: ApplicationStatus[] = [
  'Shortlisted',
  'Applied',
  'Replied',
  'Phone Screen',
  'Technical Round 1',
  'Technical Round 2',
  'Final Round',
  'Offer',
];

const CLOSED: ApplicationStatus[] = ['Rejected', 'Ghosted'];

// True for a move that rewrites where the application stands rather than
// advancing it: a step back to an earlier stage (correcting an application
// moved too far) or reopening a rejected/ghosted one.
function isRewind(h: ApplicationHistory): boolean {
  const from = h.oldStatus as ApplicationStatus | undefined;
  if (!from) return false;
  if (CLOSED.includes(from)) return PIPELINE.includes(h.newStatus);
  const fromIdx = PIPELINE.indexOf(from);
  const toIdx = PIPELINE.indexOf(h.newStatus);
  return fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx;
}

// The application's history with rewinds collapsed: the step a rewind undoes
// is dropped, so an application corrected back from Technical Round 2 never
// counts as having reached it, and a reopened one shows its live path without
// looping back on itself. Returned in chronological order.
export function effectiveHistory(app: JobApplication): ApplicationHistory[] {
  const sorted = [...(app.history ?? [])].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );
  const path: ApplicationHistory[] = [];
  for (const h of sorted) {
    if (!isRewind(h)) {
      path.push(h);
      continue;
    }
    const undone = path[path.length - 1]?.newStatus === h.oldStatus ? path.pop() : undefined;
    const from = path[path.length - 1]?.newStatus ?? undone?.oldStatus;
    if (from !== h.newStatus) {
      path.push({ ...h, oldStatus: from });
    }
  }
  return path;
}

// Statuses that represent an actual interview taking place.
export const INTERVIEW_STATUSES: ApplicationStatus[] = [
  'Phone Screen',
  'Technical Round 1',
  'Technical Round 2',
  'Final Round',
];

// Every status that proves the application reached (or moved past) the
// interview stage. Reaching an offer implies interviews happened.
const REACHED_INTERVIEW: ApplicationStatus[] = [...INTERVIEW_STATUSES, 'Offer'];

// Returns every status an application has held — its current status plus
// every status on its effective history (old and new), so stages a correction
// undid don't count.
function statusesHeld(app: JobApplication): ApplicationStatus[] {
  const held: ApplicationStatus[] = [app.status];
  for (const h of effectiveHistory(app)) {
    if (h.newStatus) held.push(h.newStatus as ApplicationStatus);
    if (h.oldStatus) held.push(h.oldStatus as ApplicationStatus);
  }
  return held;
}

// Statuses that count as a genuine, positive response from the company — a
// human actually engaged. A rejection is NOT a positive response (it's a "no"),
// and ghosting is silence; both are deliberately excluded. This is what the
// headline "response rate" should measure — see Analytics.tsx.
const POSITIVE_RESPONSE: ApplicationStatus[] = ['Replied', ...REACHED_INTERVIEW];

// True if the application ever reached an interview stage, even if it has
// since been rejected, ghosted, or progressed to an offer. This is what the
// "interview rate" should measure — not just who is currently interviewing.
export function hasReachedInterview(app: JobApplication): boolean {
  return statusesHeld(app).some(s => REACHED_INTERVIEW.includes(s));
}

// True if the application ever got a genuine response (a reply or further),
// excluding rejections and ghosting. Most job searches are dominated by
// rejections, so counting those as "responses" paints a misleadingly rosy
// picture — this is the honest signal of "did a human actually engage".
export function hasPositiveResponse(app: JobApplication): boolean {
  return statusesHeld(app).some(s => POSITIVE_RESPONSE.includes(s));
}

// True if the application ever reached the final round (or an offer).
export function hasReachedFinalRound(app: JobApplication): boolean {
  const held = statusesHeld(app);
  return held.includes('Final Round') || held.includes('Offer');
}

// True if the application ever received an offer.
export function hasReachedOffer(app: JobApplication): boolean {
  return statusesHeld(app).includes('Offer');
}
