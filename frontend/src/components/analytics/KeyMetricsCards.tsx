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

  // Each tint is a meaning, not a hue: arc for the live or good figures, gold
  // for the ones that need attention, ink for plain counts.
  const tints: Record<string, string> = {
    blue: 'text-arc',
    green: 'text-arc',
    amber: 'text-gold',
    gray: 'text-ink',
    red: 'text-gold',
    purple: 'text-ink',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(({ value, sub, label, tint }) => (
        <div key={label} className="instrument">
          <span className="label block truncate">{label}</span>
          <div className={`readout mt-2 ${tints[tint]}`}>{value}</div>
          <div className="stamp mt-1 truncate">{sub}</div>
        </div>
      ))}
    </div>
  );
};

export default KeyMetricsCards;
