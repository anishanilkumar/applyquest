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
  easyApply: boolean;
  jobBoardSource?: string;
  priorityStars: number;
  notes?: string;
  appliedDate: string;
  followedUpAt?: string;
  followupFlagged: boolean;
  createdAt: string;
  updatedAt: string;
  history?: ApplicationHistory[];
  referralContactId?: string;
}

export interface ApplicationHistory {
  id: string;
  applicationId: string;
  oldStatus?: string;
  newStatus: ApplicationStatus;
  notes?: string;
  changedAt: string;
}

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
  | 'Ghosted';

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