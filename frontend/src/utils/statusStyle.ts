import { ApplicationStatus } from '../types';

// One colour per stage, from the house palette (index.css, "Semantic aliases"):
// the table, the Kanban board and the charts all ask here, so a stage never has
// two colours. A status is shown as a square dot and a word, not a coloured pill.
//
//   Shortlisted                                   draft  arc-dim  not sent yet
//   Applied                                       live   arc      sent, waiting
//   Replied, Phone Screen, Technical 1/2, Final   human  gold     a person is in it
//   Offer                                         offer  green
//   Rejected, Ghosted, Not Applying               ended  slate
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
  'Not Applying': 'ended',
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

// The palette as literal colours, for code that cannot read CSS variables: a
// canvas (the Sankey's PNG export), an SVG serialised to an image, Leaflet
// markers. Keep in step with index.css; these do not follow the offline swap.
export const PALETTE = {
  ground: '#0a0e14', panel: '#111823', panelLit: '#16202e', engrave: '#2a3543',
  ink: '#e8f1f8', inkDim: '#7c8fa3', arc: '#3dd6f5', arcDim: '#1d7f96',
  gold: '#e8a33d', alert: '#ff4d4d', slate: '#55647a', slateDim: '#3a4657',
  go: '#4fd68a', c1: '#249cb8', c2: '#c2842b', c3: '#b39cff', grid: '#1c2633',
} as const;

// A stage's colour as a literal hex value; `fill` gives the deeper fill tone.
export function stageHex(status: ApplicationStatus | string, fill = false): string {
  const s = stageOf(status);
  const P = PALETTE;
  if (fill) return { draft: P.arcDim, live: P.c1, human: P.c2, offer: P.go, ended: P.slate }[s];
  return { draft: P.arcDim, live: P.arc, human: P.gold, offer: P.go, ended: P.slate }[s];
}
