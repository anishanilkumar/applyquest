import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-full p-3">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Applications Over Time</h2>
          <p className="text-xs text-gray-500">Grouped by {granularity}</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-80 flex items-center justify-center text-gray-500">
          No applications in this period
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {/* Applications as a filled area; positive responses as a line on top
                — responses are a SUBSET of applications, so they must NOT stack
                (the old chart used two separate stackIds and double-counted). */}
            <ComposedChart data={timelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={12} tickMargin={8} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip
                formatter={(value, name) => [value, name === 'applications' ? 'Applications' : 'Positive responses']}
              />
              <Area
                type="monotone"
                dataKey="applications"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="responses"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-gray-600">Applications</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-gray-600">Positive responses</span>
        </div>
      </div>
    </div>
  );
};

export default ApplicationsTimelineChart;
