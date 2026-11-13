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

// Effort as a tag tone (components/common/Marks.tsx): more effort reads brighter.
export const EFFORT_TONE: Record<ApplicationEffort, 'ink' | 'arc' | 'dim'> = {
  Full: 'arc',
  Light: 'ink',
  Generic: 'dim',
  Unknown: 'dim',
};
