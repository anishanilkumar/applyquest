import React from 'react';

import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PALETTE as P } from '../../utils/statusStyle';

interface TimelineData {
  date: string;
  applications: number;
  responses: number;
}

interface ApplicationsTimelineChartProps {
  timelineData: TimelineData[];
  granularity: string;
}

const ApplicationsTimelineChart: React.FC<ApplicationsTimelineChartProps> = ({ timelineData, granularity }) => {
  const hasData = timelineData.some(d => d.applications > 0);

  return (
    <div className="instrument">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h2 className="label">Applications Over Time</h2>
          <p className="text-xs text-ink-dim">Grouped by {granularity}</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-80 flex items-center justify-center text-ink-dim">
          No applications in this period
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {/* Applications as a filled area; positive responses as a line on top
                — responses are a SUBSET of applications, so they must NOT stack
                (the old chart used two separate stackIds and double-counted). */}
            <ComposedChart data={timelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" fontSize={12} tickMargin={8} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip
                formatter={(value, name) => [value, name === 'applications' ? 'Applications' : 'Positive responses']}
              />
              {/* Straight segments, no smoothing: a spline invents values between
                  the months. Applications are arc over a flat, deeper fill;
                  responses, the second series, are gold. */}
              <Area
                type="linear"
                dataKey="applications"
                stroke={P.arc}
                fill={P.c1}
                fillOpacity={0.25}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="responses"
                stroke={P.gold}
                strokeWidth={2}
                dot={{ r: 3, fill: P.gold, stroke: P.gold }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-6 stamp uppercase">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-arc"></div>
          <span>Applications</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-gold"></div>
          <span>Positive responses</span>
        </div>
      </div>
    </div>
  );
};

export default ApplicationsTimelineChart;
