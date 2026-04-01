/**
 * Performance Regression Detector
 *
 * Detects performance regressions by comparing current metrics against:
 * - Historical baselines
 * - Expected thresholds
 * - Previous measurements
 *
 * Flags regressions and triggers notifications when thresholds are exceeded.
 *
 * @see docs/MONITORING_AND_ALERTS.md
 */

export interface PerformanceBaseline {
  fcp: number; // ms
  lcp: number; // ms
  cls: number; // unitless
  tti: number; // ms
  ttfb: number; // ms
  performanceScore: number; // 0-100
}

export interface PerformanceThreshold {
  fcp: { min: number; warning: number } | number;
  lcp: { min: number; warning: number } | number;
  cls: { min: number; warning: number } | number;
  tti: { min: number; warning: number } | number;
  ttfb: { min: number; warning: number } | number;
  performanceScore: number; // min acceptable score
}

export interface RegressionAlert {
  metric: string;
  current: number;
  baseline: number;
  threshold: number;
  regression: number; // percentage or absolute depending on metric
  severity: 'warning' | 'critical';
  timestamp: string;
  pageUrl: string;
}

export interface PerformanceSnapshot {
  timestamp: string;
  pageUrl: string;
  metrics: PerformanceBaseline;
  thresholdMet: boolean;
  regression: boolean;
  alerts: RegressionAlert[];
}

const STORAGE_KEY_PREFIX = 'tcb_perf_baseline_';
const STORAGE_KEY_SNAPSHOTS = 'tcb_perf_snapshots';

const DEFAULT_THRESHOLDS: PerformanceThreshold = {
  fcp: { min: 1500, warning: 1000 },
  lcp: { min: 2500, warning: 2000 },
  cls: { min: 0.1, warning: 0.05 },
  tti: { min: 3800, warning: 3000 },
  ttfb: { min: 600, warning: 300 },
  performanceScore: 85,
};

class PerformanceRegressionDetector {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private snapshots: PerformanceSnapshot[] = [];
  private thresholds: PerformanceThreshold = DEFAULT_THRESHOLDS;
  private initialized = false;

  /**
   * Initialize regression detector
   */
  init(customThresholds?: Partial<PerformanceThreshold>) {
    if (this.initialized) return;

    this.initialized = true;

    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds };
    }

    this.loadBaselinesFromStorage();
    this.loadSnapshotsFromStorage();
  }

  /**
   * Load baselines from localStorage
   */
  private loadBaselinesFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      // Load all stored baselines
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
          const pageUrl = key.replace(STORAGE_KEY_PREFIX, '');
          const baseline = JSON.parse(localStorage.getItem(key) || '{}');
          this.baselines.set(pageUrl, baseline);
        }
      }
    } catch (error) {
      console.warn('Failed to load performance baselines:', error);
    }
  }

  /**
   * Load snapshots from localStorage
   */
  private loadSnapshotsFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      const snapshots = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
      if (snapshots) {
        this.snapshots = JSON.parse(snapshots).slice(-100); // Keep last 100
      }
    } catch (error) {
      console.warn('Failed to load performance snapshots:', error);
    }
  }

  /**
   * Store baseline for a page
   */
  private saveBaseline(pageUrl: string, baseline: PerformanceBaseline) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      const key = STORAGE_KEY_PREFIX + pageUrl;
      localStorage.setItem(key, JSON.stringify(baseline));
    } catch (error) {
      console.warn('Failed to save performance baseline:', error);
    }
  }

  /**
   * Store snapshots
   */
  private saveSnapshots() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(this.snapshots.slice(-100)));
    } catch (error) {
      console.warn('Failed to save performance snapshots:', error);
    }
  }

  /**
   * Get or create baseline for current page
   */
  private getPageBaseline(pageUrl: string): PerformanceBaseline | null {
    return this.baselines.get(pageUrl) || null;
  }

  /**
   * Check if value exceeds threshold
   */
  private exceedsThreshold(metric: string, value: number): boolean {
    const threshold = this.thresholds[metric as keyof PerformanceThreshold];

    if (typeof threshold === 'number') {
      return value < threshold; // For score, higher is better
    }

    return value > threshold.min;
  }

  /**
   * Check if value triggers warning
   */
  private triggersWarning(metric: string, value: number): boolean {
    const threshold = this.thresholds[metric as keyof PerformanceThreshold];

    if (typeof threshold === 'number') {
      return value < threshold;
    }

    return value > (threshold.warning || threshold.min);
  }

  /**
   * Calculate regression severity
   */
  private calculateRegression(metric: string, current: number, baseline: number): number {
    if (metric === 'performanceScore' || metric === 'cls') {
      return baseline - current; // Absolute difference
    }

    // Calculate percentage increase
    if (baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  }

  /**
   * Detect regressions in current metrics vs baseline
   */
  detectRegression(metrics: PerformanceBaseline): RegressionAlert[] {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';
    const baseline = this.getPageBaseline(pageUrl);
    const alerts: RegressionAlert[] = [];

    if (!baseline) {
      return alerts; // No baseline yet, can't detect regression
    }

    const metricsToCheck: (keyof PerformanceBaseline)[] = [
      'fcp',
      'lcp',
      'cls',
      'tti',
      'ttfb',
      'performanceScore',
    ];

    metricsToCheck.forEach((metric) => {
      const current = metrics[metric];
      const baselineValue = baseline[metric];
      const regression = this.calculateRegression(metric, current, baselineValue);

      // Only alert if there's a significant regression
      const isSignificantRegression =
        (metric === 'performanceScore' && regression > 5) || // More than 5 point drop
        (metric !== 'performanceScore' && regression > 10); // More than 10% increase

      if (isSignificantRegression && this.triggersWarning(metric, current)) {
        const severity = this.exceedsThreshold(metric, current) ? 'critical' : 'warning';

        alerts.push({
          metric,
          current: Math.round(current * 100) / 100,
          baseline: Math.round(baselineValue * 100) / 100,
          threshold:
            typeof this.thresholds[metric as keyof PerformanceThreshold] === 'number'
              ? (this.thresholds[metric as keyof PerformanceThreshold] as number)
              : (this.thresholds[metric as keyof PerformanceThreshold] as any).min,
          regression: Math.round(regression * 100) / 100,
          severity,
          timestamp: new Date().toISOString(),
          pageUrl,
        });
      }
    });

    return alerts;
  }

  /**
   * Record a performance snapshot
   */
  recordSnapshot(metrics: PerformanceBaseline): PerformanceSnapshot {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';
    const regressions = this.detectRegression(metrics);
    const thresholdMet =
      !this.exceedsThreshold('fcp', metrics.fcp) &&
      !this.exceedsThreshold('lcp', metrics.lcp) &&
      !this.exceedsThreshold('cls', metrics.cls) &&
      !this.exceedsThreshold('tti', metrics.tti) &&
      !this.exceedsThreshold('performanceScore', metrics.performanceScore);

    const snapshot: PerformanceSnapshot = {
      timestamp: new Date().toISOString(),
      pageUrl,
      metrics,
      thresholdMet,
      regression: regressions.length > 0,
      alerts: regressions,
    };

    this.snapshots.push(snapshot);
    this.saveSnapshots();

    return snapshot;
  }

  /**
   * Set baseline for current page (after validation)
   */
  setBaseline(metrics: PerformanceBaseline) {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';

    this.baselines.set(pageUrl, metrics);
    this.saveBaseline(pageUrl, metrics);
  }

  /**
   * Update baseline (e.g., after optimization)
   */
  updateBaseline(metrics: PerformanceBaseline) {
    this.setBaseline(metrics);
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): PerformanceSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Get snapshots within time range
   */
  getSnapshotsSince(minutesAgo: number): PerformanceSnapshot[] {
    const threshold = Date.now() - minutesAgo * 60 * 1000;
    return this.snapshots.filter((s) => new Date(s.timestamp).getTime() > threshold);
  }

  /**
   * Get performance trend
   */
  getTrend(metric: keyof PerformanceBaseline, minutesAgo: number = 1440): 'improving' | 'stable' | 'regressing' {
    const snapshots = this.getSnapshotsSince(minutesAgo);
    if (snapshots.length < 2) return 'stable';

    const recent = snapshots.slice(-5);
    const older = snapshots.slice(0, Math.max(1, Math.floor(snapshots.length / 2)));

    const recentAvg = recent.reduce((sum, s) => sum + s.metrics[metric], 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.metrics[metric], 0) / older.length;

    // For score, higher is better (improving = higher)
    if (metric === 'performanceScore') {
      if (recentAvg > olderAvg + 5) return 'improving';
      if (recentAvg < olderAvg - 5) return 'regressing';
    } else {
      // For timings, lower is better (improving = lower)
      if (recentAvg < olderAvg - olderAvg * 0.1) return 'improving';
      if (recentAvg > olderAvg + olderAvg * 0.1) return 'regressing';
    }

    return 'stable';
  }

  /**
   * Compare two measurements
   */
  compare(metrics1: PerformanceBaseline, metrics2: PerformanceBaseline): Record<string, number> {
    const comparison: Record<string, number> = {};

    (Object.keys(metrics1) as Array<keyof PerformanceBaseline>).forEach((metric) => {
      const v1 = metrics1[metric];
      const v2 = metrics2[metric];

      if (metric === 'performanceScore') {
        comparison[metric] = v2 - v1; // Absolute for score
      } else {
        comparison[metric] = ((v2 - v1) / v1) * 100; // Percentage for timings
      }
    });

    return comparison;
  }

  /**
   * Get all alerts from recent snapshots
   */
  getRecentAlerts(minutesAgo: number = 60): RegressionAlert[] {
    const snapshots = this.getSnapshotsSince(minutesAgo);
    const alerts: RegressionAlert[] = [];

    snapshots.forEach((snapshot) => {
      alerts.push(...snapshot.alerts);
    });

    return alerts;
  }

  /**
   * Clear all data
   */
  clear() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    this.baselines.clear();
    this.snapshots = [];

    // Clear localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX) || key === STORAGE_KEY_SNAPSHOTS) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to clear performance data:', error);
    }
  }

  /**
   * Export data for analysis
   */
  exportData() {
    return {
      baselines: Array.from(this.baselines.entries()),
      snapshots: this.snapshots,
      currentThresholds: this.thresholds,
    };
  }
}

// Singleton instance
export const performanceRegressionDetector = new PerformanceRegressionDetector();

/**
 * React hook for detecting regressions
 */
export function usePerformanceRegression() {
  if (typeof window === 'undefined') return null;

  if (!performanceRegressionDetector.initialized) {
    performanceRegressionDetector.init();
  }

  return performanceRegressionDetector;
}
