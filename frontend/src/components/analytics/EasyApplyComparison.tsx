import React, { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { JobApplication } from '../../types';
import { hasPositiveResponse, hasReachedInterview } from '../../utils/stages';

interface EasyApplyComparisonProps {
  applications: JobApplication[];
}

// Does spending time on a tailored ("manual") application pay off versus
// one-click easy-apply? Both buckets come straight from the easyApply flag.
const EasyApplyComparison: React.FC<EasyApplyComparisonProps> = ({ applications }) => {
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
    return {
      manual: build(applications.filter(a => !a.easyApply)),
      easy: build(applications.filter(a => a.easyApply)),
    };
  }, [applications]);

  const metrics: { key: 'positiveRate' | 'interviewRate' | 'ghostRate'; label: string; good: 'high' | 'low' }[] = [
    { key: 'positiveRate', label: 'Positive response', good: 'high' },
    { key: 'interviewRate', label: 'Interview rate', good: 'high' },
    { key: 'ghostRate', label: 'Ghosted', good: 'low' },
  ];

  const Column: React.FC<{ title: string; data: typeof groups.manual; accent: string }> = ({ title, data, accent }) => (
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
          <h2 className="text-xl font-bold text-gray-800">Easy-Apply vs Manual</h2>
          <p className="text-xs text-gray-500">Is tailoring worth the effort?</p>
        </div>
      </div>

      {groups.manual.total === 0 && groups.easy.total === 0 ? (
        <div className="text-center py-8 text-gray-500">No applications yet</div>
      ) : (
        <div className="flex gap-6">
          <Column title="Manual" data={groups.manual} accent="text-orange-600" />
          <div className="w-px bg-gray-200" />
          <Column title="Easy Apply" data={groups.easy} accent="text-blue-600" />
        </div>
      )}
    </div>
  );
};

export default EasyApplyComparison;
