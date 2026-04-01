/**
 * Hook for monitoring performance regression and script load impact
 *
 * Provides convenient access to monitoring data with automatic updates
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  scriptLoadMonitor,
  ScriptLoadMonitorReport,
  ScriptMetric,
} from '@/lib/script-load-monitor';
import {
  performanceRegressionDetector,
  PerformanceRegressionDetector,
  RegressionAlert,
  PerformanceSnapshot,
} from '@/lib/performance-regression-detector';

export interface UseMonitoringReturn {
  // Script Load Monitoring
  scripts: ScriptMetric[];
  scriptReport: ScriptLoadMonitorReport | null;
  criticalScripts: ScriptMetric[];
  highImpactScripts: ScriptMetric[];

  // Performance Regression
  regressionAlerts: RegressionAlert[];
  latestSnapshot: PerformanceSnapshot | null;
  fcp_trend: 'improving' | 'stable' | 'regressing';
  lcp_trend: 'improving' | 'stable' | 'regressing';
  score_trend: 'improving' | 'stable' | 'regressing';

  // Methods
  generateReport: () => Promise<ScriptLoadMonitorReport>;
  setBaseline: (metrics: any) => void;
  clearData: () => void;
  isHealthy: boolean;
}

/**
 * Hook for comprehensive performance monitoring
 *
 * @example
 * const monitoring = usePerformanceMonitoring();
 *
 * if (!monitoring.isHealthy) {
 *   console.warn('Performance issues detected:', monitoring.regressionAlerts);
 * }
 *
 * console.log('Scripts loaded:', monitoring.scripts.length);
 * console.log('Critical scripts:', monitoring.criticalScripts);
 * console.log('FCP trend:', monitoring.fcp_trend);
 */
export function usePerformanceMonitoring(): UseMonitoringReturn {
  const [scripts, setScripts] = useState<ScriptMetric[]>([]);
  const [scriptReport, setScriptReport] = useState<ScriptLoadMonitorReport | null>(null);
  const [regressionAlerts, setRegressionAlerts] = useState<RegressionAlert[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [trends, setTrends] = useState({
    fcp: 'stable' as const,
    lcp: 'stable' as const,
    score: 'stable' as const,
  });

  // Generate report
  const generateReport = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null as any;
    }

    try {
      scriptLoadMonitor.init();
      const report = await scriptLoadMonitor.generateReport();
      setScriptReport(report);
      setScripts(report.scripts);
      return report;
    } catch (error) {
      console.error('Failed to generate script load report:', error);
      return null as any;
    }
  }, []);

  // Set baseline
  const setBaseline = useCallback((metrics: any) => {
    performanceRegressionDetector.init();
    performanceRegressionDetector.setBaseline(metrics);
  }, []);

  // Clear all monitoring data
  const clearData = useCallback(() => {
    scriptLoadMonitor.reset();
    performanceRegressionDetector.clear();
    setScripts([]);
    setScriptReport(null);
    setRegressionAlerts([]);
    setLatestSnapshot(null);
  }, []);

  // Initialize on mount and periodically update
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize
    scriptLoadMonitor.init();
    performanceRegressionDetector.init();

    // Generate initial report
    generateReport();

    // Update every 10 seconds while page is visible
    const interval = setInterval(
      async () => {
        if (document.hidden) return; // Don't update if page not visible

        const report = await generateReport();
        const latest = performanceRegressionDetector.getLatestSnapshot();
        setLatestSnapshot(latest);

        if (latest) {
          setRegressionAlerts(latest.alerts);
        }

        // Update trends
        setTrends({
          fcp: performanceRegressionDetector.getTrend('fcp', 1440),
          lcp: performanceRegressionDetector.getTrend('lcp', 1440),
          score: performanceRegressionDetector.getTrend('performanceScore', 1440),
        });
      },
      10000
    );

    return () => clearInterval(interval);
  }, [generateReport]);

  const criticalScripts = scripts.filter((s) => !s.async && !s.defer);
  const highImpactScripts = scriptLoadMonitor.getHighImpactScripts(100);
  const isHealthy = regressionAlerts.filter((a) => a.severity === 'critical').length === 0;

  return {
    scripts,
    scriptReport,
    criticalScripts,
    highImpactScripts,
    regressionAlerts,
    latestSnapshot,
    fcp_trend: trends.fcp,
    lcp_trend: trends.lcp,
    score_trend: trends.score,
    generateReport,
    setBaseline,
    clearData,
    isHealthy,
  };
}

/**
 * Alternative hook for simple regression detection
 *
 * @example
 * const { alerts, isHealthy } = useRegressionDetection();
 */
export function useRegressionDetection() {
  const [alerts, setAlerts] = useState<RegressionAlert[]>([]);
  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    performanceRegressionDetector.init();

    const checkInterval = setInterval(() => {
      const snapshot = performanceRegressionDetector.getLatestSnapshot();
      if (snapshot) {
        setAlerts(snapshot.alerts);
        setIsHealthy(!snapshot.regression);
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  return { alerts, isHealthy };
}

/**
 * Alternative hook for simple script monitoring
 *
 * @example
 * const { scripts, criticalCount } = useScriptMonitoring();
 */
export function useScriptMonitoring() {
  const [scripts, setScripts] = useState<ScriptMetric[]>([]);
  const [report, setReport] = useState<ScriptLoadMonitorReport | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    scriptLoadMonitor.init();

    const checkInterval = setInterval(async () => {
      const newScripts = scriptLoadMonitor.getScripts();
      setScripts(newScripts);

      const newReport = await scriptLoadMonitor.generateReport();
      setReport(newReport);
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  const criticalScripts = scripts.filter((s) => !s.async && !s.defer);
  const totalImpact = report?.summary.estimatedFCPImpact || 0;

  return {
    scripts,
    report,
    criticalCount: criticalScripts.length,
    totalImpact,
    isHealthy: totalImpact < 300, // Less than 300ms FCP impact is healthy
  };
}
