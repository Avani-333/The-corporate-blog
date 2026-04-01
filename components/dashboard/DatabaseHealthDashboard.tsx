/**
 * Database Health Dashboard Component
 * Displays real-time database health metrics and monitoring
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, Database, Activity, HardDrive, Zap } from 'lucide-react';

interface DashboardData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  metricsAge: number | null;
  summary: {
    connections: { active: number; percent: number };
    storage: { percent: number; status: string };
    performance: { cacheHitRatio: number; qps: number };
    backup: { lastBackup: string | null; status: string };
  };
  details: any;
  alerts: any[];
}

export default function DatabaseHealthDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    if (!autoRefresh) return;

    const interval = setInterval(fetchDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchDashboard, autoRefresh, refreshInterval]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <p className="text-gray-600">Loading database metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statusColors = {
    healthy: 'bg-green-50 border-green-200',
    degraded: 'bg-yellow-50 border-yellow-200',
    unhealthy: 'bg-red-50 border-red-200',
  };

  const statusIcons = {
    healthy: <CheckCircle className="w-5 h-5 text-green-600" />,
    degraded: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
    unhealthy: <AlertCircle className="w-5 h-5 text-red-600" />,
  };

  const statusTextColors = {
    healthy: 'text-green-900',
    degraded: 'text-yellow-900',
    unhealthy: 'text-red-900',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Database Health Dashboard</h1>
              <p className="text-gray-600 text-sm mt-1">
                Last updated: {new Date(data.timestamp).toLocaleString()}
              </p>
            </div>
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Refresh Now
            </button>
          </div>

          {/* Status Card */}
          <div className={`border rounded-lg p-6 ${statusColors[data.status]}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcons[data.status]}
                <div>
                  <p className="text-sm text-gray-600">Overall Status</p>
                  <p className={`text-2xl font-bold capitalize ${statusTextColors[data.status]}`}>
                    {data.status}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Auto Refresh</span>
              </label>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Connections */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Connections</h3>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gray-900">{data.summary.connections.active}</p>
              <p className="text-sm text-gray-600">
                Active ({data.summary.connections.percent.toFixed(1)}% of max)
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    data.summary.connections.percent > 80 ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(data.summary.connections.percent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Storage */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Storage</h3>
              <HardDrive className="w-5 h-5 text-orange-500" />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gray-900">{data.summary.storage.percent.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Used ({data.summary.storage.status})</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    data.summary.storage.percent > 85 ? 'bg-red-500' : data.summary.storage.percent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(data.summary.storage.percent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Performance</h3>
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gray-900">{data.summary.performance.cacheHitRatio.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Cache Hit Ratio</p>
              <p className="text-2xl font-bold text-gray-700 mt-3">{data.summary.performance.qps.toFixed(1)}</p>
              <p className="text-sm text-gray-600">Queries Per Second</p>
            </div>
          </div>

          {/* Backup */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Backup</h3>
              <Database className="w-5 h-5 text-purple-500" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900 capitalize">{data.summary.backup.status}</p>
              <p className="text-xs text-gray-600">
                {data.summary.backup.lastBackup ? (
                  new Date(data.summary.backup.lastBackup).toLocaleDateString()
                ) : (
                  'No backup yet'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Active Alerts ({data.alerts.length})</h2>
            </div>
            <div className="divide-y">
              {data.alerts.map((alert, index) => (
                <div key={index} className="p-4 flex items-start gap-3">
                  {alert.severity === 'critical' && <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                  {alert.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                  {alert.severity === 'info' && <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />}
                  <div className="flex-1">
                    <p className={`font-semibold ${alert.severity === 'critical' ? 'text-red-900' : alert.severity === 'warning' ? 'text-yellow-900' : 'text-blue-900'}`}>
                      {alert.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {data.details && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Tables by Size */}
            {data.details.topTables && data.details.topTables.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Tables by Size</h2>
                <div className="space-y-3">
                  {data.details.topTables.map((table: any, index: number) => (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">{table.name}</p>
                        <p className="text-sm text-gray-600">{table.sizeHuman}</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${(table.sizeBytes / data.details.storage.totalSizeBytes) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slow Queries */}
            {data.details.slowQueries && data.details.slowQueries.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Slow Queries</h2>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {data.details.slowQueries.slice(0, 5).map((query: any, index: number) => (
                    <div key={index} className="border-l-4 border-yellow-500 pl-3 py-2">
                      <p className="text-xs text-gray-600 font-mono truncate">{query.query}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Avg: {query.averageTime}ms | Total: {query.totalTime} | Calls: {query.calls}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Database health monitoring • Refreshing every {(refreshInterval / 1000).toFixed(0)} seconds</p>
          <p className="mt-1">For detailed metrics, visit <code className="bg-gray-100 px-2 py-1 rounded">/api/dashboard</code></p>
        </div>
      </div>
    </div>
  );
}
