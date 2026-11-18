import { queueEntries, queueEntry } from '../utils/queue';
import { ApplicationStatus, JobApplication } from '../types';

const NOW = new Date('2026-11-20T12:00:00Z');

function app(status: ApplicationStatus, moves: [ApplicationStatus | undefined, ApplicationStatus, string][]): JobApplication {
  const history = moves.map(([oldStatus, newStatus, changedAt], i) => ({
    id: `h${i}`, applicationId: 'a1', oldStatus, newStatus, changedAt,
  }));
  return { id: 'a1', status, history } as unknown as JobApplication;
}

describe('queueEntry', () => {
  it('puts a draft in the queue', () => {
    expect(queueEntry(app('Shortlisted', []), NOW)?.state).toBe('todo');
  });

  it('keeps a recently sent draft as sent, whatever happened next', () => {
    const a = app('Rejected', [['Shortlisted', 'Applied', '2026-11-18T10:00:00'], ['Applied', 'Rejected', '2026-11-19T10:00:00']]);
    expect(queueEntry(a, NOW)).toMatchObject({ state: 'sent', movedAt: '2026-11-18T10:00:00' });
  });

  it('shows a draft set aside as skip', () => {
    expect(queueEntry(app('Rejected', [['Shortlisted', 'Rejected', '2026-11-18T10:00:00']]), NOW)?.state).toBe('skip');
  });

  it('returns an undone skip to the queue', () => {
    const a = app('Shortlisted', [['Shortlisted', 'Rejected', '2026-11-18T10:00:00'], ['Rejected', 'Shortlisted', '2026-11-18T11:00:00']]);
    expect(queueEntry(a, NOW)?.state).toBe('todo');
  });

  it('drops drafts that left the queue more than two weeks ago', () => {
    expect(queueEntry(app('Applied', [['Shortlisted', 'Applied', '2026-10-01T10:00:00']]), NOW)).toBeNull();
  });

  it('ignores applications that never were drafts', () => {
    expect(queueEntries([app('Applied', [[undefined, 'Applied', '2026-11-18T10:00:00']])], NOW)).toEqual([]);
  });
});

describe('Not Applying', () => {
  it('shows a draft set aside with the new status as skip', () => {
    const a = app('Not Applying', [['Shortlisted', 'Not Applying', '2026-11-18T10:00:00']]);
    expect(queueEntry(a, NOW)?.state).toBe('skip');
  });

  it('returns it to the queue when brought back', () => {
    const a = app('Shortlisted', [['Shortlisted', 'Not Applying', '2026-11-18T10:00:00'], ['Not Applying', 'Shortlisted', '2026-11-18T11:00:00']]);
    expect(queueEntry(a, NOW)?.state).toBe('todo');
  });
});
