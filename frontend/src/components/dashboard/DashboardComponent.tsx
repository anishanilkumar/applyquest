import React, { useMemo } from 'react';
import { Target, Briefcase, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import RunwayCard from './RunwayCard';
import NextInterviewsCard from './NextInterviewsCard';
import QuestCard from './QuestCard';
import { hasPositiveResponse, hasReachedInterview, isSubmitted } from '../../utils/stages';

const ApplyQuestDashboard: React.FC = () => {
  const { user, applications, loading } = useAppContext();
  const navigate = useNavigate();

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
  // The ladder of backend core/gamification.py LEVELS.
  const levels = [0, 100, 300, 600, 1000, 1500, 3000, 5000, 8000, 12000];
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

      <QuestCard />

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
          <p className="stamp mt-2">Best {user.longestStreak} days{user.streakFreezes ? ` · ${user.streakFreezes} freeze${user.streakFreezes > 1 ? 's' : ''}` : ''}</p>
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
