import React from 'react';
import { Lightbulb } from 'lucide-react';

interface InsightsStripProps {
  insights: string[];
}

// A short list of plain-English, computed takeaways. The page passes in only
// the insights that are statistically meaningful (enough data to back them up),
// so this renders nothing when there's not enough to say.
const InsightsStrip: React.FC<InsightsStripProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-amber-900">What the data says</h3>
      </div>
      <ul className="space-y-1.5">
        {insights.map((text, i) => (
          <li key={i} className="text-sm text-amber-900/90 flex gap-2">
            <span className="text-amber-400">•</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InsightsStrip;
