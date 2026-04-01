export interface HttpMetricsSnapshot {
  generatedAt: string;
  uptimeSeconds: number;
  totals: {
    requests: number;
    errorResponses: number;
    serverErrors: number;
    errorRate: number;
    serverErrorRate: number;
  };
  responseTimeMs: {
    avg: number;
    p95: number;
    min: number;
    max: number;
  };
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  topSlowEndpoints: Array<{
    path: string;
    requests: number;
    avgResponseMs: number;
    maxResponseMs: number;
    errorRate: number;
  }>;
}

interface EndpointAggregate {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  errorCount: number;
}

const RECENT_DURATION_SAMPLE_SIZE = 500;

class MetricsStore {
  private readonly startedAt = Date.now();

  private totalRequests = 0;
  private totalErrorResponses = 0;
  private totalServerErrors = 0;

  private totalDurationMs = 0;
  private minDurationMs = Number.POSITIVE_INFINITY;
  private maxDurationMs = 0;

  private readonly recentDurations: number[] = [];
  private readonly methodCounts = new Map<string, number>();
  private readonly statusCounts = new Map<string, number>();
  private readonly endpointStats = new Map<string, EndpointAggregate>();

  public recordRequest(method: string, statusCode: number, durationMs: number, path: string): void {
    this.totalRequests += 1;
    this.totalDurationMs += durationMs;

    if (durationMs < this.minDurationMs) this.minDurationMs = durationMs;
    if (durationMs > this.maxDurationMs) this.maxDurationMs = durationMs;

    this.recentDurations.push(durationMs);
    if (this.recentDurations.length > RECENT_DURATION_SAMPLE_SIZE) {
      this.recentDurations.shift();
    }

    if (statusCode >= 400) this.totalErrorResponses += 1;
    if (statusCode >= 500) this.totalServerErrors += 1;

    this.methodCounts.set(method, (this.methodCounts.get(method) || 0) + 1);
    this.statusCounts.set(String(statusCode), (this.statusCounts.get(String(statusCode)) || 0) + 1);

    const key = this.normalizePath(path);
    const current = this.endpointStats.get(key) || {
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      errorCount: 0,
    };

    current.count += 1;
    current.totalDurationMs += durationMs;
    if (durationMs > current.maxDurationMs) current.maxDurationMs = durationMs;
    if (statusCode >= 400) current.errorCount += 1;

    this.endpointStats.set(key, current);
  }

  public getSnapshot(): HttpMetricsSnapshot {
    const requestCount = this.totalRequests;
    const avgDuration = requestCount > 0 ? this.totalDurationMs / requestCount : 0;

    const sortedRecent = [...this.recentDurations].sort((a, b) => a - b);
    const p95Index = sortedRecent.length > 0 ? Math.min(sortedRecent.length - 1, Math.floor(sortedRecent.length * 0.95)) : 0;
    const p95Duration = sortedRecent.length > 0 ? sortedRecent[p95Index] : 0;

    const topSlowEndpoints = [...this.endpointStats.entries()]
      .map(([path, stats]) => ({
        path,
        requests: stats.count,
        avgResponseMs: stats.count > 0 ? stats.totalDurationMs / stats.count : 0,
        maxResponseMs: stats.maxDurationMs,
        errorRate: stats.count > 0 ? stats.errorCount / stats.count : 0,
      }))
      .sort((a, b) => b.avgResponseMs - a.avgResponseMs)
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      totals: {
        requests: requestCount,
        errorResponses: this.totalErrorResponses,
        serverErrors: this.totalServerErrors,
        errorRate: requestCount > 0 ? this.totalErrorResponses / requestCount : 0,
        serverErrorRate: requestCount > 0 ? this.totalServerErrors / requestCount : 0,
      },
      responseTimeMs: {
        avg: avgDuration,
        p95: p95Duration,
        min: requestCount > 0 ? this.minDurationMs : 0,
        max: requestCount > 0 ? this.maxDurationMs : 0,
      },
      byMethod: Object.fromEntries(this.methodCounts.entries()),
      byStatus: Object.fromEntries(this.statusCounts.entries()),
      topSlowEndpoints,
    };
  }

  private normalizePath(path: string): string {
    const withoutQuery = path.split('?')[0] || '/';
    return withoutQuery.length > 120 ? `${withoutQuery.slice(0, 117)}...` : withoutQuery;
  }
}

const metricsStore = new MetricsStore();

export function recordHttpMetric(method: string, statusCode: number, durationMs: number, path: string): void {
  metricsStore.recordRequest(method, statusCode, durationMs, path);
}

export function getHttpMetricsSnapshot(): HttpMetricsSnapshot {
  return metricsStore.getSnapshot();
}
