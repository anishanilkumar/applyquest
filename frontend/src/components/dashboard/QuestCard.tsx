import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { gameService } from '../../services/api';
import { GameState } from '../../types';

// The game, from the server (backend core/quest.py): today's target from the
// runway, the interviews banked in flight, and the week's three quests. Points
// for a send are 1000·P(interview) at the moment it was sent.
const QuestCard: React.FC = () => {
  const { applications, user, isMentorView } = useAppContext();
  const [game, setGame] = useState<GameState | null>(null);

  // Refetch whenever an application changes: a send moves every number here.
  const stamp = applications.reduce((m, a) => (a.updatedAt > m ? a.updatedAt : m), '');
  useEffect(() => {
    if (isMentorView) return;
    gameService.get().then(setGame).catch(() => setGame(null));
  }, [stamp, isMentorView, user?.points]);

  if (isMentorView || !game) return null;
  const { today, banked, quests, freezes, calibration } = game;
  const target = today.target ?? 0;
  const ticks = Math.max(target, today.sent);

  return (
    <section className="instrument" aria-label="Quest">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <span className="label">Today</span>
        {today.target != null && today.sent >= target && target > 0 && <span className="stamp uppercase text-arc">Target met</span>}
        {!today.working && <span className="stamp uppercase">Off day</span>}
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_auto_auto] items-end">
        <div>
          <p><span className="hero text-arc">{today.sent}</span>
            <span className="text-ink-dim text-[0.4em] font-medium">{today.target != null ? ` / ${target} sent` : ' sent'}</span></p>
          {ticks > 0 && (
            <div className="flex gap-1 mt-3" aria-label={`${today.sent} of ${target} sent today`}>
              {Array.from({ length: Math.min(ticks, 20) }, (_, i) => (
                <i key={i} className={`h-3 flex-1 ${i < today.sent ? 'bg-arc' : 'bg-engrave'}`} />
              ))}
            </div>
          )}
          <p className="stamp mt-2">{today.target != null ? "Today's share of the week's 80% pace" : 'Set a search deadline for a daily target'}</p>
        </div>
        <div>
          <div className="label">Banked</div>
          <div className="readout">{banked.toFixed(2)}</div>
          <div className="stamp">Σ P(interview | no reply yet)</div>
        </div>
        <div>
          <div className="label">Freezes</div>
          <div className="readout text-gold">{freezes}</div>
          <div className="stamp">one per 5-day streak</div>
        </div>
      </div>

      <ul className="mt-5">
        {quests.map((q, i) => (
          <li key={q.id} className={`flex items-center gap-3 min-h-[56px] py-2 ${i ? 'border-t-2 border-engrave' : ''}`}>
            <span className="tick" data-on={q.done} aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className={q.done ? 'text-ink-dim' : ''}>{q.title}</span>
              <span className="block stamp truncate">{q.detail}</span>
            </span>
            <span className="font-mono text-label whitespace-nowrap">{Math.min(q.progress, q.target)} / {q.target}</span>
            <span className="font-mono text-label text-gold whitespace-nowrap">+{q.xp}</span>
          </li>
        ))}
      </ul>

      {calibration.n > 0 && (
        <p className="stamp mt-3">
          Calibration: {calibration.observed} interviews vs Σp = {calibration.expected.toFixed(2)} over {calibration.n} settled sends
          {calibration.brier != null && ` · Brier ${calibration.brier.toFixed(4)}`}
        </p>
      )}
    </section>
  );
};

export default QuestCard;
