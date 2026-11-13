import React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

import { PALETTE as P, stageHex } from '../../utils/statusStyle';

interface StatusData {
  name: string;
  value: number;
  percentage: number;
  [key: string]: any;
}

interface StatusDistributionChartProps {
  statusData: StatusData[];
}

const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({ statusData }) => {
  // Colors for status chart
  // One colour per stage (utils/statusStyle.ts), the deeper fill tones.
  const colorOf = (status: string) => stageHex(status, true);

  return (
    <div className="instrument">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="label">Application Status Distribution</h2>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              isAnimationActive={false}
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colorOf(entry.name)} stroke={P.panel} strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${Number(value) || 0} applications (${statusData.find(d => d.name === name)?.percentage || 0}%)`,
                name || ''
              ]}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {statusData.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5" style={{ backgroundColor: colorOf(item.name) }}></div>
            <span className="text-ink-dim">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusDistributionChart;