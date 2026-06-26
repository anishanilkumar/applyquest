import React from 'react';
import {
  Briefcase,
  MessageSquare,
  Ghost,
  XCircle,
  Users,
  Clock
} from 'lucide-react';

interface MetricsData {
  total: number;
  positiveResponded: number;
  positiveResponseRate: number;
  ghosted: number;
  ghostRate: number;
  rejected: number;
  rejectionRate: number;
  interviewed: number;
  interviewRate: number;
  avgDaysToOutcome: number | null;
}

interface KeyMetricsCardsProps {
  metrics: MetricsData;
}

const KeyMetricsCards: React.FC<KeyMetricsCardsProps> = ({ metrics }) => {
  // Each card states a count plus the honest rate it represents. "Positive
  // response" deliberately excludes rejections/ghosting (see utils/stages.ts).
  const cards = [
    {
      icon: Briefcase,
      value: `${metrics.total}`,
      sub: 'applications',
      label: 'Total Applications',
      tint: 'blue',
    },
    {
      icon: MessageSquare,
      value: `${metrics.positiveResponseRate}%`,
      sub: `${metrics.positiveResponded} engaged`,
      label: 'Positive Response',
      tint: 'green',
    },
    {
      icon: Users,
      value: `${metrics.interviewRate}%`,
      sub: `${metrics.interviewed} reached`,
      label: 'Interview Rate',
      tint: 'amber',
    },
    {
      icon: Ghost,
      value: `${metrics.ghostRate}%`,
      sub: `${metrics.ghosted} silent`,
      label: 'Ghosted',
      tint: 'gray',
    },
    {
      icon: XCircle,
      value: `${metrics.rejectionRate}%`,
      sub: `${metrics.rejected} rejected`,
      label: 'Rejected',
      tint: 'red',
    },
    {
      icon: Clock,
      value: metrics.avgDaysToOutcome != null ? `${metrics.avgDaysToOutcome}d` : '—',
      sub: 'create → outcome',
      label: 'Avg Time to Outcome',
      tint: 'purple',
    },
  ] as const;

  const tints: Record<string, { bg: string; icon: string; value: string }> = {
    blue: { bg: 'bg-blue-100', icon: 'text-blue-600', value: 'text-blue-600' },
    green: { bg: 'bg-green-100', icon: 'text-green-600', value: 'text-green-600' },
    amber: { bg: 'bg-amber-100', icon: 'text-amber-600', value: 'text-amber-600' },
    gray: { bg: 'bg-gray-200', icon: 'text-gray-600', value: 'text-gray-700' },
    red: { bg: 'bg-red-100', icon: 'text-red-600', value: 'text-red-600' },
    purple: { bg: 'bg-purple-100', icon: 'text-purple-600', value: 'text-purple-600' },
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(({ icon: Icon, value, sub, label, tint }) => {
        const c = tints[tint];
        return (
          <div key={label} className="bg-white rounded-xl p-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className={`${c.bg} rounded-full p-2 flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${c.icon}`} />
              </div>
              <div className="min-w-0">
                <div className={`text-2xl font-bold ${c.value} leading-tight`}>{value}</div>
                <div className="text-[11px] text-gray-400 truncate">{sub}</div>
              </div>
            </div>
            <div className="text-xs font-medium text-gray-600 mt-2">{label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default KeyMetricsCards;
