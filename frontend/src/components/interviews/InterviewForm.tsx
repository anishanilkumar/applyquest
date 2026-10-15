import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Interview, JobApplication } from '../../types';

const STAGES = ['Phone Screen', 'Technical Round 1', 'Technical Round 2', 'Final Round', 'Other'];

// datetime-local works in the viewer's local time without an offset; convert
// both ways so what is stored always carries one.
const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(value).toISOString();

interface InterviewFormProps {
  applications: JobApplication[];
  initial?: Interview;
  initialDate?: Date;
  onSave: (data: Omit<Interview, 'id'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const InterviewForm: React.FC<InterviewFormProps> = ({ applications, initial, initialDate, onSave, onDelete, onClose }) => {
  const defaultStart = useMemo(() => {
    if (initial) return toLocalInput(initial.startsAt);
    const d = initialDate ? new Date(initialDate) : new Date();
    d.setHours(initialDate ? 10 : d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d.toISOString());
  }, [initial, initialDate]);
  const initialMinutes = initial?.endsAt
    ? Math.round((new Date(initial.endsAt).getTime() - new Date(initial.startsAt).getTime()) / 60_000)
    : 30;

  const [form, setForm] = useState({
    applicationId: initial?.applicationId ?? '',
    startsAt: defaultStart,
    minutes: initialMinutes,
    stage: initial?.stage ?? 'Phone Screen',
    title: initial?.title ?? '',
    meetingUrl: initial?.meetingUrl ?? '',
    interviewers: initial?.interviewers ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  // Live applications first; closed ones are still selectable for the record.
  const choices = useMemo(() => {
    const closed = (a: JobApplication) => ['Rejected', 'Ghosted', 'Shortlisted'].includes(a.status);
    return [...applications].sort((a, b) =>
      Number(closed(a)) - Number(closed(b)) || a.companyName.localeCompare(b.companyName));
  }, [applications]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: field === 'minutes' ? Number(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const startsAt = fromLocalInput(form.startsAt);
      await onSave({
        applicationId: form.applicationId,
        startsAt,
        endsAt: new Date(new Date(startsAt).getTime() + form.minutes * 60_000).toISOString(),
        stage: form.stage,
        title: form.title || undefined,
        meetingUrl: form.meetingUrl || undefined,
        interviewers: form.interviewers || undefined,
        notes: form.notes || undefined,
        calendarEventId: initial?.calendarEventId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const input = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">{initial ? 'Edit interview' : 'Add interview'}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
        </div>

        <label className="block text-sm text-gray-700">
          Application
          <select required disabled={!!initial} value={form.applicationId} onChange={set('applicationId')} className={input}>
            <option value="" disabled>Choose…</option>
            {choices.map(a => (
              <option key={a.id} value={a.id}>{a.companyName} — {a.positionTitle} ({a.status})</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
          <label className="block text-sm text-gray-700">
            Starts
            <input type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} className={input} />
          </label>
          <label className="block text-sm text-gray-700">
            Minutes
            <input type="number" min={5} max={480} step={5} required value={form.minutes} onChange={set('minutes')} className={input} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm text-gray-700">
            Stage
            <select value={form.stage} onChange={set('stage')} className={input}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm text-gray-700">
            Title <span className="text-gray-400">(optional)</span>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Talent Talk" className={input} />
          </label>
        </div>

        <label className="block text-sm text-gray-700">
          Meeting link <span className="text-gray-400">(optional)</span>
          <input type="url" value={form.meetingUrl} onChange={set('meetingUrl')} placeholder="https://meet.google.com/…" className={input} />
        </label>
        <label className="block text-sm text-gray-700">
          Interviewers <span className="text-gray-400">(optional)</span>
          <input value={form.interviewers} onChange={set('interviewers')} placeholder="Name (Title), …" className={input} />
        </label>
        <label className="block text-sm text-gray-700">
          Notes <span className="text-gray-400">(optional)</span>
          <textarea value={form.notes} onChange={set('notes')} rows={2} className={input} />
        </label>

        <div className="flex gap-2 pt-2">
          {initial && onDelete && (
            <button type="button" onClick={async () => { await onDelete(); onClose(); }}
              className="px-4 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50">Delete</button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InterviewForm;
