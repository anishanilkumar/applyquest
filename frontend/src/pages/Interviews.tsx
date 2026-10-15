import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { interviewService } from '../services/api';
import { Interview } from '../types';
import InterviewForm from '../components/interviews/InterviewForm';
import { byDay, countdown, dayKey, endOf, isInProgress, upcomingInterviews, whenLabel } from '../utils/interviews';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Monday-first grid of whole weeks covering the month.
const monthGrid = (month: Date): Date[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells: Date[] = [];
  for (let d = new Date(start); d <= last || cells.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
    cells.push(new Date(d));
  }
  return cells;
};

type Editing = { interview?: Interview; date?: Date } | null;

const Interviews: React.FC = () => {
  const { interviews, setInterviews, applications, isMentorView } = useAppContext();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editing, setEditing] = useState<Editing>(null);

  const appById = useMemo(() => new Map(applications.map(a => [a.id, a])), [applications]);
  const days = useMemo(() => byDay(interviews), [interviews]);
  const upcoming = useMemo(() => upcomingInterviews(interviews), [interviews]);
  const past = useMemo(() => {
    const now = Date.now();
    return interviews.filter(i => endOf(i) <= now)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [interviews]);
  const today = dayKey(new Date());

  const company = (i: Interview) => appById.get(i.applicationId)?.companyName ?? 'Unknown';

  const save = async (data: Omit<Interview, 'id'>) => {
    try {
      if (editing?.interview) {
        const { applicationId, ...rest } = data;
        const updated = await interviewService.update(editing.interview.id, rest);
        setInterviews(prev => prev.map(i => (i.id === updated.id ? updated : i)));
        toast.success('Interview updated');
      } else {
        const created = await interviewService.create(data);
        setInterviews(prev => [...prev.filter(i => i.id !== created.id), created]);
        toast.success('Interview added');
      }
    } catch (error) {
      toast.error('Could not save the interview.');
      throw error;
    }
  };

  const remove = async () => {
    if (!editing?.interview) return;
    const id = editing.interview.id;
    await interviewService.delete(id);
    setInterviews(prev => prev.filter(i => i.id !== id));
    toast.success('Interview removed');
  };

  const Row: React.FC<{ i: Interview }> = ({ i }) => {
    const app = appById.get(i.applicationId);
    return (
      <li className="py-3 flex items-center gap-4">
        <button type="button" disabled={isMentorView} onClick={() => setEditing({ interview: i })}
          className="min-w-0 flex-1 text-left flex items-center gap-4 disabled:cursor-default">
          <div className="w-28 shrink-0 text-sm font-semibold text-gray-800">
            {whenLabel(i)}
            <div className="text-xs font-normal text-gray-500">{endOf(i) > Date.now() ? countdown(i) : new Date(i.startsAt).getFullYear()}</div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">
              {app?.companyName ?? 'Unknown application'}
              {(i.title || i.stage) && <span className="font-normal text-gray-500"> · {i.title ?? i.stage}</span>}
            </div>
            <div className="text-xs text-gray-500 truncate">{app?.positionTitle}{i.interviewers && ` · ${i.interviewers}`}</div>
          </div>
        </button>
        {i.meetingUrl && endOf(i) > Date.now() && (
          <a href={i.meetingUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
            <Video className="w-4 h-4" /> Join
          </a>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100" title="Previous month"><ChevronLeft className="w-5 h-5" /></button>
            <h1 className="text-2xl font-bold text-gray-800 w-48 text-center">
              {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h1>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100" title="Next month"><ChevronRight className="w-5 h-5" /></button>
            <button type="button" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
              className="ml-2 text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Today</button>
          </div>
          {!isMentorView && (
            <button type="button" onClick={() => setEditing({})}
              className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700">
              <Plus className="w-4 h-4" /> Add interview
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[42rem] border-t border-l border-gray-200">
            {WEEKDAYS.map(w => (
              <div key={w} className="border-r border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 px-2 py-1">{w}</div>
            ))}
            {monthGrid(month).map(d => {
              const key = dayKey(d);
              const inMonth = d.getMonth() === month.getMonth();
              const items = days.get(key) ?? [];
              return (
                <div key={key}
                  onClick={() => !isMentorView && setEditing({ date: d })}
                  className={`border-r border-b border-gray-200 min-h-[5.5rem] p-1.5 ${inMonth ? 'bg-white' : 'bg-gray-50'} ${isMentorView ? '' : 'cursor-pointer hover:bg-blue-50/40'}`}>
                  <div className={`text-xs mb-1 ${key === today ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-semibold' : inMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {items.map(i => (
                      <button key={i.id} type="button"
                        onClick={e => { e.stopPropagation(); if (!isMentorView) setEditing({ interview: i }); }}
                        title={`${company(i)} · ${i.title ?? i.stage ?? ''}`}
                        className={`w-full text-left truncate text-xs px-1.5 py-0.5 rounded ${isInProgress(i) ? 'bg-red-100 text-red-800' : endOf(i) <= Date.now() ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-900'}`}>
                        <span className="font-semibold">{time(i.startsAt)}</span> {company(i)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Upcoming</h2>
          {upcoming.length === 0
            ? <p className="text-sm text-gray-500">Nothing scheduled.</p>
            : <ul className="divide-y divide-gray-100">{upcoming.map(i => <Row key={i.id} i={i} />)}</ul>}
        </div>
        <div className="bg-white rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Past</h2>
          {past.length === 0
            ? <p className="text-sm text-gray-500">None yet.</p>
            : <ul className="divide-y divide-gray-100">{past.slice(0, 10).map(i => <Row key={i.id} i={i} />)}</ul>}
        </div>
      </div>

      {editing && (
        <InterviewForm
          applications={applications}
          initial={editing.interview}
          initialDate={editing.date}
          onSave={save}
          onDelete={editing.interview ? remove : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Interviews;
