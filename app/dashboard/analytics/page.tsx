'use client';

import { useState, useMemo, useEffect, type ComponentType } from 'react';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  MessageCircle, 
  Calendar,
  BarChart3,
  PieChart,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { withRoleProtection } from '@/hooks/useRoleBasedUI';
import { UserRole } from '@/types';

const ANALYTICS_API_BASE = (process.env.NEXT_PUBLIC_ANALYTICS_API_URL || '').replace(/\/+$/, '');

function analyticsApiUrl(path: string): string {
  return ANALYTICS_API_BASE ? `${ANALYTICS_API_BASE}${path}` : path;
}

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  totalPosts: number;
  totalComments: number;
  avgTimeOnPage: number;
  bounceRate: number;
  trend: {
    pageViews: number;
    uniqueVisitors: number;
    comments: number;
  };
}

interface TopPost {
  id: string;
  title: string;
  slug: string;
  views: number;
  comments: number;
  publishDate: Date;
  category: string;
}

interface TrafficSource {
  source: string;
  visits: number;
  percentage: number;
  trend: number;
}

interface SlowQueryLog {
  queryId: string | null;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  querySample: string;
  calls: number;
  totalExecMs: number;
  meanExecMs: number;
  rowsProcessed: number;
  ioMissRatio: number;
}

interface SlowQuerySummary {
  totalTrackedQueries: number;
  slowQueriesAboveThreshold: number;
  totalExecMsAcrossSlowQueries: number;
  avgMeanExecMsAcrossSlowQueries: number;
}

interface SlowQueryResponse {
  available: boolean;
  source?: string;
  reason?: string;
  settings: {
    limit: number;
    minMeanMs: number;
  };
  summary: SlowQuerySummary;
  analysis?: {
    topByMeanMs?: SlowQueryLog | null;
    topByTotalExecMs?: SlowQueryLog | null;
    topByCalls?: SlowQueryLog | null;
    byType?: Record<string, { count: number; totalExecMs: number; avgMeanExecMs: number }>;
  };
  recommendations: string[];
  queries: SlowQueryLog[];
}

// Mock data
const mockAnalytics: AnalyticsData = {
  pageViews: 24756,
  uniqueVisitors: 18432,
  totalPosts: 127,
  totalComments: 1854,
  avgTimeOnPage: 4.3,
  bounceRate: 34.2,
  trend: {
    pageViews: 12.5,
    uniqueVisitors: 8.7,
    comments: -3.2
  }
};

const mockTopPosts: TopPost[] = [
  {
    id: '1',
    title: 'Getting Started with Next.js 14: Complete Guide',
    slug: 'getting-started-nextjs-14-guide',
    views: 3420,
    comments: 89,
    publishDate: new Date('2024-01-15'),
    category: 'Technology'
  },
  {
    id: '2',
    title: 'Building Scalable React Applications',
    slug: 'building-scalable-react-applications',
    views: 2875,
    comments: 67,
    publishDate: new Date('2024-01-10'),
    category: 'Development'
  },
  {
    id: '3',
    title: 'Advanced TypeScript Patterns for Enterprise',
    slug: 'advanced-typescript-patterns-enterprise',
    views: 2334,
    comments: 54,
    publishDate: new Date('2024-01-05'),
    category: 'Programming'
  },
  {
    id: '4',
    title: 'Modern CSS Grid Techniques',
    slug: 'modern-css-grid-techniques',
    views: 1987,
    comments: 43,
    publishDate: new Date('2023-12-28'),
    category: 'CSS'
  },
  {
    id: '5',
    title: 'API Design Best Practices',
    slug: 'api-design-best-practices',
    views: 1654,
    comments: 32,
    publishDate: new Date('2023-12-20'),
    category: 'Backend'
  }
];

const mockTrafficSources: TrafficSource[] = [
  { source: 'Organic Search', visits: 12456, percentage: 50.3, trend: 15.2 },
  { source: 'Direct', visits: 6789, percentage: 27.4, trend: -2.1 },
  { source: 'Social Media', visits: 3421, percentage: 13.8, trend: 24.5 },
  { source: 'Referral', visits: 1567, percentage: 6.3, trend: 8.7 },
  { source: 'Email', visits: 523, percentage: 2.1, trend: -5.3 }
];

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: ComponentType<{ className?: string }>;
  color: string;
  suffix?: string;
}

function MetricCard({ title, value, trend, icon: Icon, color, suffix = '' }: MetricCardProps) {
  const trendColor = trend && trend > 0 ? 'text-green-600' : trend && trend < 0 ? 'text-red-600' : 'text-gray-500';
  const trendIcon = trend && trend > 0 ? '↗' : trend && trend < 0 ? '↘' : '→';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`h-12 w-12 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <div className="text-sm font-medium text-gray-500">{title}</div>
          <div className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </div>
          {trend !== undefined && (
            <div className={`text-sm ${trendColor} flex items-center mt-1`}>
              <span>{trendIcon}</span>
              <span className="ml-1">{Math.abs(trend)}% vs last month</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOP POSTS TABLE
// ============================================================================

function TopPostsTable({ posts }: { posts: TopPost[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Top Performing Posts</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
            View All <ExternalLink className="ml-1 h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Post Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Views
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Comments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Published
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {posts.map((post, index) => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-primary-600 font-medium text-sm">#{index + 1}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                      {post.title}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {post.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 text-gray-400 mr-1" />
                    {post.views.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <MessageCircle className="h-4 w-4 text-gray-400 mr-1" />
                    {post.comments}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                    {post.publishDate.toLocaleDateString()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// TRAFFIC SOURCES CHART
// ============================================================================

function TrafficSourcesChart({ sources }: { sources: TrafficSource[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Traffic Sources</h3>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {sources.map((source, index) => {
            const trendColor = source.trend > 0 ? 'text-green-600' : source.trend < 0 ? 'text-red-600' : 'text-gray-500';
            const trendIcon = source.trend > 0 ? '↗' : source.trend < 0 ? '↘' : '→';
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{source.source}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{source.visits.toLocaleString()}</span>
                      <span className={`text-xs ${trendColor} flex items-center`}>
                        {trendIcon} {Math.abs(source.trend)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{source.percentage}% of total traffic</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TIME PERIOD SELECTOR
// ============================================================================

function TimePeriodSelector() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [isOpen, setIsOpen] = useState(false);

  const periods = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' }
  ];

  const selectedLabel = periods.find(p => p.value === selectedPeriod)?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        {selectedLabel}
        <ChevronDown className="ml-2 h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => {
                  setSelectedPeriod(period.value);
                  setIsOpen(false);
                }}
                className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 ${
                  selectedPeriod === period.value ? 'text-primary-600 bg-primary-50' : 'text-gray-700'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

function SlowQueryLogsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SlowQueryResponse | null>(null);
  const [limit, setLimit] = useState(15);
  const [minMeanMs, setMinMeanMs] = useState(25);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadSlowQueries() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          analyticsApiUrl(`/api/analytics/db/slow-queries?limit=${limit}&minMeanMs=${minMeanMs}`),
          {
          headers: {
            Accept: 'application/json',
          },
          }
        );

        if (!response.ok) {
          throw new Error(`Analytics API returned ${response.status}`);
        }

        const json = await response.json();
        if (isMounted) {
          setPayload(json?.data as SlowQueryResponse);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load slow query logs');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadSlowQueries();

    return () => {
      isMounted = false;
    };
  }, [limit, minMeanMs, refreshToken]);

  if (loading) {
    return (
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">DB Query Logs</h3>
        <p className="text-sm text-gray-600">Loading slow query analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 bg-white rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">DB Query Logs</h3>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  if (!payload.available) {
    return (
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">DB Query Logs</h3>
        <p className="text-sm text-gray-700">{payload.reason || 'Query performance data is unavailable.'}</p>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">DB Query Logs</h3>
            <p className="text-sm text-gray-600 mt-1">
              Source: {payload.source} | Threshold: {payload.settings.minMeanMs}ms | Showing top {payload.settings.limit}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Slow query threshold"
              value={minMeanMs}
              onChange={(event) => setMinMeanMs(Number(event.target.value))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={10}>Threshold 10ms</option>
              <option value={25}>Threshold 25ms</option>
              <option value={50}>Threshold 50ms</option>
              <option value={100}>Threshold 100ms</option>
            </select>

            <select
              aria-label="Slow query limit"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
              <option value={30}>Top 30</option>
            </select>

            <button
              type="button"
              onClick={() => setRefreshToken((value) => value + 1)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-gray-200">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Slow Queries</p>
          <p className="text-xl font-semibold text-gray-900">{payload.summary.slowQueriesAboveThreshold}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Mean Time</p>
          <p className="text-xl font-semibold text-gray-900">{payload.summary.avgMeanExecMsAcrossSlowQueries.toFixed(1)} ms</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Exec Time</p>
          <p className="text-xl font-semibold text-gray-900">{payload.summary.totalExecMsAcrossSlowQueries.toFixed(0)} ms</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Tracked Rows</p>
          <p className="text-xl font-semibold text-gray-900">{payload.summary.totalTrackedQueries}</p>
        </div>
      </div>

      {payload.analysis && (
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-200 bg-gray-50/60">
          <div className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Worst Mean Latency</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {payload.analysis.topByMeanMs ? `${payload.analysis.topByMeanMs.meanExecMs.toFixed(1)} ms` : 'n/a'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {payload.analysis.topByMeanMs?.queryType || 'No query'}
            </p>
          </div>

          <div className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Largest Total Cost</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {payload.analysis.topByTotalExecMs ? `${payload.analysis.topByTotalExecMs.totalExecMs.toFixed(0)} ms` : 'n/a'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {payload.analysis.topByTotalExecMs?.calls.toLocaleString() || 0} calls
            </p>
          </div>

          <div className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Highest Frequency</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {payload.analysis.topByCalls ? payload.analysis.topByCalls.calls.toLocaleString() : 'n/a'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {payload.analysis.topByCalls ? `${payload.analysis.topByCalls.meanExecMs.toFixed(1)} ms mean` : 'No query'}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query Sample</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mean (ms)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (ms)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">I/O Miss</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {payload.queries.map((query, index) => (
              <tr key={`${query.queryId || 'q'}-${index}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{query.queryType}</td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-xl truncate" title={query.querySample}>
                  {query.querySample}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{query.calls.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{query.meanExecMs.toFixed(1)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{query.totalExecMs.toFixed(0)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{(query.ioMissRatio * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payload.recommendations.length > 0 && (
        <div className="p-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Tuning Recommendations</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {payload.recommendations.map((item, index) => (
              <li key={index}>- {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS DASHBOARD
// ============================================================================

function AnalyticsDashboard() {
  const analytics = useMemo(() => mockAnalytics, []);
  const topPosts = useMemo(() => mockTopPosts, []);
  const trafficSources = useMemo(() => mockTrafficSources, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Track your blog performance and audience engagement.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <TimePeriodSelector />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Page Views"
          value={analytics.pageViews}
          trend={analytics.trend.pageViews}
          icon={Eye}
          color="bg-blue-500"
        />
        <MetricCard
          title="Unique Visitors"
          value={analytics.uniqueVisitors}
          trend={analytics.trend.uniqueVisitors}
          icon={Users}
          color="bg-green-500"
        />
        <MetricCard
          title="Comments"
          value={analytics.totalComments}
          trend={analytics.trend.comments}
          icon={MessageCircle}
          color="bg-purple-500"
        />
        <MetricCard
          title="Avg. Time on Page"
          value={analytics.avgTimeOnPage}
          icon={BarChart3}
          color="bg-orange-500"
          suffix=" min"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <MetricCard
          title="Total Posts"
          value={analytics.totalPosts}
          icon={PieChart}
          color="bg-indigo-500"
        />
        <MetricCard
          title="Bounce Rate"
          value={analytics.bounceRate}
          icon={TrendingUp}
          color="bg-red-500"
          suffix="%"
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Posts - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <TopPostsTable posts={topPosts} />
        </div>

        {/* Traffic Sources - Takes up 1 column */}
        <div className="lg:col-span-1">
          <TrafficSourcesChart sources={trafficSources} />
        </div>
      </div>

      {/* Additional Insights */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Top Performance Indicators</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Page views increased by {analytics.trend.pageViews}% this month</li>
              <li>• Technology category posts perform 40% better</li>
              <li>• Peak traffic occurs on Tuesday-Thursday</li>
              <li>• Average session duration: {analytics.avgTimeOnPage} minutes</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Focus on organic search optimization</li>
              <li>• Increase social media engagement</li>
              <li>• Create more technology-related content</li>
              <li>• Improve mobile page loading speed</li>
            </ul>
          </div>
        </div>
      </div>

      <SlowQueryLogsPanel />
    </div>
  );
}

export default withRoleProtection(AnalyticsDashboard, UserRole.EDITOR);