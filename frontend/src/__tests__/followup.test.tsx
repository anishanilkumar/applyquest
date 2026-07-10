import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

import { classifyApp, daysSince, DECISION_STALE_DAYS } from '../utils/followup';
import { JobApplication } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function dateAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function makeApp(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'app-1',
    userId: 'user-1',
    companyName: 'Acme',
    positionTitle: 'Engineer',
    location: 'Berlin',
    status: 'Applied',
    visaSponsorship: false,
    germanRequirement: 'None',
    relocationSupport: false,
    easyApply: false,
    priorityStars: 0,
    appliedDate: dateAgo(0),
    followupFlagged: false,
    createdAt: daysAgoIso(0),
    updatedAt: daysAgoIso(0),
    ...overrides,
  };
}

// A flagged app that hasn't been followed up yet — the queue's entry state.
function flaggedApp(overrides: Partial<JobApplication> = {}): JobApplication {
  return makeApp({ followupFlagged: true, ...overrides });
}

// ─── classifyApp (pure logic) ────────────────────────────────────────────────

describe('classifyApp', () => {
  it('returns ok for an unflagged app', () => {
    expect(classifyApp(makeApp())).toBe('ok');
  });

  it('returns ok for an unflagged app however stale', () => {
    const app = makeApp({ updatedAt: daysAgoIso(30) });
    expect(classifyApp(app)).toBe('ok');
  });

  it('returns needs_followup as soon as an app is flagged', () => {
    const app = flaggedApp({ updatedAt: daysAgoIso(0) });
    expect(classifyApp(app)).toBe('needs_followup');
  });

  it('returns awaiting_response when followed up recently', () => {
    const app = flaggedApp({ followedUpAt: dateAgo(1) });
    expect(classifyApp(app)).toBe('awaiting_response');
  });

  it('returns needs_decision when followup was 3+ days ago', () => {
    const app = flaggedApp({ followedUpAt: dateAgo(DECISION_STALE_DAYS) });
    expect(classifyApp(app)).toBe('needs_decision');
  });

  it('returns ok for Rejected even when flagged', () => {
    const app = flaggedApp({ status: 'Rejected', updatedAt: daysAgoIso(30) });
    expect(classifyApp(app)).toBe('ok');
  });

  it('returns ok for Ghosted even when flagged', () => {
    const app = flaggedApp({ status: 'Ghosted', updatedAt: daysAgoIso(30) });
    expect(classifyApp(app)).toBe('ok');
  });
});

// ─── daysSince ───────────────────────────────────────────────────────────────

describe('daysSince', () => {
  it('returns 0 for today', () => {
    expect(daysSince(daysAgoIso(0))).toBe(0);
  });

  it('returns the correct number of days', () => {
    expect(daysSince(daysAgoIso(5))).toBe(5);
  });
});

// ─── FollowupPage component ──────────────────────────────────────────────────

jest.mock('../context/AppContext', () => ({
  useAppContext: jest.fn(),
}));

// Single mock covering all service methods used across all describe blocks.
// A second jest.mock for the same module would override this one due to hoisting.
jest.mock('../services/api', () => ({
  applicationService: {
    markFollowedUp: jest.fn(),
    updateStatus: jest.fn(),
    setFollowupFlag: jest.fn(),
  },
  userService: {
    getCurrentUser: jest.fn(),
    claimDailyGoalBonus: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const { useAppContext } = require('../context/AppContext');
const { applicationService, userService } = require('../services/api');
import FollowupPage from '../pages/Followup';

function renderFollowup(apps: JobApplication[]) {
  const setApplications = jest.fn();
  const setUser = jest.fn();
  useAppContext.mockReturnValue({
    applications: apps,
    setApplications,
    setUser,
    isMentorView: false,
  });
  render(
    <MemoryRouter>
      <FollowupPage />
    </MemoryRouter>
  );
  return { setApplications, setUser };
}

describe('FollowupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when nothing is flagged', () => {
    renderFollowup([makeApp()]);
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
  });

  it('keeps a long-stale unflagged app out of the queue', () => {
    renderFollowup([makeApp({ companyName: 'Beta Corp', updatedAt: daysAgoIso(30) })]);
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    expect(screen.queryByText('Beta Corp')).not.toBeInTheDocument();
  });

  it('shows flagged app under Needs Followup section', () => {
    renderFollowup([flaggedApp({ companyName: 'Beta Corp' })]);
    expect(screen.getByText('Beta Corp')).toBeInTheDocument();
    expect(screen.getByText(/Needs Followup/)).toBeInTheDocument();
  });

  it('shows Mark Followed Up button for needs_followup apps', () => {
    renderFollowup([flaggedApp()]);
    expect(screen.getByRole('button', { name: /Mark Followed Up/i })).toBeInTheDocument();
  });

  it('calls markFollowedUp API and updates context when button clicked', async () => {
    const app = flaggedApp({ id: 'x1' });
    const updatedApp = { ...app, followedUpAt: dateAgo(0) };
    applicationService.markFollowedUp.mockResolvedValue(updatedApp);
    userService.getCurrentUser.mockResolvedValue({ points: 51 });

    const { setApplications } = renderFollowup([app]);
    fireEvent.click(screen.getByRole('button', { name: /Mark Followed Up/i }));

    await waitFor(() => {
      expect(applicationService.markFollowedUp).toHaveBeenCalledWith('x1');
      expect(setApplications).toHaveBeenCalled();
    });
  });

  it('unflags an app when Not chasing is clicked', async () => {
    const app = flaggedApp({ id: 'z1' });
    applicationService.setFollowupFlag.mockResolvedValue({ ...app, followupFlagged: false });

    const { setApplications } = renderFollowup([app]);
    fireEvent.click(screen.getByRole('button', { name: /Not chasing/i }));

    await waitFor(() => {
      expect(applicationService.setFollowupFlag).toHaveBeenCalledWith('z1', false);
      expect(setApplications).toHaveBeenCalled();
    });
  });

  it('shows Ghosted/Rejected buttons under Needs Decision section', () => {
    renderFollowup([flaggedApp({ followedUpAt: dateAgo(DECISION_STALE_DAYS) })]);
    expect(screen.getByRole('button', { name: 'Ghosted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeInTheDocument();
  });

  it('calls updateStatus with Ghosted when Ghosted button clicked', async () => {
    const app = flaggedApp({ id: 'y1', followedUpAt: dateAgo(DECISION_STALE_DAYS) });
    const ghostedApp = { ...app, status: 'Ghosted' as const };
    applicationService.updateStatus.mockResolvedValue(ghostedApp);

    const { setApplications } = renderFollowup([app]);
    fireEvent.click(screen.getByRole('button', { name: 'Ghosted' }));

    await waitFor(() => {
      expect(applicationService.updateStatus).toHaveBeenCalledWith('y1', 'Ghosted');
      expect(setApplications).toHaveBeenCalled();
    });
  });

  it('shows Awaiting Response section for recently followed-up apps', () => {
    renderFollowup([flaggedApp({ companyName: 'Gamma Inc', followedUpAt: dateAgo(1) })]);
    expect(screen.getByText('Gamma Inc')).toBeInTheDocument();
    expect(screen.getByText(/Awaiting Response/)).toBeInTheDocument();
  });
});

// ─── DashboardComponent followup widget ─────────────────────────────────────

jest.mock('../../components/dashboard/DashboardComponent', () => {
  // keep real impl but mock navigate
}, { virtual: true });

// Second jest.mock for the same module removed — see the consolidated mock above.

import ApplyQuestDashboard from '../components/dashboard/DashboardComponent';

function renderDashboard(apps: JobApplication[]) {
  useAppContext.mockReturnValue({
    user: { name: 'Alice', points: 50, level: 1, levelName: 'Novice', currentStreak: 1, longestStreak: 3 },
    setUser: jest.fn(),
    applications: apps,
    contacts: [],
    loading: false,
  });
  render(
    <MemoryRouter>
      <ApplyQuestDashboard />
    </MemoryRouter>
  );
}

describe('DashboardComponent followup widget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides followup widget when nothing is flagged', () => {
    renderDashboard([makeApp({ updatedAt: daysAgoIso(30) })]);
    expect(screen.queryByText('Followup Queue')).not.toBeInTheDocument();
  });

  it('shows followup widget with count when flagged apps exist', () => {
    renderDashboard([flaggedApp()]);
    expect(screen.getByText('Followup Queue')).toBeInTheDocument();
    expect(screen.getByText(/need a followup/)).toBeInTheDocument();
  });

  it('shows decision count in widget when apps need decision', () => {
    renderDashboard([flaggedApp({ followedUpAt: dateAgo(DECISION_STALE_DAYS) })]);
    expect(screen.getByText(/need a decision/)).toBeInTheDocument();
  });
});
