import React, { useState, useMemo } from 'react';
import { ApplicationStatus } from '../types';
import { useAppContext } from '../context/AppContext';
import { hasReachedInterview, hasReachedOffer, hasPositiveResponse } from '../utils/stages';
import { Filter, Download } from 'lucide-react';
import KeyMetricsCards from '../components/analytics/KeyMetricsCards';
import InsightsStrip from '../components/analytics/InsightsStrip';
import StatusDistributionChart from '../components/analytics/StatusDistributionChart';
import ApplicationsTimelineChart from '../components/analytics/ApplicationsTimelineChart';
import SourceEffectiveness from '../components/analytics/SourceEffectiveness';
import EasyApplyComparison from '../components/analytics/EasyApplyComparison';
import TechStackAnalysis from '../components/analytics/TechStackAnalysis';
import GermanyMap from '../components/analytics/GermanyMap';
import ApplicationProcessSankey from '../components/analytics/ApplicationProcessSankey';

const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const isoDay = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - isoDay);
  return x;
};

const Analytics: React.FC = () => {
  const { applications, loading } = useAppContext();
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '6m' | 'all'>('all');

  // Filter applications by date range
  const filteredApplications = useMemo(() => {
    if (dateRange === 'all') return applications;
    const now = new Date();
    const cutoffDate = new Date();
    switch (dateRange) {
      case '30d': cutoffDate.setDate(now.getDate() - 30); break;
      case '90d': cutoffDate.setDate(now.getDate() - 90); break;
      case '6m': cutoffDate.setMonth(now.getMonth() - 6); break;
    }
    return applications.filter(app => new Date(app.createdAt) >= cutoffDate);
  }, [applications, dateRange]);

  // Honest key metrics. "Positive response" excludes rejections and ghosting —
  // a rejection is a "no", not engagement (see utils/stages.ts).
  const metrics = useMemo(() => {
    const total = filteredApplications.length;
    const positiveResponded = filteredApplications.filter(hasPositiveResponse).length;
    const interviewed = filteredApplications.filter(hasReachedInterview).length;
    const rejected = filteredApplications.filter(app => app.status === 'Rejected').length;
    const ghosted = filteredApplications.filter(app => app.status === 'Ghosted').length;

    // Velocity: days from creation to the most recent status change.
    const durations = filteredApplications
      .map(app => {
        const last = app.history && app.history.length
          ? Math.max(...app.history.map(h => new Date(h.changedAt).getTime()))
          : new Date(app.updatedAt).getTime();
        return (last - new Date(app.createdAt).getTime()) / 86_400_000;
      })
      .filter(d => isFinite(d) && d >= 0);
    const avgDaysToOutcome = durations.length
      ? Math.round(durations.reduce((s, x) => s + x, 0) / durations.length)
      : null;

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      positiveResponded,
      positiveResponseRate: pct(positiveResponded),
      interviewed,
      interviewRate: pct(interviewed),
      ghosted,
      ghostRate: pct(ghosted),
      rejected,
      rejectionRate: pct(rejected),
      avgDaysToOutcome,
    };
  }, [filteredApplications]);

  // Status distribution data for the pie chart
  const statusData = useMemo(() => {
    const counts = filteredApplications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<ApplicationStatus, number>);
    return Object.entries(counts).map(([status, count]) => ({
      name: status,
      value: count,
      percentage: filteredApplications.length ? Math.round((count / filteredApplications.length) * 100) : 0,
    }));
  }, [filteredApplications]);

  // Applications over time — respects the date filter and picks a sensible
  // granularity (weekly for short ranges, monthly for long ones), dropping
  // empty leading buckets so the chart starts where the data does.
  const { timelineData, granularity } = useMemo(() => {
    if (filteredApplications.length === 0) return { timelineData: [], granularity: 'month' };
    const now = new Date();
    let start: Date;
    let unit: 'week' | 'month';
    if (dateRange === '30d') { start = new Date(now); start.setDate(now.getDate() - 30); unit = 'week'; }
    else if (dateRange === '90d') { start = new Date(now); start.setDate(now.getDate() - 90); unit = 'week'; }
    else if (dateRange === '6m') { start = new Date(now); start.setMonth(now.getMonth() - 6); unit = 'month'; }
    else {
      start = filteredApplications.reduce(
        (min, a) => { const d = new Date(a.createdAt); return d < min ? d : min; },
        new Date(),
      );
      unit = 'month';
    }

    const buckets: { start: Date; end: Date; label: string }[] = [];
    if (unit === 'week') {
      let cur = startOfWeek(start);
      while (cur <= now) {
        const end = new Date(cur); end.setDate(end.getDate() + 7);
        buckets.push({ start: new Date(cur), end, label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
        cur = end;
      }
    } else {
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= now) {
        const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        buckets.push({ start: new Date(cur), end, label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
        cur = end;
      }
    }

    const data = buckets.map(b => {
      const inBucket = filteredApplications.filter(a => {
        const d = new Date(a.createdAt);
        return d >= b.start && d < b.end;
      });
      return {
        date: b.label,
        applications: inBucket.length,
        responses: inBucket.filter(hasPositiveResponse).length,
      };
    });
    return { timelineData: data, granularity: unit };
  }, [filteredApplications, dateRange]);

  // Plain-English takeaways, only surfaced when there's enough data to mean
  // something (the strip renders nothing when empty).
  const insights = useMemo(() => {
    const out: string[] = [];
    const { total, positiveResponded, positiveResponseRate, ghosted, ghostRate, avgDaysToOutcome } = metrics;
    if (total < 5) return out;

    out.push(`Only ${positiveResponded} of ${total} applications (${positiveResponseRate}%) drew a genuine response — the rest were rejected or ghosted.`);
    if (ghosted > 0) out.push(`${ghostRate}% of applications were ghosted (${ghosted}) — your single biggest drop-off.`);

    const manual = filteredApplications.filter(a => !a.easyApply);
    const easy = filteredApplications.filter(a => a.easyApply);
    if (manual.length >= 5 && easy.length >= 5) {
      const mr = Math.round(manual.filter(hasPositiveResponse).length / manual.length * 100);
      const er = Math.round(easy.filter(hasPositiveResponse).length / easy.length * 100);
      if (mr !== er) {
        const tailoringWins = mr > er;
        out.push(`${tailoringWins ? 'Manual' : 'Easy-apply'} applications respond at ${Math.max(mr, er)}% vs ${Math.min(mr, er)}% — ${tailoringWins ? 'tailoring is paying off' : 'one-click is doing just as well'}.`);
      }
    }
    if (avgDaysToOutcome != null) out.push(`Applications take about ${avgDaysToOutcome} days on average to reach an outcome.`);
    return out;
  }, [metrics, filteredApplications]);

  // Only show the sparse breakdowns when there's enough data behind them.
  const techFilled = filteredApplications.filter(a => a.techStack && a.techStack.trim()).length;
  const locations = new Set(filteredApplications.map(a => (a.location || '').trim()).filter(Boolean));
  const showTechStack = techFilled >= 5;
  const showMap = locations.size >= 3 && filteredApplications.length >= 5;
  const offers = filteredApplications.filter(hasReachedOffer).length;

  const handleExport = () => {
    const headers = ['Company', 'Position', 'Location', 'Status', 'Source', 'Easy Apply', 'Created', 'Applied'];
    const rows = filteredApplications.map(a => [
      a.companyName, a.positionTitle, a.location, a.status, a.jobBoardSource || '',
      a.easyApply ? 'yes' : 'no', (a.createdAt || '').split('T')[0], (a.appliedDate || '').split('T')[0],
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `applyquest-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Analytics Dashboard</h1>
            <p className="text-gray-600">An honest read on where your applications actually go</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="6m">Last 6 Months</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <button
              onClick={handleExport}
              disabled={filteredApplications.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {filteredApplications.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-md text-center text-gray-500">
          No applications in this period. Try a wider date range.
        </div>
      ) : (
        <>
          <KeyMetricsCards metrics={metrics} />

          <InsightsStrip insights={insights} />

          {/* The flow story (kept — the Sankey is the centrepiece) */}
          <ApplicationProcessSankey applications={filteredApplications} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApplicationsTimelineChart timelineData={timelineData} granularity={granularity} />
            <SourceEffectiveness applications={filteredApplications} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EasyApplyComparison applications={filteredApplications} />
            <StatusDistributionChart statusData={statusData} />
          </div>

          {/* Sparse breakdowns — only rendered when the data supports them */}
          {(showTechStack || showMap) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {showTechStack && <TechStackAnalysis applications={filteredApplications} />}
              {showMap && <GermanyMap applications={filteredApplications} />}
            </div>
          )}

          {offers === 0 && (
            <p className="text-center text-xs text-gray-400">
              No offers in this period yet — the funnel narrows fast. Focus the wins above.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;
