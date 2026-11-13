import React, { useMemo, useEffect, useRef } from 'react';
import { Target, Briefcase, Users, Star, DollarSign, Zap, FileText, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { JobApplication, NetworkContact } from '../../types';
import { userService } from '../../services/api';
import RunwayCard from './RunwayCard';
import NextInterviewsCard from './NextInterviewsCard';
import { hasPositiveResponse, hasReachedInterview, isSubmitted } from '../../utils/stages';

const toLocalDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dateToSeed(dateStr: string): number {
  return dateStr.split('').reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 1), 0);
}

type GoalDef = {
  id: number;
  label: string;
  icon: React.ElementType;
  target: number;
  measure: (apps: JobApplication[], contacts: NetworkContact[], today: string) => number;
};

const GOAL_POOL: GoalDef[] = [
  {
    id: 1,
    label: "Apply to 3 jobs",
    icon: Briefcase,
    target: 3,
    measure: (apps, _, today) => apps.filter(a => toLocalDate(a.createdAt) === today).length,
  },
  {
    id: 2,
    label: "Add 2 networking contacts",
    icon: Users,
    target: 2,
    measure: (_, contacts, today) =>
      contacts.filter(c => c.createdAt && toLocalDate(c.createdAt) === today).length,
  },
  {
    id: 3,
    label: "Update an application status",
    icon: Target,
    target: 1,
    measure: (apps, _, today) =>
      apps.filter(a => toLocalDate(a.updatedAt) === today && toLocalDate(a.createdAt) !== today).length,
  },
  {
    id: 4,
    label: "Add 2 applications with notes",
    icon: FileText,
    target: 2,
    measure: (apps, _, today) =>
      apps.filter(a => toLocalDate(a.createdAt) === today && !!a.notes?.trim()).length,
  },
  {
    id: 5,
    label: "Send 1 full application",
    icon: Zap,
    target: 1,
    measure: (apps, _, today) =>
      apps.filter(a => toLocalDate(a.createdAt) === today && a.effort === 'Full').length,
  },
  {
    id: 6,
    label: "Add 2 high-priority applications",
    icon: Star,
    target: 2,
    measure: (apps, _, today) =>
      apps.filter(a => toLocalDate(a.createdAt) === today && a.priorityStars >= 4).length,
  },
  {
    id: 7,
    label: "Add 2 applications with salary info",
    icon: DollarSign,
    target: 2,
    measure: (apps, _, today) =>
      apps.filter(a => toLocalDate(a.createdAt) === today && !!a.salaryRange?.trim()).length,
  },
  {
    id: 8,
    label: "Shortlist 2 opportunities",
    icon: Bookmark,
    target: 2,
    measure: (apps, _, today) =>
      apps.filter(a => toLocalDate(a.createdAt) === today && a.status === 'Shortlisted').length,
  },
];

const ApplyQuestDashboard: React.FC = () => {
  const { user, setUser, applications, contacts, loading } = useAppContext();
  const navigate = useNavigate();
  const bonusClaimedRef = useRef(false);

  const dailyGoals = useMemo(() => {
    const today = getTodayStr();
    const seed = dateToSeed(today);
    const shuffled = seededShuffle(GOAL_POOL, seed);
    return shuffled.slice(0, 3).map(goal => ({
      ...goal,
      current: goal.measure(applications, contacts, today),
    }));
  }, [applications, contacts]);

  // Calculate Quick Stats — same definitions as Analytics: only applications
  // actually sent count, and a rejection is not a response (utils/stages.ts).
  const quickStats = useMemo(() => {
    const sent = applications.filter(isSubmitted);
    const drafts = applications.filter(app => app.status === 'Shortlisted').length;
    const total = sent.length;
    const rate = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      totalApplications: total,
      responseRate: rate(sent.filter(hasPositiveResponse).length),
      interviewRate: rate(sent.filter(hasReachedInterview).length),
      activeApplications: sent.filter(app => !['Rejected', 'Ghosted', 'Offer'].includes(app.status)).length,
      drafts,
    };
  }, [applications]);

  const allGoalsComplete = dailyGoals.every(g => g.current >= g.target);

  useEffect(() => {
    if (allGoalsComplete && !bonusClaimedRef.current) {
      bonusClaimedRef.current = true;
      userService.claimDailyGoalBonus().then(setUser).catch(() => {});
    }
  }, [allGoalsComplete, setUser]);

  if (loading || !user) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-10 w-1/3 placeholder" />
        <div className="h-40 placeholder" />
        <div className="h-40 placeholder" />
      </div>
    );
  }

  // Level Calculations
  const levels = [0, 100, 300, 600, 1000, 1500];
  const nextLevelIndex = levels.findIndex(lz => lz > user.points);
  const nextLevelPoints = nextLevelIndex !== -1 ? levels[nextLevelIndex] : user.points * 1.5;
  const currentLevelBase = nextLevelIndex !== -1 && nextLevelIndex > 0 ? levels[nextLevelIndex - 1] : 0;


  // Lit ticks rather than a sliding bar: progress reads as a count of marks.
  const lit = (n: number, of: number) => Math.round(Math.min(Math.max(n / of, 0), 1) * 10);
  const levelTicks = lit(user.points - currentLevelBase, nextLevelPoints - currentLevelBase);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="label">Dashboard</span>
          <h1 className="major mt-1">{user.name}</h1>
        </div>
        <span className="stamp">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </header>

      <NextInterviewsCard />

      <RunwayCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level and points: kept, shown as a plain readout. */}
        <section className="instrument">
          <span className="label">Level {user.level}</span>
          <p className="readout mt-2">{user.levelName || 'Novice'}</p>
          <div className="flex gap-1 mt-4" aria-label={`${levelTicks} of 10 toward the next level`}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={`h-3 flex-1 ${i < levelTicks ? 'bg-arc' : 'bg-engrave'}`} />
            ))}
          </div>
          <p className="stamp mt-2">{user.points} pts · {Math.max(Math.round(nextLevelPoints - user.points), 0)} to the next level</p>
        </section>

        {/* Streak: working days in a row with an application. */}
        <section className="instrument">
          <span className="label">Streak</span>
          <p className="mt-2"><span className="hero text-gold">{user.currentStreak}</span> <span className="stamp">days</span></p>
          <div className="flex gap-1 mt-4" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} className={`h-3 flex-1 ${i < Math.min(user.currentStreak, 7) ? 'bg-gold' : 'bg-engrave'}`} />
            ))}
          </div>
          <p className="stamp mt-2">Best {user.longestStreak} days</p>
        </section>

        <section className="instrument">
          <span className="label">Sent</span>
          <p className="mt-2"><span className="hero text-arc">{quickStats.totalApplications}</span></p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between" title="A reply or any later stage; rejections and ghosting don't count">
              <dt className="text-ink-dim">Positive response</dt><dd className="font-mono">{quickStats.responseRate}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-dim">Interview rate</dt><dd className="font-mono">{quickStats.interviewRate}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-dim">Awaiting an outcome</dt><dd className="font-mono">{quickStats.activeApplications}</dd>
            </div>
            {quickStats.drafts > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-dim">Drafts not yet sent</dt><dd className="font-mono text-ink-dim">{quickStats.drafts}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="instrument">
        <div className="flex items-center justify-between mb-3">
          <span className="label">Today</span>
          {allGoalsComplete && <span className="stamp uppercase text-arc">All done</span>}
        </div>
        <ul>
          {dailyGoals.map((goal, i) => {
            const isComplete = goal.current >= goal.target;
            return (
              <li key={goal.id} className={`flex items-center gap-3 min-h-[56px] py-2 ${i ? 'border-t-2 border-engrave' : ''}`}>
                <span className="tick" data-on={isComplete} aria-hidden="true" />
                <span className={`flex-1 ${isComplete ? 'text-ink-dim' : ''}`}>{goal.label}</span>
                <span className="font-mono text-label">{Math.min(goal.current, goal.target)} / {goal.target}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={() => navigate('/applications')} className="btn btn-primary">
          <Briefcase className="w-5 h-5" strokeWidth={1.6} /> Add application
        </button>
        <button onClick={() => navigate('/applications')} className="btn">
          <Target className="w-5 h-5" strokeWidth={1.6} /> Board
        </button>
        <button onClick={() => navigate('/network')} className="btn">
          <Users className="w-5 h-5" strokeWidth={1.6} /> Network
        </button>
      </div>
    </div>
  );
};

export default ApplyQuestDashboard;
