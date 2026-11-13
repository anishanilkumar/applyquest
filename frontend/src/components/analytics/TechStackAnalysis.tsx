import React, { useMemo } from 'react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { JobApplication } from '../../types';
import { PALETTE as P } from '../../utils/statusStyle';

interface TechStackAnalysisProps {
  applications: JobApplication[];
}

const TechStackAnalysis: React.FC<TechStackAnalysisProps> = ({ applications }) => {
  const techData = useMemo(() => {
    const techMap = new Map<string, { count: number; offers: number }>();

    applications.forEach(app => {
      if (app.techStack) {
        // Split tech stack by common separators and clean up
        const techs = app.techStack.split(/[,/&+]+/).map(tech => tech.trim());

        techs.forEach(tech => {
          if (tech && tech.length > 1) { // Filter out empty/short strings
            const existing = techMap.get(tech) || { count: 0, offers: 0 };
            existing.count++;
            if (app.status === 'Offer') {
              existing.offers++;
            }
            techMap.set(tech, existing);
          }
        });
      }
    });

    return Array.from(techMap.entries())
      .map(([tech, data]) => ({
        tech,
        count: data.count,
        offers: data.offers,
        successRate: data.count > 0 ? Math.round((data.offers / data.count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12); // Top 12 technologies
  }, [applications]);

  return (
    <div className="instrument">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="label">Tech Stack Analysis</h2>
      </div>

      <div className="space-y-4">
        {techData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-ink-dim">No tech stack data available</p>
          </div>
        ) : (
          <>
            {/* Top Tech Stack Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techData} layout="vertical">
                  <CartesianGrid />
                  <XAxis type="number" />
                  <YAxis dataKey="tech" type="category" width={80} fontSize={12} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'count' ? `${value || 0} applications` : `${value || 0} offers`,
                      name === 'count' ? 'Applications' : 'Offers'
                    ]}
                  />
                  {/* Applications in the deeper arc, offers in green. */}
                  <Bar dataKey="count" fill={P.c1} isAnimationActive={false} />
                  <Bar dataKey="offers" fill={P.go} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tech Stack List */}
            <div className="grid grid-cols-2 gap-2">
              {techData.map((item, index) => (
                <div key={item.tech} className="flex items-center gap-2 p-2 bg-panel-lit">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{item.tech}</div>
                    <div className="stamp">{item.count} apps · {item.successRate}% success</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t-2 border-engrave text-center">
              <p className="text-xs text-ink-dim">
                Technologies from your job applications ranked by frequency and success rates
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TechStackAnalysis;