import React from 'react';
import { ApplicationStatus } from '../../types';
import { stageVar } from '../../utils/statusStyle';

// Small marks shared by the table, the Kanban board and the forms, so a status
// or a priority looks the same everywhere (index.css has the house classes).

/** A status as a square dot in its stage colour and the word. */
export const StatusMark: React.FC<{ status: ApplicationStatus | string; className?: string }> = ({ status, className = '' }) => (
  <span className={`inline-flex items-center gap-2 font-mono text-min uppercase tracking-stamp text-ink whitespace-nowrap ${className}`}>
    <i className="dot" style={{ ['--c' as any]: stageVar(status) }} aria-hidden="true" />
    {status}
  </span>
);

/** Priority, 0-5, as lit squares: gold, because it is a human judgement. */
export const Priority: React.FC<{ value: number; max?: number }> = ({ value, max = 5 }) => (
  <span className="inline-flex gap-[3px]" aria-label={`Priority ${value} of ${max}`} title={`Priority ${value} of ${max}`}>
    {Array.from({ length: max }, (_, i) => (
      <i key={i} className={`w-2 h-2 ${i < value ? 'bg-gold' : 'border-2 border-engrave'}`} />
    ))}
  </span>
);

/** A small engraved tag: effort, fit score, visa, a skill. */
export const Tag: React.FC<{ children: React.ReactNode; title?: string; tone?: 'ink' | 'arc' | 'gold' | 'dim' }> = ({ children, title, tone = 'dim' }) => (
  <span className={`tag whitespace-nowrap ${{ ink: 'text-ink', arc: 'text-arc', gold: 'text-gold', dim: 'text-ink-dim' }[tone]}`} title={title}>
    {children}
  </span>
);
