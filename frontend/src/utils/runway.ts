import { ApplicationStatus, JobApplication } from '../types';
import { hasPositiveResponse, hasReachedInterview, hasReachedOffer, isSubmitted } from './stages';

// Runway: given the search deadline and the funnel's real conversion rates,
// how likely is an offer in time, and what would it take?
//
// Each stage rate is (successes + a) / (trials + a + b): the observed rate,
// pulled gently towards a prior. With hundreds of applications the prior on
// the reply rate barely moves it; with no offers yet, the interview -> offer
// prior is what keeps the estimate from reading as "never". Every prior is a
// stated assumption shown in the UI, and it fades as real outcomes arrive.
export const PRIORS = {
  reply: { a: 1, b: 19, note: 'about 1 in 20' },
  interview: { a: 1, b: 1, note: 'about 1 in 2' },
  offer: { a: 1, b: 4, note: 'about 1 in 5' },
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const PACE_WINDOW_DAYS = 28;

export interface Stage {
  label: string;
  successes: number;
  trials: number;
  rate: number;
  priorNote: string;
  // True while the prior outweighs the data, so the UI can flag the rate as
  // mostly assumption.
  assumed: boolean;
}

export interface RunwaySettings {
  deadline: Date;
  hiringWeeks: number;
  paperworkWeeks: number;
}

export interface Runway {
  offerBy: Date;
  lastApplyBy: Date;
  weeksLeft: number;
  stages: [Stage, Stage, Stage];
  offerPerApplication: number;
  applicationsPerOffer: number;
  pacePerWeek: number;
  inFlight: number;
  inFlightChance: number;
  projectedApplications: number;
  chance: number;
}

const stage = (label: string, successes: number, trials: number, prior: { a: number; b: number; note: string }): Stage => ({
  label,
  successes,
  trials,
  rate: (successes + prior.a) / (trials + prior.a + prior.b),
  priorNote: prior.note,
  assumed: trials < prior.a + prior.b,
});

const INTERVIEW_STAGES: ApplicationStatus[] = ['Phone Screen', 'Technical Round 1', 'Technical Round 2', 'Final Round'];

// Chance that n further independent applications, plus what is already in
// flight, produce at least one offer.
export const chanceOfOffer = (perApplication: number, n: number, inFlightChance: number): number =>
  1 - (1 - inFlightChance) * Math.pow(1 - perApplication, Math.max(0, n));

// Applications per week needed to reach `target` chance in `weeks`.
export const paceFor = (target: number, perApplication: number, weeks: number, inFlightChance: number): number => {
  if (inFlightChance >= target) return 0;
  if (weeks <= 0 || perApplication <= 0) return Infinity;
  const n = Math.log((1 - target) / (1 - inFlightChance)) / Math.log(1 - perApplication);
  return n / weeks;
};

export function computeRunway(
  applications: JobApplication[],
  settings: RunwaySettings,
  now: Date = new Date(),
  replyMultiplier = 1,
): Runway {
  const sent = applications.filter(isSubmitted);
  const replied = sent.filter(hasPositiveResponse);
  const interviewed = sent.filter(hasReachedInterview);
  const offered = sent.filter(hasReachedOffer);

  const reply = stage('Reply', replied.length, sent.length, PRIORS.reply);
  reply.rate = Math.min(1, reply.rate * replyMultiplier);
  const interview = stage('Interview', interviewed.length, replied.length, PRIORS.interview);
  const offer = stage('Offer', offered.length, interviewed.length, PRIORS.offer);
  const perApplication = reply.rate * interview.rate * offer.rate;

  const offerBy = new Date(settings.deadline.getTime() - settings.paperworkWeeks * WEEK);
  const lastApplyBy = new Date(offerBy.getTime() - settings.hiringWeeks * WEEK);
  const weeksLeft = Math.max(0, (lastApplyBy.getTime() - now.getTime()) / WEEK);

  const paceStart = now.getTime() - PACE_WINDOW_DAYS * DAY;
  const recent = sent.filter(a => new Date(a.appliedDate).getTime() >= paceStart).length;
  const pacePerWeek = recent / (PACE_WINDOW_DAYS / 7);

  // Live applications still have a shot, weighted by how far they got. An
  // application unanswered for longer than the hiring window counts as done.
  const hiringStart = now.getTime() - settings.hiringWeeks * WEEK;
  const live = sent.filter(a => {
    if (a.status === 'Applied') return new Date(a.appliedDate).getTime() >= hiringStart;
    return a.status === 'Replied' || INTERVIEW_STAGES.includes(a.status);
  });
  const liveChance = (a: JobApplication) =>
    a.status === 'Applied' ? perApplication
      : a.status === 'Replied' ? interview.rate * offer.rate
        : offer.rate;
  const inFlightChance = 1 - live.reduce((miss, a) => miss * (1 - liveChance(a)), 1);

  const projectedApplications = pacePerWeek * weeksLeft;
  return {
    offerBy,
    lastApplyBy,
    weeksLeft,
    stages: [reply, interview, offer],
    offerPerApplication: perApplication,
    applicationsPerOffer: perApplication > 0 ? 1 / perApplication : Infinity,
    pacePerWeek,
    inFlight: live.length,
    inFlightChance,
    projectedApplications,
    chance: chanceOfOffer(perApplication, projectedApplications, inFlightChance),
  };
}
