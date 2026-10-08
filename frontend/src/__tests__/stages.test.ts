import { effectiveHistory, hasReachedInterview } from '../utils/stages';
import { ApplicationStatus, JobApplication } from '../types';

let day = 0;
function move(oldStatus: ApplicationStatus, newStatus: ApplicationStatus) {
  day += 1;
  return {
    id: `h${day}`,
    applicationId: 'a1',
    oldStatus,
    newStatus,
    changedAt: new Date(2026, 9, day).toISOString(),
  };
}

function app(status: ApplicationStatus, history: ReturnType<typeof move>[]): JobApplication {
  return { id: 'a1', status, history } as unknown as JobApplication;
}

const path = (a: JobApplication) => effectiveHistory(a).map(h => `${h.oldStatus}>${h.newStatus}`);

beforeEach(() => { day = 0; });

describe('effectiveHistory', () => {
  it('leaves a plain forward path alone', () => {
    const a = app('Phone Screen', [move('Applied', 'Replied'), move('Replied', 'Phone Screen')]);
    expect(path(a)).toEqual(['Applied>Replied', 'Replied>Phone Screen']);
  });

  it('drops the steps a correction undid', () => {
    const a = app('Phone Screen', [
      move('Applied', 'Replied'),
      move('Replied', 'Phone Screen'),
      move('Phone Screen', 'Technical Round 1'),
      move('Technical Round 1', 'Technical Round 2'),
      move('Technical Round 2', 'Technical Round 1'),
      move('Technical Round 1', 'Phone Screen'),
    ]);
    expect(path(a)).toEqual(['Applied>Replied', 'Replied>Phone Screen']);
  });

  it('reopening a ghosted application replaces the ghosting', () => {
    const a = app('Phone Screen', [move('Applied', 'Ghosted'), move('Ghosted', 'Phone Screen')]);
    expect(path(a)).toEqual(['Applied>Phone Screen']);
  });

  it('reopening a rejection back to the same stage does not loop', () => {
    const a = app('Replied', [
      move('Applied', 'Replied'),
      move('Replied', 'Rejected'),
      move('Rejected', 'Replied'),
    ]);
    expect(path(a)).toEqual(['Applied>Replied']);
  });
});

describe('hasReachedInterview', () => {
  it('is false once a mistaken interview stage is stepped back out of', () => {
    const a = app('Replied', [
      move('Applied', 'Replied'),
      move('Replied', 'Phone Screen'),
      move('Phone Screen', 'Replied'),
    ]);
    expect(hasReachedInterview(a)).toBe(false);
  });

  it('still counts an interview that ended in rejection', () => {
    const a = app('Rejected', [
      move('Applied', 'Replied'),
      move('Replied', 'Phone Screen'),
      move('Phone Screen', 'Rejected'),
    ]);
    expect(hasReachedInterview(a)).toBe(true);
  });
});
