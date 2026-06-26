import React, { useMemo } from 'react';
import { Compass } from 'lucide-react';
import { JobApplication } from '../../types';
import { hasPositiveResponse } from '../../utils/stages';

interface SourceEffectivenessProps {
  applications: JobApplication[];
}

// Where applications come from and how well each channel actually performs.
// Replaces the old keyword-guessed "industry" analysis with a real field
// (jobBoardSource) the user actually fills in.
const SourceEffectiveness: React.FC<SourceEffectivenessProps> = ({ applications }) => {
  const rows = useMemo(() => {
    const map = new Map<string, { total: number; positive: number; ghosted: number }>();
    applications.forEach(app => {
      const key = (app.jobBoardSource || '').trim() || 'Unknown';
      const entry = map.get(key) || { total: 0, positive: 0, ghosted: 0 };
      entry.total++;
      if (hasPositiveResponse(app)) entry.positive++;
      if (app.status === 'Ghosted') entry.ghosted++;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([source, d]) => ({
        source,
        total: d.total,
        positiveRate: d.total > 0 ? Math.round((d.positive / d.total) * 100) : 0,
        ghostRate: d.total > 0 ? Math.round((d.ghosted / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [applications]);

  const maxTotal = Math.max(1, ...rows.map(r => r.total));

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full p-3">
          <Compass className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Source Effectiveness</h2>
          <p className="text-xs text-gray-500">Which channels actually get responses</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No applications yet</div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.source} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{r.source}</span>
                <span className="text-sm text-gray-500">{r.total} apps</span>
              </div>
              {/* Volume bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${(r.total / maxTotal) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-600 font-medium">{r.positiveRate}% responded</span>
                <span className="text-gray-500">{r.ghostRate}% ghosted</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceEffectiveness;
