import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { applicationService } from '../services/api';
import { ApplicationEffort, ApplicationStatus, JobApplication } from '../types';
import { oddsModel } from '../utils/odds';
import { QUEUE_WINDOW_DAYS, QueueEntry, QueueState, queueEntries } from '../utils/queue';

// The apply queue: drafts waiting to be sent, worked through one by one.
// Ticking a draft marks it Applied; "Not applying" sets it aside
// (Shortlisted -> Rejected, never counted as sent). Both can be undone while
// the draft is still on the page. P(interview) comes from the track record
// (utils/odds.ts) and is a ranking signal, not a forecast.

type Filter = QueueState | 'all';
type Tier = ApplicationEffort | 'any';

const TIERS: Tier[] = ['any', 'Full', 'Light', 'Generic'];
const FILTER_LABEL: Record<Filter, string> = { todo: 'To send', sent: 'Sent', skip: 'Not applying', all: 'All' };

const shortDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
const euros = (n: number) => `€${Math.round(n / 1000)}k`;
const fileName = (path: string) => path.split('/').pop()!.replace(/\.(tex|pdf)$/, '');

const Queue: React.FC = () => {
  const { applications, setApplications, isMentorView } = useAppContext();
  const [filter, setFilter] = useState<Filter>('todo');
  const [tier, setTier] = useState<Tier>('any');
  const [busy, setBusy] = useState<string | null>(null);

  const model = useMemo(() => oddsModel(applications), [applications]);
  const entries = useMemo(() => {
    const list = queueEntries(applications).map(e => ({ ...e, p: model.p(e.app) }));
    return list.sort((a, b) => b.p - a.p || (b.app.fitScore ?? 0) - (a.app.fitScore ?? 0));
  }, [applications, model]);

  const count = (s: QueueState) => entries.filter(e => e.state === s).length;
  const live = entries.filter(e => e.state !== 'skip');
  const expectedSent = entries.filter(e => e.state === 'sent').reduce((acc, e) => acc + e.p, 0);
  const expectedLeft = entries.filter(e => e.state === 'todo').reduce((acc, e) => acc + e.p, 0);
  const shown = entries.filter(e => (filter === 'all' || e.state === filter) && (tier === 'any' || e.app.effort === tier));

  // The tab carries the job at the top of the current list, so it reads at a
  // glance while the posting is open in another tab.
  const top = shown[0]?.app;
  const tabTitle = top ? `${top.companyName} – ${top.positionTitle}` : 'Queue · ApplyQuest';
  useEffect(() => {
    const before = document.title;
    document.title = tabTitle;
    return () => { document.title = before; };
  }, [tabTitle]);

  const move = async (app: JobApplication, to: ApplicationStatus, notes?: string) => {
    setBusy(app.id);
    try {
      const updated = await applicationService.updateStatus(app.id, to, notes);
      setApplications(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    } catch {
      toast.error('Not saved: the status change was refused.');
    } finally {
      setBusy(null);
    }
  };

  // Un-sending is a one-stage step back, so only an application still at Applied can return.
  const toggleSent = (e: QueueEntry) => {
    if (e.state === 'sent') return move(e.app, 'Shortlisted');
    return move(e.app, 'Applied');
  };
  const toggleSkip = (e: QueueEntry) => (e.state === 'skip' ? move(e.app, 'Shortlisted') : move(e.app, 'Rejected', 'Not applying'));

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => toast.success(`${label} file name copied`), () => toast(value));
  };

  return (
    <div className="max-w-[54rem] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <section className="instrument grid gap-5 sm:grid-cols-[auto_1fr] items-end" aria-label="Progress">
        <div>
          <div className="label">Sent · last {QUEUE_WINDOW_DAYS} days</div>
          <div className="hero">{count('sent')}<span className="text-ink-dim text-[0.4em] font-medium"> / {live.length}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="label">Interviews expected</div>
            <div className="readout">{expectedSent.toFixed(1)}</div>
            <div className="stamp">Σp over what you sent</div>
          </div>
          <div>
            <div className="label">Still on the table</div>
            <div className="readout">{expectedLeft.toFixed(1)}</div>
            <div className="stamp">Σp if you send the rest</div>
          </div>
          <div className="meter col-span-2" aria-hidden="true"><i style={{ width: `${live.length ? (100 * count('sent')) / live.length : 0}%` }} /></div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {(['todo', 'sent', 'skip', 'all'] as Filter[]).map(f => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]} <b className="ml-1">{f === 'all' ? entries.length : count(f)}</b>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Effort">
          {TIERS.map(t => (
            <button key={t} className="chip" aria-pressed={tier === t} onClick={() => setTier(t)}>
              {t === 'any' ? 'Any tier' : t}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <span className="empty-title">{filter === 'sent' ? 'Nothing sent yet' : filter === 'skip' ? 'Nothing set aside' : 'Nothing waiting'}</span>
          <span className="stamp">{filter === 'todo' ? 'Drafts appear here when ai-job-search shortlists them.' : 'Tick a draft once you have sent it.'}</span>
        </div>
      ) : (
        <ul className="border-t-2 border-engrave">
          {shown.map(e => {
            const a = e.app;
            const off = e.state !== 'todo';
            const canUnsend = e.state !== 'sent' || a.status === 'Applied';
            return (
              <li key={a.id} className="grid grid-cols-[44px_1fr] gap-3 border-b-2 border-engrave py-3">
                <button
                  role="checkbox"
                  aria-checked={e.state === 'sent'}
                  aria-label={`${e.state === 'sent' ? 'Unmark' : 'Mark sent'}: ${a.companyName}, ${a.positionTitle}`}
                  className="min-h-[44px] flex items-start justify-center pt-1 disabled:opacity-35"
                  disabled={isMentorView || busy === a.id || e.state === 'skip' || !canUnsend}
                  onClick={() => toggleSent(e)}
                >
                  <span className="tick" data-on={e.state === 'sent'} />
                </button>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-lg font-semibold min-w-0 [overflow-wrap:anywhere]">
                      <span className={off ? 'text-ink-dim line-through decoration-2 decoration-slate' : 'text-ink'}>{a.companyName}</span>{' '}
                      <span className="text-ink-dim font-medium">{a.positionTitle}</span>
                    </h3>
                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="stamp">P(INT)</span>
                      <span className={`text-xl font-semibold ${off || e.p < 0.02 ? 'text-ink-dim' : 'text-arc'}`}>{e.p.toFixed(3)}</span>
                    </div>
                  </div>

                  <div className="stamp flex flex-wrap gap-x-4 gap-y-1">
                    <span className={a.effort === 'Full' ? 'text-arc' : a.effort === 'Light' ? 'text-ink' : ''}>{a.effort.toUpperCase()}</span>
                    {a.fitScore != null && <span>FIT {a.fitScore}</span>}
                    {a.roleType && <span>{a.roleType}</span>}
                    {a.location && <span>{a.location}</span>}
                    {e.state === 'sent' && <span className="text-arc">SENT {shortDate(e.movedAt)}</span>}
                    {e.state === 'skip' && <span>NOT APPLYING {shortDate(e.movedAt)}</span>}
                  </div>

                  {(a.salaryRange || a.salaryAsk) && (
                    <div className="font-mono text-min tracking-stamp flex flex-wrap gap-x-4 gap-y-1">
                      {a.salaryRange && (
                        <span className={`text-ink ${a.salaryEstimated ? 'underline decoration-dotted decoration-ink-dim underline-offset-4' : ''}`}>{a.salaryRange}</span>
                      )}
                      {a.salaryRange && <span className="text-ink-dim">{a.salaryEstimated ? 'ESTIMATE' : 'POSTED'}</span>}
                      {a.salaryAsk != null && <span className="text-gold">ASK {euros(a.salaryAsk)}</span>}
                    </div>
                  )}

                  {a.headsUp && e.state === 'todo' && (
                    <div className="verdict" style={{ ['--c' as any]: 'var(--gold)' }}>
                      <div className="font-mono text-min uppercase tracking-stamp text-gold">Check first</div>
                      <p className="text-ink text-[0.9375rem]">{a.headsUp}</p>
                    </div>
                  )}

                  {a.notes && <p className="text-ink-dim text-[0.9375rem] max-w-[68ch]">{a.notes}</p>}

                  <div className="flex flex-wrap gap-2 items-center">
                    {a.jobUrl && (
                      <a className="btn btn-primary btn-sm gap-2" href={a.jobUrl} target="_blank" rel="noopener noreferrer">
                        Open posting <ExternalLink className="w-4 h-4" strokeWidth={1.6} />
                      </a>
                    )}
                    {a.cvFile && (
                      <button className="btn btn-quiet btn-sm gap-2 max-w-full" title="Copy file name" onClick={() => copy('CV', a.cvFile!)}>
                        <Copy className="w-4 h-4 flex-none" strokeWidth={1.6} /><span className="truncate">CV: {fileName(a.cvFile)}</span>
                      </button>
                    )}
                    {a.coverLetterFile && (
                      <button className="btn btn-quiet btn-sm gap-2 max-w-full" title="Copy file name" onClick={() => copy('Cover', a.coverLetterFile!)}>
                        <Copy className="w-4 h-4 flex-none" strokeWidth={1.6} /><span className="truncate">Cover: {fileName(a.coverLetterFile)}</span>
                      </button>
                    )}
                    {!isMentorView && e.state !== 'sent' && (
                      <button className="btn btn-quiet btn-sm" disabled={busy === a.id} onClick={() => toggleSkip(e)}>
                        {e.state === 'skip' ? 'Back in queue' : 'Not applying'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="instrument">
        <summary className="label cursor-pointer min-h-[44px] flex items-center">P(interview)</summary>
        <p className="stamp mt-2">
          p₀ = {model.base.interviews}/{model.base.sent} = {model.base.p.toFixed(3)}. Per segment (tier, role type, fit band): p̂ = (i + 10·p₀) / (n + 10). Per draft: geometric mean of its three p̂. Expected interviews = Σp.
        </p>
        <div className="overflow-x-auto mt-3">
          <table className="table">
            <thead><tr><th>Segment</th><th className="n">i</th><th className="n">n</th><th className="n">p̂</th></tr></thead>
            <tbody>
              {model.segments.map(s => (
                <tr key={`${s.kind}:${s.name}`}>
                  <td className="text-ink-dim">{s.kind} · {s.name}</td>
                  <td className="n">{s.interviews}</td>
                  <td className="n">{s.sent}</td>
                  <td className="n">{s.p.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

export default Queue;
