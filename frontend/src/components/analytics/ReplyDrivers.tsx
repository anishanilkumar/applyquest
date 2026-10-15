import React, { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { JobApplication } from '../../types';
import { hasPositiveResponse, hasReachedInterview } from '../../utils/stages';

interface ReplyDriversProps {
  applications: JobApplication[];
}

// The verdict bands of ai-job-search's fit evaluation (04-job-evaluation.md).
const FIT_BANDS: { label: string; min: number }[] = [
  { label: 'Strong (75+)', min: 75 },
  { label: 'Good (60–74)', min: 60 },
  { label: 'Moderate (45–59)', min: 45 },
  { label: 'Weak (<45)', min: 0 },
];

const fitBand = (app: JobApplication): string =>
  app.fitScore === undefined
    ? 'Unscored'
    : FIT_BANDS.find(b => app.fitScore! >= b.min)!.label;

// Role types arrive in loose spellings ("Full-Stack", "fullstack", "ML/AI"),
// so fold the common variants together before grouping.
const roleGroup = (app: JobApplication): string => {
  const raw = (app.roleType ?? '').toLowerCase().replace(/[\s-]/g, '');
  if (!raw) return 'Unknown';
  if (/(ai|ml)/.test(raw) && /fullstack/.test(raw)) return 'AI + Fullstack';
  if (/(^|\/)(ai|ml)|machinelearning/.test(raw)) return 'AI/ML';
  if (raw.includes('fullstack')) return 'Fullstack';
  if (raw.includes('backend')) return 'Backend';
  if (raw.includes('frontend')) return 'Frontend';
  return app.roleType!;
};

const DIMENSIONS = {
  fit: {
    label: 'Fit score',
    key: fitBand,
    order: [...FIT_BANDS.map(b => b.label), 'Unscored'],
  },
  role: { label: 'Role type', key: roleGroup, order: [] as string[] },
  cover: {
    label: 'Cover letter',
    key: (app: JobApplication) => (app.coverLetterFile ? 'With cover letter' : 'CV only'),
    order: ['With cover letter', 'CV only'],
  },
};
type Dimension = keyof typeof DIMENSIONS;

// Which applications get answered? Counts are shown alongside every rate:
// with a handful of replies in total, "1 of 4" and "25%" read very differently.
const ReplyDrivers: React.FC<ReplyDriversProps> = ({ applications }) => {
  const [dimension, setDimension] = useState<Dimension>('fit');

  const rows = useMemo(() => {
    const { key, order } = DIMENSIONS[dimension];
    const groups = new Map<string, JobApplication[]>();
    applications.forEach(app => {
      const k = key(app);
      groups.set(k, [...(groups.get(k) ?? []), app]);
    });
    const rank = (label: string) => (order.includes(label) ? order.indexOf(label) : order.length);
    return Array.from(groups.entries())
      .map(([label, apps]) => ({
        label,
        total: apps.length,
        positive: apps.filter(hasPositiveResponse).length,
        interviewed: apps.filter(hasReachedInterview).length,
      }))
      .sort((a, b) => rank(a.label) - rank(b.label) || b.total - a.total);
  }, [applications, dimension]);

  const maxRate = Math.max(...rows.map(r => (r.total ? r.positive / r.total : 0)), 0.01);

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full p-3">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">What Gets Replies</h2>
            <p className="text-xs text-gray-500">
              Positive responses and interviews, grouped by what went into the application
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(Object.keys(DIMENSIONS) as Dimension[]).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDimension(d)}
              className={`px-3 py-1.5 ${d === dimension ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {DIMENSIONS[d].label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No submitted applications yet</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,10rem)_1fr_auto_auto] gap-x-4 text-xs text-gray-400 px-1">
            <span />
            <span>Positive response</span>
            <span className="text-right w-20">Replies</span>
            <span className="text-right w-20">Interviews</span>
          </div>
          {rows.map(r => {
            const rate = r.total ? r.positive / r.total : 0;
            return (
              <div key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto_auto] gap-x-4 items-center px-1">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{r.label}</div>
                  <div className="text-xs text-gray-400">{r.total} sent</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(rate / maxRate) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-9 text-right">{Math.round(rate * 100)}%</span>
                </div>
                <span className="text-sm text-gray-700 text-right w-20 tabular-nums">{r.positive} of {r.total}</span>
                <span className="text-sm text-gray-700 text-right w-20 tabular-nums">{r.interviewed}</span>
              </div>
            );
          })}
          <p className="text-xs text-gray-400 pt-2">
            Bars are scaled to the best group. Groups of a few applications swing on a single reply.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReplyDrivers;
