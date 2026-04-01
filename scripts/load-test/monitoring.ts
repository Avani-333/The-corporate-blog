/**
 * Load Test Monitoring & Metrics Collection
 * Tracks database connections, memory usage, and performance metrics in real-time
 */

import { Rate, Trend, Gauge, Counter } from 'k6/metrics';

// ============================================================================
// MONITORING METRICS
// ============================================================================

// Response time metrics
export const responseTime = new Trend('http_req_duration', { unit: 'ms' });
export const p50ResponseTime = new Trend('response_time_p50', { unit: 'ms' });
export const p95ResponseTime = new Trend('response_time_p95', { unit: 'ms' });
export const p99ResponseTime = new Trend('response_time_p99', { unit: 'ms' });

// Error tracking
export const errorRate = new Rate('error_rate');
export const requestErrors = new Counter('http_req_failed');
export const requestSuccess = new Rate('http_req_success');

// Database metrics
export const dbConnections = new Gauge('db_connections_total');
export const dbActiveConnections = new Gauge('db_connections_active');
export const dbIdleConnections = new Gauge('db_connections_idle');
export const dbConnectionWait = new Gauge('db_connection_wait_time');

// Memory metrics
export const memoryHeapUsed = new Gauge('memory_heap_used_mb');
export const memoryHeapTotal = new Gauge('memory_heap_total_mb');
export const memoryExternal = new Gauge('memory_external_mb');
export const memoryRss = new Gauge('memory_rss_mb');
export const memorySpikePeak = new Gauge('memory_spike_peak_mb');

// Cache metrics
export const cacheHitRate = new Rate('cache_hit_rate');
export const cacheMissRate = new Rate('cache_miss_rate');

// Business metrics
export const publishOperations = new Counter('publish_operations');
export const searchQueries = new Counter('search_queries');
export const readOperations = new Counter('read_operations');

// ============================================================================
// MONITORING CLASSES
// ============================================================================

export class DatabaseMonitor {
  constructor(dbClient) {
    this.dbClient = dbClient;
    this.metrics = {
      totalConnections: [],
      activeConnections: [],
      idleConnections: [],
      peaks: {
        maxConnections: 0,
        peakTime: null,
      },
    };
  }

  async collectMetrics() {
    try {
      const result = await this.dbClient.query(`
        SELECT 
          count(*) as total,
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          max(extract(epoch from (now() - query_start))) as max_query_duration
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const row = result.rows[0];
      const total = parseInt(row.total);
      const active = parseInt(row.active);
      const idle = parseInt(row.idle);

      // Update metrics
      this.metrics.totalConnections.push(total);
      this.metrics.activeConnections.push(active);
      this.metrics.idleConnections.push(idle);

      // Track peak
      if (total > this.metrics.peaks.maxConnections) {
        this.metrics.peaks.maxConnections = total;
        this.metrics.peaks.peakTime = new Date();
      }

      // Report to k6
      dbConnections.set(total);
      dbActiveConnections.set(active);
      dbIdleConnections.set(idle);
      dbConnectionWait.set(parseFloat(row.max_query_duration) || 0);

      return {
        total,
        active,
        idle,
        maxQueryDuration: parseFloat(row.max_query_duration),
      };
    } catch (error) {
      console.error('Database monitoring error:', error);
      return null;
    }
  }

  getSummary() {
    const connections = this.metrics.totalConnections;
    return {
      avgConnections: connections.reduce((a, b) => a + b, 0) / connections.length || 0,
      maxConnections: this.metrics.peaks.maxConnections,
      peakTime: this.metrics.peaks.peakTime,
      highWaterMark: Math.max(...connections),
    };
  }
}

export class MemoryMonitor {
  constructor() {
    this.metrics = {
      samples: [],
      peaks: {
        maxHeap: 0,
        peakTime: null,
        spikeDetections: [],
      },
    };
    this.baseline = null;
  }

  collectMetrics() {
    const memUsage = process.memoryUsage();
    const sample = {
      timestamp: new Date(),
      heap: Math.round(memUsage.heapUsed / 1024 / 1024),  // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    };

    // Set baseline on first sample
    if (!this.baseline) {
      this.baseline = sample;
    }

    this.metrics.samples.push(sample);

    // Detect spikes
    if (this.metrics.samples.length > 1) {
      const prev = this.metrics.samples[this.metrics.samples.length - 2];
      const increase = ((sample.heap - prev.heap) / prev.heap) * 100;
      
      if (increase > 15) {  // 15% increase = spike
        this.metrics.peaks.spikeDetections.push({
          timestamp: sample.timestamp,
          increase: increase.toFixed(2) + '%',
          from: prev.heap,
          to: sample.heap,
        });
      }
    }

    // Track peak
    if (sample.heap > this.metrics.peaks.maxHeap) {
      this.metrics.peaks.maxHeap = sample.heap;
      this.metrics.peaks.peakTime = sample.timestamp;
    }

    // Report to k6
    memoryHeapUsed.set(sample.heap);
    memoryHeapTotal.set(sample.heapTotal);
    memoryExternal.set(sample.external);
    memoryRss.set(sample.rss);
    memorySpikePeak.set(this.metrics.peaks.maxHeap);

    return sample;
  }

  getSummary() {
    if (this.metrics.samples.length === 0) return null;

    const samples = this.metrics.samples;
    const heapValues = samples.map(s => s.heap);
    
    return {
      baseline: this.baseline,
      current: samples[samples.length - 1],
      avgHeap: Math.round(heapValues.reduce((a, b) => a + b) / heapValues.length),
      maxHeap: this.metrics.peaks.maxHeap,
      minHeap: Math.min(...heapValues),
      peakTime: this.metrics.peaks.peakTime,
      spikeCount: this.metrics.peaks.spikeDetections.length,
      spikes: this.metrics.peaks.spikeDetections,
      heapGrowth: this.baseline ? this.metrics.peaks.maxHeap - this.baseline.heap : 0,
    };
  }
}

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: [],
      slowRequests: [],
      errorDetails: [],
    };
  }

  recordRequest(method, path, duration, status) {
    const request = {
      timestamp: new Date(),
      method,
      path,
      duration,
      status,
    };

    this.metrics.requests.push(request);

    // Track slow requests (> 500ms)
    if (duration > 500) {
      this.metrics.slowRequests.push(request);
    }

    // Track errors
    if (status >= 400) {
      this.metrics.errorDetails.push(request);
    }

    // Update k6 metrics
    responseTime.add(duration);
    
    if (status >= 400 || status === 0) {
      errorRate.add(true);
      requestErrors.add(1);
    } else {
      errorRate.add(false);
      requestSuccess.add(true);
    }
  }

  getSummary() {
    const requests = this.metrics.requests;
    if (requests.length === 0) return null;

    const durations = requests.map(r => r.duration).sort((a, b) => a - b);
    const total = durations.length;

    return {
      totalRequests: total,
      avgDuration: Math.round(durations.reduce((a, b) => a + b) / total),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50: durations[Math.floor(total * 0.50)],
      p75: durations[Math.floor(total * 0.75)],
      p90: durations[Math.floor(total * 0.90)],
      p95: durations[Math.floor(total * 0.95)],
      p99: durations[Math.floor(total * 0.99)],
      slowRequests: this.metrics.slowRequests.length,
      errorCount: this.metrics.errorDetails.length,
      errorRate: ((this.metrics.errorDetails.length / total) * 100).toFixed(2) + '%',
    };
  }
}

// ============================================================================
// MONITORING AGGREGATOR
// ============================================================================

export class LoadTestMonitor {
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.memoryMonitor = new MemoryMonitor();
    this.databaseMonitor = null;  // Set when DB client available
    this.startTime = new Date();
  }

  setDatabaseClient(dbClient) {
    this.databaseMonitor = new DatabaseMonitor(dbClient);
  }

  getFullReport() {
    const duration = new Date() - this.startTime;

    return {
      testDuration: `${(duration / 1000).toFixed(2)}s`,
      performance: this.performanceMonitor.getSummary(),
      memory: this.memoryMonitor.getSummary(),
      database: this.databaseMonitor ? this.databaseMonitor.getSummary() : null,
      timestamp: new Date().toISOString(),
    };
  }

  printReport() {
    const report = this.getFullReport();
    
    console.log('\n' + '='.repeat(80));
    console.log('LOAD TEST REPORT');
    console.log('='.repeat(80));
    
    console.log('\nPERFORMANCE METRICS:');
    console.log(`  Requests: ${report.performance.totalRequests}`);
    console.log(`  Avg Duration: ${report.performance.avgDuration}ms`);
    console.log(`  P95: ${report.performance.p95}ms`);
    console.log(`  P99: ${report.performance.p99}ms`);
    console.log(`  Errors: ${report.performance.errorCount} (${report.performance.errorRate})`);
    
    if (report.memory) {
      console.log('\nMEMORY METRICS:');
      console.log(`  Baseline: ${report.memory.baseline.heap}MB`);
      console.log(`  Current: ${report.memory.current.heap}MB`);
      console.log(`  Peak: ${report.memory.maxHeap}MB`);
      console.log(`  Average: ${report.memory.avgHeap}MB`);
      console.log(`  Spikes Detected: ${report.memory.spikeCount}`);
    }
    
    if (report.database) {
      console.log('\nDATABASE METRICS:');
      console.log(`  Avg Connections: ${report.database.avgConnections}`);
      console.log(`  Max Connections: ${report.database.maxConnections}`);
      console.log(`  Peak Time: ${report.database.peakTime}`);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

export default LoadTestMonitor;
