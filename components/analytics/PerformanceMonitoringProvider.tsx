'use client';

import { useEffect, useState } from 'react';
import { reportWebVitals } from 'web-vitals';
import { scriptLoadMonitor, reportScriptLoadMetrics } from '@/lib/script-load-monitor';
import {
  performanceRegressionDetector,
  PerformanceBaseline,
  RegressionAlert,
  PerformanceSnapshot,
} from '@/lib/performance-regression-detector';

export interface MonitoringContextValue {
  scriptLoadReport: any;
  regressionAlerts: RegressionAlert[];
  latestSnapshot: PerformanceSnapshot | null;
  isMonitoring: boolean;
}

/**
 * Performance Monitoring Provider
 *
 * Initializes and coordinates:
 * - Script load monitoring
 * - Performance regression detection
 * - Core Web Vitals tracking
 * - Analytics reporting
 */
export function PerformanceMonitoringProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [regressionAlerts, setRegressionAlerts] = useState<RegressionAlert[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<PerformanceSnapshot | null>(null);

  useEffect(() => {
    // Initialize monitoring systems
    if (!isInitialized) {
      scriptLoadMonitor.init();
      performanceRegressionDetector.init();
      setIsInitialized(true);

      // Setup Web Vitals reporting
      reportWebVitals((metric) => {
        const baseline: PerformanceBaseline = {
          fcp: metric.name === 'FCP' ? metric.value : 0,
          lcp: metric.name === 'LCP' ? metric.value : 0,
          cls: metric.name === 'CLS' ? metric.value : 0,
          tti: metric.name === 'FID' ? metric.value : 0, // Using FID as proxy for TTI
          ttfb: 0, // Not directly available from web-vitals
          performanceScore: 85, // Would need Lighthouse API
        };

        // This is simplified - in practice would accumulate full metrics
        const snapshot = performanceRegressionDetector.recordSnapshot(baseline);
        setLatestSnapshot(snapshot);
        setRegressionAlerts(snapshot.alerts);

        // Report to analytics
        if (navigator.sendBeacon) {
          const payload = {
            eventName: 'web_vitals',
            metric: metric.name,
            value: Math.round(metric.value),
            rating: metric.rating,
            delta: metric.delta,
            navigationType: metric.navigationType,
          };

          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon('/api/analytics/events', blob);
        }
      });

      // Report script loads after page load
      window.addEventListener('load', () => {
        setTimeout(() => {
          reportScriptLoadMetrics();
        }, 2000); // Wait 2 seconds for all scripts to settle
      });
    }

    return () => {
      // Cleanup if needed
    };
  }, [isInitialized]);

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceMonitoringIndicator
          alerts={regressionAlerts}
          snapshot={latestSnapshot}
        />
      )}
    </>
  );
}

/**
 * Development indicator showing monitoring status
 */
function PerformanceMonitoringIndicator({
  alerts,
  snapshot,
}: {
  alerts: RegressionAlert[];
  snapshot: PerformanceSnapshot | null;
}) {
  const [visible, setVisible] = useState(false);

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(!visible)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-lg text-xs font-bold"
        title="Performance Monitoring"
      >
        P
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden flex flex-col">
      <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
        <span className="font-semibold">Performance Monitor</span>
        <button
          onClick={() => setVisible(false)}
          className="text-lg font-bold hover:bg-blue-700 px-2 rounded"
        >
          ×
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-3 text-sm">
        {criticalAlerts.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
            <div className="font-semibold text-red-800 mb-1">
              🔴 Critical ({criticalAlerts.length})
            </div>
            {criticalAlerts.slice(0, 2).map((alert, idx) => (
              <div key={idx} className="text-red-700 text-xs mb-1">
                <strong>{alert.metric}</strong>: {alert.current}ms (↑ {alert.regression}%)
              </div>
            ))}
          </div>
        )}

        {warningAlerts.length > 0 && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="font-semibold text-yellow-800 mb-1">
              ⚠️ Warnings ({warningAlerts.length})
            </div>
            {warningAlerts.slice(0, 2).map((alert, idx) => (
              <div key={idx} className="text-yellow-700 text-xs mb-1">
                <strong>{alert.metric}</strong>: {alert.current}ms
              </div>
            ))}
          </div>
        )}

        {snapshot && (
          <div className="p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="font-semibold text-gray-800 mb-1">Latest Metrics</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>FCP: {snapshot.metrics.fcp}ms</div>
              <div>LCP: {snapshot.metrics.lcp}ms</div>
              <div>CLS: {snapshot.metrics.cls.toFixed(3)}</div>
              <div>Score: {snapshot.metrics.performanceScore}/100</div>
              <div className="mt-2 text-gray-500 text-xs">
                {snapshot.thresholdMet ? '✅ All thresholds met' : '❌ Some thresholds exceeded'}
              </div>
            </div>
          </div>
        )}

        {alerts.length === 0 && snapshot && (
          <div className="p-2 bg-green-50 border border-green-200 rounded">
            <div className="font-semibold text-green-800">✅ Healthy Performance</div>
            <div className="text-xs text-green-700 mt-1">No regressions detected</div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-2 bg-gray-50 text-xs text-gray-500">
        Updated at {snapshot?.timestamp ? new Date(snapshot.timestamp).toLocaleTimeString() : 'pending'}
      </div>
    </div>
  );
}
