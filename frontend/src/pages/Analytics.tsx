import React, { useState, useMemo } from 'react';
import { ApplicationStatus } from '../types';
import { useAppContext } from '../context/AppContext';
import { hasReachedInterview } from '../utils/stages';
import {
  Filter,
  Download
} from 'lucide-react';
import KeyMetricsCards from '../components/analytics/KeyMetricsCards';
import StatusDistributionChart from '../components/analytics/StatusDistributionChart';
import ApplicationsTimelineChart from '../components/analytics/ApplicationsTimelineChart';
import TopCompaniesAnalysis from '../components/analytics/TopCompaniesAnalysis';
import ApplicationFunnelChart from '../components/analytics/ApplicationFunnelChart';
import TechStackAnalysis from '../components/analytics/TechStackAnalysis';
import GermanyMap from '../components/analytics/GermanyMap';
import ApplicationProcessSankey from '../components/analytics/ApplicationProcessSankey';


const Analytics: React.FC = () => {
  const { applications, loading } = useAppContext();
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '6m' | 'all'>('all');

  // Filter applications by date range
  const filteredApplications = useMemo(() => {
    if (dateRange === 'all') return applications;

    const now = new Date();
    const cutoffDate = new Date();

    switch (dateRange) {
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '6m':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
    }

    return applications.filter(app => new Date(app.createdAt) >= cutoffDate);
  }, [applications, dateRange]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const total = filteredApplications.length;
    const responded = filteredApplications.filter(app =>
      !['Applied', 'Ghosted'].includes(app.status)
    ).length;
    const interviewed = filteredApplications.filter(hasReachedInterview).length;
    const rejected = filteredApplications.filter(app => app.status === 'Rejected').length;
    const ghosted = filteredApplications.filter(app => app.status === 'Ghosted').length;
    const easyApplied = filteredApplications.filter(app => app.easyApply).length;

    return {
      total,
      responded,
      interviewed,
      rejected,
      ghosted,
      easyApplied,
      responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
      interviewRate: total > 0 ? Math.round((interviewed / total) * 100) : 0,
      easyApplyRate: total > 0 ? Math.round((easyApplied / total) * 100) : 0,
    };
  }, [filteredApplications]);

  // Status distribution data for pie chart
  const statusData = useMemo(() => {
    const statusCounts = filteredApplications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<ApplicationStatus, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      percentage: Math.round((count / filteredApplications.length) * 100)
    }));
  }, [filteredApplications]);


  // Applications over time data - show last 6 months for better data visibility
  const timelineData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        startDate: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
      };
    });

    return last6Months.map(month => {
      const monthApps = filteredApplications.filter(app => {
        const appDate = app.createdAt.split('T')[0];
        return appDate >= month.startDate && appDate <= month.endDate;
      });
      return {
        date: month.label,
        applications: monthApps.length,
        responded: monthApps.filter(app => !['Applied', 'Ghosted'].includes(app.status)).length
      };
    });
  }, [filteredApplications]);

  // Industry analysis - more meaningful than individual companies
  const industryData = useMemo(() => {
    // Categorize companies by industry
    const industryMap: Record<string, { companies: Set<string>, total: number, responded: number, offers: number }> = {};

    filteredApplications.forEach(app => {
      let industry = 'Other';

      // Simple industry categorization based on company names
      const company = app.companyName.toLowerCase();
      if (company.includes('sap') || company.includes('siemens') || company.includes('bosch') || company.includes('continental') || company.includes('infineon')) {
        industry = 'Industrial/Tech';
      } else if (company.includes('bank') || company.includes('finance') || company.includes('kpmg') || company.includes('deloitte') || company.includes('n26') || company.includes('traderepublic')) {
        industry = 'Finance/Fintech';
      } else if (company.includes('telekom') || company.includes('telecom') || company.includes('deutsche telekom') || company.includes('t-systems')) {
        industry = 'Telecommunications';
      } else if (company.includes('bmw') || company.includes('vw') || company.includes('volkswagen') || company.includes('porsche') || company.includes('audi') || company.includes('zf') || company.includes('man')) {
        industry = 'Automotive';
      } else if (company.includes('zalando') || company.includes('henkel') || company.includes('basf') || company.includes('merck') || company.includes('edeka')) {
        industry = 'Consumer/Chemical';
      } else if (company.includes('startup') || company.includes('gorillas') || company.includes('tier') || company.includes('hellofresh') || company.includes('researchgate')) {
        industry = 'E-commerce/Startup';
      } else if (company.includes('healthcare') || company.includes('roche') || company.includes('fresenius') || company.includes('fraport')) {
        industry = 'Healthcare/Logistics';
      } else if (company.includes('lufthansa') || company.includes('dhl') || company.includes('flixbus')) {
        industry = 'Transportation';
      } else if (company.includes('consulting') || company.includes('accenture') || company.includes('capgemini')) {
        industry = 'Consulting';
      }

      if (!industryMap[industry]) {
        industryMap[industry] = { companies: new Set(), total: 0, responded: 0, offers: 0 };
      }

      industryMap[industry].companies.add(app.companyName);
      industryMap[industry].total++;
      if (!['Applied', 'Ghosted'].includes(app.status)) {
        industryMap[industry].responded++;
      }
      if (app.status === 'Offer') {
        industryMap[industry].offers++;
      }
    });

    return Object.entries(industryMap)
      .map(([industry, data]) => ({
        industry,
        companies: data.companies.size,
        applications: data.total,
        responded: data.responded,
        offers: data.offers,
        responseRate: data.total > 0 ? Math.round((data.responded / data.total) * 100) : 0,
        offerRate: data.total > 0 ? Math.round((data.offers / data.total) * 100) : 0
      }))
      .sort((a, b) => b.applications - a.applications);
  }, [filteredApplications]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Analytics Dashboard</h1>
            <p className="text-gray-600">Insights into your job search performance and trends</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Date Range Filter */}
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
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <KeyMetricsCards metrics={metrics} />

      {/* Application Flow Sankey Chart */}
      <ApplicationProcessSankey applications={filteredApplications} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <StatusDistributionChart statusData={statusData} />

        {/* Applications Timeline */}
        <ApplicationsTimelineChart timelineData={timelineData} />

        {/* Industry Analysis */}
        <TopCompaniesAnalysis companyData={industryData.map(ind => ({
          company: ind.industry,
          applications: ind.applications,
          offers: ind.offers,
          successRate: ind.responseRate
        }))} />

        {/* Application Funnel */}
        <ApplicationFunnelChart applications={filteredApplications} />
      </div>

      {/* Tech Stack Analysis & Germany Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tech Stack Analysis */}
        <TechStackAnalysis applications={filteredApplications} />

        {/* Germany Map */}
        <GermanyMap applications={filteredApplications} />
      </div>
    </div>
  );
};

export default Analytics;