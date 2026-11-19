export interface User {
  id: string;
  name: string;
  email: string;
  currentEducation: string;
  germanLevel: string;
  currentRole: string;
  points: number;
  level: number;
  levelName: string;
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  // Runway settings (utils/runway.ts): the date the search must end by, how
  // long hiring takes, and how long the paperwork after an offer needs.
  searchDeadline?: string;
  hiringWeeks: number;
  paperworkWeeks: number;
  createdAt: string;
}

export interface JobApplication {
  id: string;
  userId: string;
  companyName: string;
  positionTitle: string;
  location: string;
  jobUrl?: string;
  salaryRange?: string;
  techStack?: string;
  status: ApplicationStatus;
  visaSponsorship: boolean;
  germanRequirement: GermanLevel;
  relocationSupport: boolean;
  effort: ApplicationEffort;
  jobBoardSource?: string;
  priorityStars: number;
  notes?: string;
  appliedDate: string;
  createdAt: string;
  updatedAt: string;
  history?: ApplicationHistory[];
  referralContactId?: string;
  // Synced from the ai-job-search workflow that drafts the documents.
  fitScore?: number;
  roleType?: string;
  cvFile?: string;
  coverLetterFile?: string;
  researchFile?: string;
  archiveDir?: string;
  // The apply queue: the salary to name when asked (euros a year), whether
  // salaryRange is an estimate rather than the posting's, and one thing to
  // check before sending.
  salaryAsk?: number;
  salaryEstimated?: boolean;
  headsUp?: string;
  // Minutes the application took (a sync field), and P(interview) as the
  // server's odds model put it when the application was sent (read-only).
  minutesSpent?: number;
  predictedP?: number;
}

// A scheduled conversation with an employer (backend: models/interview.py).
export interface Interview {
  id: string;
  applicationId: string;
  startsAt: string;   // ISO 8601 with offset
  endsAt?: string;
  stage?: string;
  title?: string;
  meetingUrl?: string;
  interviewers?: string;
  notes?: string;
  calendarEventId?: string;
}

export interface ApplicationHistory {
  id: string;
  applicationId: string;
  oldStatus?: string;
  newStatus: ApplicationStatus;
  notes?: string;
  changedAt: string;
}

export type ApplicationEffort = 'Full' | 'Light' | 'Generic' | 'Unknown';

export type ApplicationStatus =
  | 'Shortlisted'
  | 'Applied'
  | 'Replied'
  | 'Phone Screen'
  | 'Technical Round 1'
  | 'Technical Round 2'
  | 'Final Round'
  | 'Offer'
  | 'Rejected'
  | 'Ghosted'
  | 'Not Applying'; // a draft set aside, never sent

export type GermanLevel = 'None' | 'Basic' | 'Fluent';

export interface InterviewRound {
  id: string;
  applicationId: string;
  roundType: string;
  scheduledDate?: string;
  completedDate?: string;
  status: string;
  notes?: string;
}

export interface NetworkContact {
  id: string;
  userId: string;
  name: string;
  email?: string;
  company?: string;
  relationship?: string;
  connectionStrength: number;
  lastContactDate?: string;
  notes?: string;
  applicationId?: string;
  createdAt?: string;
}

export interface DailyGoal {
  id: string;
  userId: string;
  date: string;
  goalType: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
}

export interface Activity {
  id: string;
  userId: string;
  activityType: string;
  pointsEarned: number;
  applicationId?: string;
  createdAt: string;
}
// The game's part of GET /stats/summary (backend core/quest.py).
export interface Quest {
  id: string;
  key: 'volume' | 'explore' | 'oldest';
  title: string;
  detail: string;
  progress: number;
  target: number;
  done: boolean;
  xp: number;
}

export interface GameState {
  today: { target: number | null; sent: number; working: boolean };
  banked: number;
  quests: Quest[];
  freezes: number;
  nextLevel: { level: number; name: string; minPoints: number } | null;
  calibration: { n: number; expected: number; observed: number; brier: number | null };
}

// GET /stats/model (backend core/model.py): the logistic regression.
export interface RegressionModel {
  sigma: number;
  n: number;
  coefficients: { name: string; mean: number; sd: number }[];
  drafts: Record<string, { p: number; lo: number; hi: number; draw: number }>;
}
