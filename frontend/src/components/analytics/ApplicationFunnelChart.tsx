import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { JobApplication } from '../../types';
import { hasReachedInterview, hasReachedFinalRound, hasReachedOffer } from '../../utils/stages';

interface ApplicationFunnelChartProps {
  applications: JobApplication[];
}

const ApplicationFunnelChart: React.FC<ApplicationFunnelChartProps> = ({ applications }) => {
  const funnelData = useMemo(() => {
    // Calculate comprehensive funnel data including drop-offs
    const totalApplied = applications.length;

    // Applications that received any response
    const responded = applications.filter(app =>
      !['Applied', 'Ghosted'].includes(app.status)
    ).length;

    // Applications that ever reached interview stages
    const interviewed = applications.filter(hasReachedInterview).length;

    // Applications that ever reached the final round
    const finalRound = applications.filter(hasReachedFinalRound).length;

    // Applications that received offers
    const offers = applications.filter(hasReachedOffer).length;

    // Calculate drop-offs at each stage
    const ghosted = applications.filter(app => app.status === 'Ghosted').length;
    const rejected = applications.filter(app => app.status === 'Rejected').length;

    // Calculate rates
    const responseRate = totalApplied > 0 ? Math.round((responded / totalApplied) * 100) : 0;
    const interviewRate = responded > 0 ? Math.round((interviewed / responded) * 100) : 0;
    const finalRoundRate = interviewed > 0 ? Math.round((finalRound / interviewed) * 100) : 0;
    const offerRate = finalRound > 0 ? Math.round((offers / finalRound) * 100) : 0;

    return {
      stages: [
        {
          name: 'Applied',
          count: totalApplied,
          conversionRate: 100,
          color: '#3B82F6',
          description: 'Total applications submitted'
        },
        {
          name: 'Response',
          count: responded,
          conversionRate: responseRate,
          color: '#8B5CF6',
          description: `${responseRate}% response rate`
        },
        {
          name: 'Interview',
          count: interviewed,
          conversionRate: interviewRate,
          color: '#F59E0B',
          description: `${interviewRate}% interview rate`
        },
        {
          name: 'Final Round',
          count: finalRound,
          conversionRate: finalRoundRate,
          color: '#F97316',
          description: `${finalRoundRate}% final round rate`
        },
        {
          name: 'Offer',
          count: offers,
          conversionRate: offerRate,
          color: '#10B981',
          description: `${offerRate}% offer rate`
        }
      ],
      dropOffs: {
        ghosted,
        rejected,
        totalDropOffs: ghosted + rejected
      }
    };
  }, [applications]);

  const maxCount = Math.max(...funnelData.stages.map(s => s.count));

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-full p-3">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Application Funnel</h2>
      </div>

      {/* Main Funnel */}
      <div className="mb-6">
        <div className="space-y-3">
          {funnelData.stages.map((stage, index) => (
            <div key={stage.name} className="relative">
              <div className="flex items-center gap-4">
                <div className="w-28 text-sm font-medium text-gray-700 text-right flex-shrink-0">
                  {stage.name}
                </div>
                <div className="flex-1 relative min-h-[40px] flex items-center">
                  <div
                    className="h-10 rounded-lg transition-all duration-300 flex items-center justify-between px-3 text-white font-bold text-sm shadow-md"
                    style={{
                      width: `${maxCount > 0 ? (stage.count / maxCount) * 100 : 0}%`,
                      backgroundColor: stage.color,
                      minWidth: '60px'
                    }}
                  >
                    <span>{stage.count}</span>
                    <span className="text-xs opacity-90">{stage.conversionRate}%</span>
                  </div>
                </div>
              </div>
              <div className="ml-32 mt-1">
                <p className="text-xs text-gray-500">{stage.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop-off Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-800">Application Outcomes</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <div>
              <div className="text-sm font-medium text-gray-800">{funnelData.dropOffs.ghosted}</div>
              <div className="text-xs text-gray-600">Ghosted</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div>
              <div className="text-sm font-medium text-gray-800">{funnelData.dropOffs.rejected}</div>
              <div className="text-xs text-gray-600">Rejected</div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-xs text-gray-600">
            <span>Total drop-offs:</span>
            <span className="font-medium">{funnelData.dropOffs.totalDropOffs} applications</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Conversion rates show progression through the application process.
          Ghosted and rejected applications represent outcomes at any stage.
        </p>
      </div>
    </div>
  );
};

export default ApplicationFunnelChart;