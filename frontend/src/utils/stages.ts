import { JobApplication, ApplicationStatus } from '../types';

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
// every status recorded in its history (old and new).
function statusesHeld(app: JobApplication): ApplicationStatus[] {
  const held: ApplicationStatus[] = [app.status];
  for (const h of app.history ?? []) {
    if (h.newStatus) held.push(h.newStatus as ApplicationStatus);
    if (h.oldStatus) held.push(h.oldStatus as ApplicationStatus);
  }
  return held;
}

// True if the application ever reached an interview stage, even if it has
// since been rejected, ghosted, or progressed to an offer. This is what the
// "interview rate" should measure — not just who is currently interviewing.
export function hasReachedInterview(app: JobApplication): boolean {
  return statusesHeld(app).some(s => REACHED_INTERVIEW.includes(s));
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
