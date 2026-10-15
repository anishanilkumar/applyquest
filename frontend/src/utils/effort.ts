import { ApplicationEffort } from '../types';

// How much went into an application. Unknown is the default for anything not
// yet classified, so it gets no badge.
export const EFFORTS: ApplicationEffort[] = ['Full', 'Light', 'Generic', 'Unknown'];

export const EFFORT_DESCRIPTION: Record<ApplicationEffort, string> = {
  Full: 'Tailored CV and cover letter, screening questions answered',
  Light: 'Some tailoring',
  Generic: 'Standard CV, no tailoring — e.g. a one-click Easy Apply',
  Unknown: 'Not classified yet',
};

export const EFFORT_BADGE: Record<ApplicationEffort, string> = {
  Full: 'bg-indigo-100 text-indigo-800',
  Light: 'bg-sky-100 text-sky-800',
  Generic: 'bg-gray-100 text-gray-700',
  Unknown: '',
};
