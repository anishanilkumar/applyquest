import { ApplicationStatus } from '../types';

// One colour per stage, from the house palette (index.css, "Semantic aliases"):
// the table, the Kanban board and the charts all ask here, so a stage never has
// two colours. A status is shown as a square dot and a word, not a coloured pill.
//
//   Shortlisted                                   draft  arc-dim  not sent yet
//   Applied                                       live   arc      sent, waiting
//   Replied, Phone Screen, Technical 1/2, Final   human  gold     a person is in it
//   Offer                                         offer  green
//   Rejected, Ghosted                             ended  slate
export type Stage = 'draft' | 'live' | 'human' | 'offer' | 'ended';

const STAGE: Record<ApplicationStatus, Stage> = {
  Shortlisted: 'draft',
  Applied: 'live',
  Replied: 'human',
  'Phone Screen': 'human',
  'Technical Round 1': 'human',
  'Technical Round 2': 'human',
  'Final Round': 'human',
  Offer: 'offer',
  Rejected: 'ended',
  Ghosted: 'ended',
};

export function stageOf(status: ApplicationStatus | string): Stage {
  return STAGE[status as ApplicationStatus] ?? 'live';
}

// The CSS variable holding the stage's colour as an RGB triplet, for
// `style={{ '--c': stageVar(s) }}` on a .dot or .verdict.
export function stageVar(status: ApplicationStatus | string): string {
  return `var(--stage-${stageOf(status)})`;
}

// A literal colour for SVG and chart libraries that take a colour string.
// Lines and dots use the full token; filled areas use the deeper fills.
export function stageColor(status: ApplicationStatus | string, fill = false): string {
  const s = stageOf(status);
  if (fill) {
    return { draft: 'rgb(var(--arc-dim))', live: 'rgb(var(--c-1))', human: 'rgb(var(--c-2))',
             offer: 'rgb(var(--go))', ended: 'rgb(var(--slate))' }[s];
  }
  return `rgb(var(--stage-${s}))`;
}

// Tailwind text class for the stage's colour (status words in a table cell).
export function stageText(status: ApplicationStatus | string): string {
  return { draft: 'text-arc-dim', live: 'text-arc', human: 'text-gold',
           offer: 'text-go', ended: 'text-slate' }[stageOf(status)];
}
