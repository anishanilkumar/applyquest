import React, { useMemo, useState } from 'react';
import { Hourglass, Settings } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { userService } from '../../services/api';
import { computeRunway, paceFor, Stage } from '../../utils/runway';

const TARGETS = [0.5, 0.8, 0.9];
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const pct = (x: number) => `${Math.round(x * 100)}%`;
const perWeek = (x: number) => (Number.isFinite(x) ? `${Math.ceil(x)}/week` : '—');

const StageTile: React.FC<{ stage: Stage; unit: string }> = ({ stage, unit }) => (
  <div className="flex-1 min-w-[7rem] rounded-lg bg-gray-50 px-3 py-2">
    <div className="text-xs text-gray-500">{stage.label} rate</div>
    <div className="text-lg font-bold text-gray-800">{pct(stage.rate)}</div>
    <div className="text-xs text-gray-500">
      {stage.successes} of {stage.trials} {unit}
      {(stage.assumed || stage.successes === 0) && (
        <span className="block text-amber-700" title="Until real outcomes accumulate, this stage leans on an assumed rate">
          assumes {stage.priorNote}
        </span>
      )}
    </div>
  </div>
);

// How likely is an offer before the search deadline, and what would it take?
// The math lives in utils/runway.ts; this card shows it and edits the settings.
const RunwayCard: React.FC = () => {
  const { user, setUser, applications, isMentorView } = useAppContext();
  const [replyBoost, setReplyBoost] = useState(1);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ searchDeadline: '', hiringWeeks: 6, paperworkWeeks: 4 });
  const [saving, setSaving] = useState(false);

  const runway = useMemo(() => {
    if (!user?.searchDeadline) return null;
    const settings = {
      deadline: new Date(`${user.searchDeadline}T00:00:00`),
      hiringWeeks: user.hiringWeeks,
      paperworkWeeks: user.paperworkWeeks,
    };
    return { base: computeRunway(applications, settings), boosted: computeRunway(applications, settings, new Date(), replyBoost) };
  }, [applications, user, replyBoost]);

  if (!user) return null;

  const openSettings = () => {
    setForm({ searchDeadline: user.searchDeadline ?? '', hiringWeeks: user.hiringWeeks, paperworkWeeks: user.paperworkWeeks });
    setEditing(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      setUser(await userService.updateUser({ ...form, searchDeadline: form.searchDeadline || undefined }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const settingsForm = (
    <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-gray-50 rounded-lg p-4 mb-4">
      <label className="text-xs text-gray-600">
        Search must end by
        <input type="date" required value={form.searchDeadline}
          onChange={e => setForm({ ...form, searchDeadline: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800" />
      </label>
      <label className="text-xs text-gray-600">
        Hiring takes (weeks)
        <input type="number" min={1} max={52} required value={form.hiringWeeks}
          onChange={e => setForm({ ...form, hiringWeeks: Number(e.target.value) })}
          className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800" />
      </label>
      <label className="text-xs text-gray-600">
        Paperwork after an offer (weeks)
        <input type="number" min={0} max={52} required value={form.paperworkWeeks}
          onChange={e => setForm({ ...form, paperworkWeeks: Number(e.target.value) })}
          className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="flex-1 border border-gray-300 text-sm rounded-lg px-3 py-1.5 text-gray-700 hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </form>
  );

  const header = (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full p-3">
          <Hourglass className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Runway</h2>
          <p className="text-xs text-gray-500">
            {user.searchDeadline
              ? `Search ends ${fmtDate(new Date(`${user.searchDeadline}T00:00:00`))}`
              : 'How likely an offer is before your deadline, from your real conversion rates'}
          </p>
        </div>
      </div>
      {!isMentorView && !editing && (
        <button type="button" onClick={openSettings} title="Runway settings"
          className="text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100">
          <Settings className="w-5 h-5" />
        </button>
      )}
    </div>
  );

  if (!runway) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-md mb-6">
        {header}
        {editing ? settingsForm : (
          <p className="text-sm text-gray-600">
            Set the date your search must end by — a visa window, savings, a notice period — to see your odds of an offer in time and the pace it takes.
          </p>
        )}
      </div>
    );
  }

  const { base, boosted } = runway;
  const r = replyBoost === 1 ? base : boosted;
  const closed = base.weeksLeft === 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-md mb-6">
      {header}
      {editing && settingsForm}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr] gap-6">
        {/* Headline: the odds at the current pace */}
        <div>
          <div className="text-5xl font-bold text-gray-900 tabular-nums">{pct(r.chance)}</div>
          <div className="text-sm text-gray-700 mt-1">
            chance of an offer by <span className="font-semibold">{fmtDate(r.offerBy)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3" role="img" aria-label={`${pct(r.chance)} chance`}>
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: pct(r.chance) }} />
          </div>
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            {closed
              ? `The last useful application date (${fmtDate(r.lastApplyBy)}) has passed — this is what is already in flight.`
              : <>At your pace of <span className="font-semibold text-gray-700">{r.pacePerWeek.toFixed(1)}/week</span> (last 4 weeks), about{' '}
                  <span className="font-semibold text-gray-700">{Math.round(r.projectedApplications)}</span> more applications before{' '}
                  <span className="font-semibold text-gray-700">{fmtDate(r.lastApplyBy)}</span>, the last date one can still turn into an offer in time.</>}
            {r.inFlight > 0 && ` ${r.inFlight} live application${r.inFlight === 1 ? '' : 's'} add ${pct(r.inFlightChance)} on their own.`}
          </p>
        </div>

        <div className="space-y-4">
          {/* The funnel the odds come from */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Your funnel — about <span className="text-gray-800 font-semibold">{Math.round(r.applicationsPerOffer)}</span> applications per offer
            </div>
            <div className="flex flex-wrap gap-2">
              <StageTile stage={r.stages[0]} unit="sent" />
              <StageTile stage={r.stages[1]} unit="replies" />
              <StageTile stage={r.stages[2]} unit="interviews" />
            </div>
          </div>

          {/* What it takes */}
          {!closed && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Pace needed until {fmtDate(r.lastApplyBy)}</div>
              <div className="flex flex-wrap gap-2">
                {TARGETS.map(t => {
                  const need = paceFor(t, r.offerPerApplication, r.weeksLeft, r.inFlightChance);
                  const onPace = need <= r.pacePerWeek;
                  return (
                    <div key={t} className={`flex-1 min-w-[6rem] rounded-lg px-3 py-2 border ${onPace ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
                      <div className="text-xs text-gray-500">{pct(t)} chance</div>
                      <div className="text-lg font-bold text-gray-800">{perWeek(need)}</div>
                      <div className="text-xs text-gray-500">{onPace ? 'on pace' : Number.isFinite(need) ? `+${Math.ceil(need - r.pacePerWeek)} vs now` : 'out of reach'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* The lever that moves everything */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <label htmlFor="reply-boost" className="font-medium">What if your reply rate were…</label>
              <span className="font-semibold text-gray-800">
                {pct(boosted.stages[0].rate)}{replyBoost > 1 && ` (${replyBoost.toFixed(1)}×)`}
              </span>
            </div>
            <input id="reply-boost" type="range" min={1} max={4} step={0.25} value={replyBoost}
              onChange={e => setReplyBoost(Number(e.target.value))} className="w-full accent-indigo-500" />
            <p className="text-xs text-gray-500">
              {replyBoost === 1
                ? 'Drag to see what better-targeted applications, referrals or a sharper CV would do.'
                : `${pct(boosted.chance)} at today's pace, versus ${pct(base.chance)} now.`}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        Rates are your own outcomes, nudged toward a stated assumption where data is thin. Applications are treated as independent
        chances, so treat the percentage as a direction, not a forecast. Offer-by date = deadline − {user.paperworkWeeks} weeks of paperwork;
        last useful application = that − {user.hiringWeeks} weeks of hiring.
      </p>
    </div>
  );
};

export default RunwayCard;
