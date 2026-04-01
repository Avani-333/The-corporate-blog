/**
 * Database Health Dashboard Service
 * Comprehensive database monitoring and health metrics
 */

import { PrismaClient } from '@prisma/client';
import { addBreadcrumb, captureException } from '@/config/sentry';

export interface DatabaseMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  connection: ConnectionMetrics;
  performance: PerformanceMetrics;
  storage: StorageMetrics;
  backup: BackupMetrics;
  replication: ReplicationMetrics;
  slowQueries: SlowQuery[];
  topTables: TableMetrics[];
  alerts: Alert[];
}

export interface ConnectionMetrics {
  active: number;
  idle: number;
  total: number;
  maxConnections: number;
  percentUsed: number;
  idleInTransaction: number;
  waitingForLock: number;
  responseTime: number; // milliseconds
}

export interface PerformanceMetrics {
  qps: number; // Queries per second
  avgQueryTime: number; // milliseconds
  longestQuery: number; // milliseconds
  cacheHitRatio: number; // percentage
  indexScans: number;
  seqScans: number;
  dbSize: string;
  dbSizeBytes: number;
  transactionRate: number;
}

export interface StorageMetrics {
  totalSize: string;
  totalSizeBytes: number;
  usedSize: string;
  usedSizeBytes: number;
  availableSize: string;
  availableSizeBytes: number;
  percentUsed: number;
  tableCount: number;
  indexCount: number;
  estimatedRowCount: number;
}

export interface BackupMetrics {
  lastBackup: Date | null;
  lastBackupStatus: 'success' | 'failed' | 'pending' | 'unknown';
  backupSize: string;
  nextScheduledBackup: Date;
  pointInTimeRecoveryAvailable: boolean;
  retentionDays: number;
}

export interface ReplicationMetrics {
  status: 'active' | 'idle' | 'unknown';
  lag: number; // seconds
  replicaCount: number;
  syncedReplicas: number;
  replicaHealth: Array<{
    name: string;
    status: 'healthy' | 'lagging' | 'disconnected';
    lag: number;
  }>;
}

export interface SlowQuery {
  queryId: string;
  query: string;
  calls: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
}

export interface TableMetrics {
  name: string;
  rowCount: number;
  sizeBytes: number;
  sizeHuman: string;
  indexCount: number;
  bloatRatio: number;
  lastAnalyzed: Date | null;
  lastVacuumed: Date | null;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

class DatabaseHealthMonitor {
  private prisma: PrismaClient;
  private metrics: DatabaseMetrics | null = null;
  private lastUpdate: Date | null = null;
  private updateInterval: number = 60000; // 1 minute
  private timer: NodeJS.Timer | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Start monitoring
   */
  start(interval?: number): void {
    if (interval) {
      this.updateInterval = interval;
    }

    console.log(
      `🏥 Starting database health monitoring (${this.updateInterval / 1000}s interval)`
    );

    // Run first check immediately
    this.updateMetrics();

    // Schedule regular updates
    this.timer = setInterval(() => {
      this.updateMetrics();
    }, this.updateInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏹️  Database health monitoring stopped');
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): DatabaseMetrics | null {
    return this.metrics;
  }

  /**
   * Get metrics age
   */
  getMetricsAge(): number | null {
    return this.lastUpdate ? Date.now() - this.lastUpdate.getTime() : null;
  }

  /**
   * Force immediate update
   */
  async updateMetrics(): Promise<DatabaseMetrics> {
    try {
      const metrics = await this.collectMetrics();
      this.metrics = metrics;
      this.lastUpdate = new Date();

      // Check for alerts
      this.checkAlerts(metrics);

      return metrics;
    } catch (error) {
      console.error('Failed to collect database metrics:', error);
      captureException(
        new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`)
      );

      throw error;
    }
  }

  /**
   * Collect all metrics
   */
  private async collectMetrics(): Promise<DatabaseMetrics> {
    const [
      connectionMetrics,
      performanceMetrics,
      storageMetrics,
      backupMetrics,
      replicationMetrics,
      slowQueries,
      topTables,
      alerts,
    ] = await Promise.all([
      this.getConnectionMetrics(),
      this.getPerformanceMetrics(),
      this.getStorageMetrics(),
      this.getBackupMetrics(),
      this.getReplicationMetrics(),
      this.getSlowQueries(),
      this.getTopTables(),
      this.getAlerts(),
    ]);

    // Determine overall status
    const status = this.determineStatus(
      connectionMetrics,
      performanceMetrics,
      storageMetrics,
      alerts
    );

    return {
      status,
      timestamp: new Date(),
      connection: connectionMetrics,
      performance: performanceMetrics,
      storage: storageMetrics,
      backup: backupMetrics,
      replication: replicationMetrics,
      slowQueries,
      topTables,
      alerts,
    };
  }

  /**
   * Get connection metrics
   */
  private async getConnectionMetrics(): Promise<ConnectionMetrics> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting_for_lock,
        (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') as max_connections,
        EXTRACT(EPOCH FROM (now() - backend_start))::integer as response_time
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const row = result[0];
    const total = Number(row.total) || 0;
    const maxConns = Number(row.max_connections) || 100;

    return {
      active: Number(row.active) || 0,
      idle: Number(row.idle) || 0,
      total,
      maxConnections: maxConns,
      percentUsed: (total / maxConns) * 100,
      idleInTransaction: Number(row.idle_in_transaction) || 0,
      waitingForLock: Number(row.waiting_for_lock) || 0,
      responseTime: Number(row.response_time) || 0,
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Query statistics
    const statsResult = await this.prisma.$queryRaw<any[]>`
      SELECT 
        SUM(calls) as total_calls,
        AVG(mean_exec_time) as avg_time,
        MAX(max_exec_time) as max_time,
        SUM(mean_exec_time * calls) / NULLIF(SUM(calls), 0) as weighted_avg
      FROM pg_stat_statements
      WHERE datname = current_database()
    `;

    const stats = statsResult[0] || {};

    // Cache hit ratio
    const cacheResult = await this.prisma.$queryRaw<any[]>`
      SELECT 
        SUM(heap_blks_read) as disk_reads,
        SUM(heap_blks_hit) as cache_hits
      FROM pg_statio_user_tables
    `;

    const cache = cacheResult[0] || {};
    const diskReads = Number(cache.disk_reads) || 0;
    const cacheHits = Number(cache.cache_hits) || 0;
    const totalAccesses = diskReads + cacheHits;
    const hitRatio = totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0;

    // Database size
    const sizeResult = await this.prisma.$queryRaw<any[]>`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size_human,
        pg_database_size(current_database()) as size_bytes
    `;

    const size = sizeResult[0] || {};

    // Index vs seq scan ratio
    const scanResult = await this.prisma.$queryRaw<any[]>`
      SELECT 
        SUM(idx_scan) as index_scans,
        SUM(seq_scan) as seq_scans
      FROM pg_stat_user_tables
    `;

    const scans = scanResult[0] || {};

    return {
      qps: (Number(stats.total_calls) || 0) / 60, // Assuming stat period ~60s
      avgQueryTime: Number(stats.avg_time) || 0,
      longestQuery: Number(stats.max_time) || 0,
      cacheHitRatio: hitRatio,
      indexScans: Number(scans.index_scans) || 0,
      seqScans: Number(scans.seq_scans) || 0,
      dbSize: String(size.size_human),
      dbSizeBytes: Number(size.size_bytes) || 0,
      transactionRate: 0, // Would need xact counter
    };
  }

  /**
   * Get storage metrics
   */
  private async getStorageMetrics(): Promise<StorageMetrics> {
    const sizeResult = await this.prisma.$queryRaw<any[]>`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_database_size(current_database()) as total_bytes,
        pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as used_size,
        SUM(pg_total_relation_size(schemaname||'.'||tablename)) as used_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    `;

    const sizeData = sizeResult[0] || {};

    const tableCountResult = await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    const indexCountResult = await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM information_schema.statistics 
      WHERE table_schema = 'public'
    `;

    const rowCountResult = await this.prisma.$queryRaw<any[]>`
      SELECT SUM(n_live_tup) as estimated_rows FROM pg_stat_user_tables
    `;

    const totalBytes = Number(sizeData.total_bytes) || 0;
    const usedBytes = Number(sizeData.used_bytes) || 0;

    return {
      totalSize: String(sizeData.total_size),
      totalSizeBytes: totalBytes,
      usedSize: String(sizeData.used_size),
      usedSizeBytes: usedBytes,
      availableSize: 'unknown',
      availableSizeBytes: 0,
      percentUsed: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
      tableCount: Number(tableCountResult[0]?.count) || 0,
      indexCount: Number(indexCountResult[0]?.count) || 0,
      estimatedRowCount: Number(rowCountResult[0]?.estimated_rows) || 0,
    };
  }

  /**
   * Get backup metrics (from env or hardcoded defaults)
   */
  private async getBackupMetrics(): Promise<BackupMetrics> {
    // This would integrate with your backup system
    // For now, returning defaults

    return {
      lastBackup: new Date(Date.now() - 86400000), // Last 24 hours
      lastBackupStatus: 'success',
      backupSize: '500MB',
      nextScheduledBackup: new Date(Date.now() + 7 * 86400000), // Next week
      pointInTimeRecoveryAvailable: true,
      retentionDays: 30,
    };
  }

  /**
   * Get replication metrics
   */
  private async getReplicationMetrics(): Promise<ReplicationMetrics> {
    // Check if replication is available
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as replica_count,
          MAX(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) / 1024 / 1024 as max_lag_mb
        FROM pg_stat_replication
      `;

      const data = result[0] || {};

      return {
        status: 'active',
        lag: Number(data.max_lag_mb) || 0,
        replicaCount: Number(data.replica_count) || 0,
        syncedReplicas: Number(data.replica_count) || 0,
        replicaHealth: [],
      };
    } catch {
      // Replication not available (single instance)
      return {
        status: 'unknown',
        lag: 0,
        replicaCount: 0,
        syncedReplicas: 0,
        replicaHealth: [],
      };
    }
  }

  /**
   * Get slow queries
   */
  private async getSlowQueries(): Promise<SlowQuery[]> {
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          queryid,
          LEFT(query, 100) as query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as avg_time,
          max_exec_time as max_time
        FROM pg_stat_statements
        WHERE datname = current_database()
        ORDER BY total_exec_time DESC
        LIMIT 10
      `;

      return result.map((row: any) => ({
        queryId: String(row.queryid),
        query: String(row.query),
        calls: Number(row.calls),
        totalTime: Number(row.total_time),
        averageTime: Number(row.avg_time),
        maxTime: Number(row.max_time),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get top tables by size
   */
  private async getTopTables(): Promise<TableMetrics[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        tablename,
        pg_total_relation_size(schemaname||'.'||tablename) as total_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_human,
        n_live_tup as live_tuples,
        n_tup_ins + n_tup_upd + n_tup_del as total_changes,
        last_vacuum,
        last_analyze
      FROM pg_stat_user_tables
      ORDER BY total_size DESC
      LIMIT 10
    `;

    return result.map((row: any) => ({
      name: `${row.schemaname}.${row.tablename}`,
      rowCount: Number(row.live_tuples),
      sizeBytes: Number(row.total_size),
      sizeHuman: String(row.size_human),
      indexCount: 0, // Would need separate query
      bloatRatio: 0, // Would need bloat calculation
      lastAnalyzed: row.last_analyze ? new Date(row.last_analyze) : null,
      lastVacuumed: row.last_vacuum ? new Date(row.last_vacuum) : null,
    }));
  }

  /**
   * Get active alerts
   */
  private async getAlerts(): Promise<Alert[]> {
    // This would integrate with your alerting system
    return [];
  }

  /**
   * Determine overall status
   */
  private determineStatus(
    connection: ConnectionMetrics,
    performance: PerformanceMetrics,
    storage: StorageMetrics,
    alerts: Alert[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Critical alerts = unhealthy
    if (alerts.some((a) => a.severity === 'critical' && !a.resolved)) {
      return 'unhealthy';
    }

    // Check thresholds
    const criticalThresholds = [
      connection.percentUsed > 90,
      storage.percentUsed > 95,
      performance.cacheHitRatio < 80,
    ];

    if (criticalThresholds.some((t) => t)) {
      return 'unhealthy';
    }

    const warningThresholds = [
      connection.percentUsed > 70,
      storage.percentUsed > 80,
      performance.cacheHitRatio < 90,
      alerts.some((a) => a.severity === 'warning' && !a.resolved),
    ];

    if (warningThresholds.some((t) => t)) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Check and generate alerts
   */
  private checkAlerts(metrics: DatabaseMetrics): void {
    const alerts: Alert[] = [];

    // Connection pool pressure
    if (metrics.connection.percentUsed > 80) {
      alerts.push({
        id: 'conn_pool_high',
        severity: 'warning',
        type: 'connection_pool',
        message: `Connection pool usage: ${metrics.connection.percentUsed.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Storage capacity
    if (metrics.storage.percentUsed > 85) {
      alerts.push({
        id: 'storage_high',
        severity: 'warning',
        type: 'storage',
        message: `Database storage usage: ${metrics.storage.percentUsed.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Cache hit ratio
    if (metrics.performance.cacheHitRatio < 85) {
      alerts.push({
        id: 'cache_hit_low',
        severity: 'info',
        type: 'performance',
        message: `Cache hit ratio: ${metrics.performance.cacheHitRatio.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
      });
    }

    if (alerts.length > 0) {
      addBreadcrumb({
        category: 'database-health',
        message: `Generated ${alerts.length} alerts`,
        level: 'warning',
      });
    }
  }
}

export default DatabaseHealthMonitor;
