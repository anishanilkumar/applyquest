import React, { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { ApplicationEffort, JobApplication } from '../../types';
import { hasPositiveResponse, hasReachedInterview } from '../../utils/stages';

interface EffortComparisonProps {
  applications: JobApplication[];
}

// Does the effort put into an application pay off? One column per effort
// level; Unknown is left out of the comparison and only counted.
const COMPARED: { effort: ApplicationEffort; accent: string }[] = [
  { effort: 'Full', accent: 'text-indigo-600' },
  { effort: 'Light', accent: 'text-sky-600' },
  { effort: 'Generic', accent: 'text-gray-600' },
];

const EffortComparison: React.FC<EffortComparisonProps> = ({ applications }) => {
  const groups = useMemo(() => {
    const build = (apps: JobApplication[]) => {
      const total = apps.length;
      const positive = apps.filter(hasPositiveResponse).length;
      const interviewed = apps.filter(hasReachedInterview).length;
      const ghosted = apps.filter(a => a.status === 'Ghosted').length;
      return {
        total,
        positiveRate: total > 0 ? Math.round((positive / total) * 100) : 0,
        interviewRate: total > 0 ? Math.round((interviewed / total) * 100) : 0,
        ghostRate: total > 0 ? Math.round((ghosted / total) * 100) : 0,
      };
    };
    return Object.fromEntries(
      COMPARED.map(({ effort }) => [effort, build(applications.filter(a => a.effort === effort))])
    ) as Record<ApplicationEffort, ReturnType<typeof build>>;
  }, [applications]);
  const unknown = applications.filter(a => a.effort === 'Unknown').length;

  const metrics: { key: 'positiveRate' | 'interviewRate' | 'ghostRate'; label: string; good: 'high' | 'low' }[] = [
    { key: 'positiveRate', label: 'Positive response', good: 'high' },
    { key: 'interviewRate', label: 'Interview rate', good: 'high' },
    { key: 'ghostRate', label: 'Ghosted', good: 'low' },
  ];

  const Column: React.FC<{ title: string; data: typeof groups.Full; accent: string }> = ({ title, data, accent }) => (
    <div className="flex-1">
      <div className="text-center mb-3">
        <div className={`text-sm font-semibold ${accent}`}>{title}</div>
        <div className="text-xs text-gray-400">{data.total} apps</div>
      </div>
      <div className="space-y-3">
        {metrics.map(m => (
          <div key={m.key}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{m.label}</span>
              <span className="font-bold text-gray-800">{data[m.key]}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${m.good === 'low' ? 'bg-gray-400' : 'bg-green-500'}`}
                style={{ width: `${data[m.key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-3">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Effort vs Outcome</h2>
          <p className="text-xs text-gray-500">
            Is tailoring worth the effort?{unknown > 0 && ` ${unknown} not yet classified.`}
          </p>
        </div>
      </div>

      {COMPARED.every(({ effort }) => groups[effort].total === 0) ? (
        <div className="text-center py-8 text-gray-500">No classified applications yet</div>
      ) : (
        <div className="flex gap-6">
          {COMPARED.map(({ effort, accent }, i) => (
            <React.Fragment key={effort}>
              {i > 0 && <div className="w-px bg-gray-200" />}
              <Column title={effort} data={groups[effort]} accent={accent} />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default EffortComparison;
