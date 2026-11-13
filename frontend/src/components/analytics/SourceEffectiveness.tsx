import React, { useMemo } from 'react';

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
    <div className="instrument">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h2 className="label">Source Effectiveness</h2>
          <p className="text-xs text-ink-dim">Which channels actually get responses</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-ink-dim">No applications yet</div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.source} className="p-3 bg-panel-lit rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink">{r.source}</span>
                <span className="text-sm text-ink-dim">{r.total} apps</span>
              </div>
              {/* Volume bar */}
              <div className="h-2 bg-engrave rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-arc rounded-full"
                  style={{ width: `${(r.total / maxTotal) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-arc font-medium">{r.positiveRate}% responded</span>
                <span className="text-ink-dim">{r.ghostRate}% ghosted</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceEffectiveness;
