import React from 'react';
import { useSummary } from '../../context/SummaryContext';
import Explain from '../common/Explain';
import { Quest } from '../../types';

// The game, from the server (backend core/quest.py): today's target from the
// runway, the interviews banked in flight, and the week's three quests. Points
// for a send are 1000·P(interview) at the moment it was sent. Every number
// opens its maths (backend core/glossary.py).
const QuestCard: React.FC = () => {
  const { summary: s } = useSummary();
  if (!s?.game) return null;
  const today = s.game.today as { target: number | null; sent: number };
  const banked: number = s.game.banked;
  const quests: Quest[] = s.game.quests;
  const freezes: number = s.streak.freezes ?? 0;
  const cal = s.odds?.calibration as { n: number; expected: number; observed: number; brier: number | null } | undefined;
  const target = today.target ?? 0;
  const ticks = Math.max(target, today.sent);

  return (
    <section className="instrument" aria-label="Quest">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <span className="label">Today</span>
        {today.target != null && target > 0 && today.sent >= target && <span className="stamp uppercase text-arc">Target met</span>}
        {!s.today.working && <span className="stamp uppercase">Off day</span>}
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_auto_auto] items-end">
        <div>
          <p><span className="hero text-arc">{today.sent}</span>
            <span className="text-ink-dim text-[0.4em] font-medium">
              {today.target != null ? <> / <Explain k="game.day_target">{target}</Explain> sent</> : ' sent'}
            </span></p>
          {ticks > 0 && (
            <div className="flex gap-1 mt-3" aria-label={`${today.sent} of ${target} sent today`}>
              {Array.from({ length: Math.min(ticks, 20) }, (_, i) => (
                <i key={i} className={`h-3 flex-1 ${i < today.sent ? 'bg-arc' : 'bg-engrave'}`} />
              ))}
            </div>
          )}
          <p className="stamp mt-2">
            {today.target != null ? <>Today's share of the week's <Explain k="runway.need">80% pace</Explain></> : 'Set a search deadline for a daily target'}
          </p>
        </div>
        <div>
          <div className="label">Banked</div>
          <div className="readout"><Explain k="game.banked">{banked.toFixed(2)}</Explain></div>
          <div className="stamp">Σ P(interview | no reply yet)</div>
        </div>
        <div>
          <div className="label">Freezes</div>
          <div className="readout text-gold"><Explain k="game.freezes">{freezes}</Explain></div>
          <div className="stamp">one per 5-day streak</div>
        </div>
      </div>

      <ul className="mt-5">
        {quests.map((q, i) => (
          <li key={q.id} className={`flex items-center gap-3 min-h-[56px] py-2 ${i ? 'border-t-2 border-engrave' : ''}`}>
            <span className="tick" data-on={q.done} aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <Explain k={`game.quest.${q.key}`} vars={{ progress: q.progress, target: q.target, detail: q.detail }}>
                <span className={q.done ? 'text-ink-dim' : ''}>{q.title}</span>
              </Explain>
              <span className="block stamp truncate">{q.detail}</span>
            </span>
            <span className="font-mono text-label whitespace-nowrap">{Math.min(q.progress, q.target)} / {q.target}</span>
            <span className="font-mono text-label text-gold whitespace-nowrap">+{q.xp}</span>
          </li>
        ))}
      </ul>

      <p className="stamp mt-3">
        <Explain k="calibration">
          {cal && cal.n > 0
            ? <>Calibration: {cal.observed} interviews vs Σp = {cal.expected.toFixed(2)} over {cal.n} settled sends{cal.brier != null && ` · Brier ${cal.brier.toFixed(4)}`}</>
            : 'Calibration: no settled sends with a stored prediction yet'}
        </Explain>
        {' · '}<Explain k="game.xp_send">XP per send</Explain>{' · '}<Explain k="game.lucky">lucky draw</Explain>
      </p>
    </section>
  );
};

export default QuestCard;
