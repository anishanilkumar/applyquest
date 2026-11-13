import React from 'react';

interface InsightsStripProps {
  insights: string[];
}

// A short list of plain-English, computed takeaways. The page passes in only
// the insights that are statistically meaningful (enough data to back them up),
// so this renders nothing when there's not enough to say.
const InsightsStrip: React.FC<InsightsStripProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  // A callout with a gold rule: worth reading, not an alarm.
  return (
    <div className="verdict" style={{ ['--c' as any]: 'var(--gold)' }}>
      <h3 className="label mb-2">What the data says</h3>
      <ul className="space-y-1.5">
        {insights.map((text, i) => (
          <li key={i} className="text-sm text-ink flex gap-2">
            <span className="text-gold" aria-hidden="true">·</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InsightsStrip;
