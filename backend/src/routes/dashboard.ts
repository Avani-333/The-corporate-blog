/**
 * Database Health Dashboard API Route
 * Provides comprehensive database health metrics and monitoring
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import DatabaseHealthMonitor, { DatabaseMetrics } from '@/services/databaseHealthMonitor';

const router = Router();
const prisma = new PrismaClient();
const healthMonitor = new DatabaseHealthMonitor(prisma);

// Initialize monitoring
healthMonitor.start(30000); // 30 second updates

interface DashboardResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  metricsAge: number | null;
  summary: {
    connections: {
      active: number;
      percent: number;
    };
    storage: {
      percent: number;
      status: string;
    };
    performance: {
      cacheHitRatio: number;
      qps: number;
    };
    backup: {
      lastBackup: string | null;
      status: string;
    };
  };
  details: DatabaseMetrics | null;
  alerts: any[];
}

/**
 * GET /dashboard
 * Simple dashboard overview
 */
router.get('/', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();
  const metricsAge = healthMonitor.getMetricsAge();

  if (!metrics) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Database metrics not yet available',
      timestamp: new Date().toISOString(),
    });
  }

  const response: DashboardResponse = {
    status: metrics.status,
    timestamp: new Date().toISOString(),
    metricsAge,
    summary: {
      connections: {
        active: metrics.connection.active,
        percent: Math.round(metrics.connection.percentUsed * 10) / 10,
      },
      storage: {
        percent: Math.round(metrics.storage.percentUsed * 10) / 10,
        status: metrics.storage.percentUsed > 85 ? 'warning' : 'normal',
      },
      performance: {
        cacheHitRatio: Math.round(metrics.performance.cacheHitRatio * 10) / 10,
        qps: Math.round(metrics.performance.qps),
      },
      backup: {
        lastBackup: metrics.backup.lastBackup?.toISOString() || null,
        status: metrics.backup.lastBackupStatus,
      },
    },
    details: metrics,
    alerts: metrics.alerts,
  };

  res.json(response);
});

/**
 * GET /dashboard/overview
 * High-level status only
 */
router.get('/overview', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Database metrics not available',
    });
  }

  res.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    alerts: metrics.alerts.filter((a) => !a.resolved).length,
  });
});

/**
 * GET /dashboard/connections
 * Connection pool metrics
 */
router.get('/connections', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({ error: 'Metrics unavailable' });
  }

  res.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    connections: {
      active: metrics.connection.active,
      idle: metrics.connection.idle,
      idleInTransaction: metrics.connection.idleInTransaction,
      waitingForLock: metrics.connection.waitingForLock,
      total: metrics.connection.total,
      maxConnections: metrics.connection.maxConnections,
      percentUsed: Math.round(metrics.connection.percentUsed * 10) / 10,
      responseTime: `${metrics.connection.responseTime}ms`,
    },
    health: metrics.connection.percentUsed > 80 ? 'warning' : 'healthy',
  });
});

/**
 * GET /dashboard/performance
 * Query performance metrics
 */
router.get('/performance', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({ error: 'Metrics unavailable' });
  }

  res.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    performance: {
      queriesPerSecond: Math.round(metrics.performance.qps * 10) / 10,
      averageQueryTime: `${Math.round(metrics.performance.avgQueryTime * 10) / 10}ms`,
      longestQuery: `${metrics.performance.longestQuery}ms`,
      cacheHitRatio: `${Math.round(metrics.performance.cacheHitRatio * 10) / 10}%`,
      indexScans: metrics.performance.indexScans,
      sequentialScans: metrics.performance.seqScans,
      seqVsIndexRatio: metrics.performance.indexScans > 0 
        ? (metrics.performance.seqScans / metrics.performance.indexScans).toFixed(2)
        : 'N/A',
    },
    slowQueries: metrics.slowQueries.slice(0, 5).map((q) => ({
      query: q.query,
      calls: q.calls,
      averageTime: `${Math.round(q.averageTime * 10) / 10}ms`,
      totalTime: `${Math.round(q.totalTime / 1000)}s`,
    })),
  });
});

/**
 * GET /dashboard/storage
 * Storage and size metrics
 */
router.get('/storage', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({ error: 'Metrics unavailable' });
  }

  res.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    storage: {
      totalSize: metrics.storage.totalSize,
      totalSizeBytes: metrics.storage.totalSizeBytes,
      usedSize: metrics.storage.usedSize,
      percentUsed: Math.round(metrics.storage.percentUsed * 10) / 10,
      health:
        metrics.storage.percentUsed > 85
          ? 'critical'
          : metrics.storage.percentUsed > 70
            ? 'warning'
            : 'healthy',
    },
    tables: {
      count: metrics.storage.tableCount,
      estimatedRows: metrics.storage.estimatedRowCount,
      topBySize: metrics.topTables.slice(0, 5).map((t) => ({
        name: t.name,
        size: t.sizeHuman,
        sizeBytes: t.sizeBytes,
        rows: t.rowCount,
        lastVacuumed: t.lastVacuumed?.toISOString() || 'never',
      })),
    },
  });
});

/**
 * GET /dashboard/backup
 * Backup status and information
 */
router.get('/backup', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({ error: 'Metrics unavailable' });
  }

  const timeSinceBackup = metrics.backup.lastBackup
    ? Date.now() - metrics.backup.lastBackup.getTime()
    : null;

  let backupHealth = 'healthy';
  if (timeSinceBackup && timeSinceBackup > 36 * 60 * 60 * 1000) {
    backupHealth = 'warning'; // No backup in 36+ hours
  }
  if (metrics.backup.lastBackupStatus === 'failed') {
    backupHealth = 'critical';
  }

  res.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    backup: {
      lastBackup: metrics.backup.lastBackup?.toISOString() || null,
      lastBackupStatus: metrics.backup.lastBackupStatus,
      backupSize: metrics.backup.backupSize,
      nextScheduledBackup: metrics.backup.nextScheduledBackup.toISOString(),
      pointInTimeRecoveryAvailable: metrics.backup.pointInTimeRecoveryAvailable,
      retentionDays: metrics.backup.retentionDays,
      timeSinceBackup: timeSinceBackup
        ? `${Math.floor(timeSinceBackup / 60 / 60 / 1000)} hours ago`
        : 'never',
      health: backupHealth,
    },
  });
});

/**
 * GET /dashboard/alerts
 * Active alerts and issues
 */
router.get('/alerts', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({ error: 'Metrics unavailable' });
  }

  const activeAlerts = metrics.alerts.filter((a) => !a.resolved);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const warningAlerts = activeAlerts.filter((a) => a.severity === 'warning');

  res.json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
    summary: {
      total: activeAlerts.length,
      critical: criticalAlerts.length,
      warning: warningAlerts.length,
      info: activeAlerts.filter((a) => a.severity === 'info').length,
    },
    alerts: activeAlerts,
  });
});

/**
 * GET /dashboard/refresh
 * Force immediate metrics refresh
 */
router.get('/refresh', async (req: Request, res: Response) => {
  try {
    const metrics = await healthMonitor.updateMetrics();

    res.json({
      status: 'success',
      message: 'Metrics refreshed',
      timestamp: new Date().toISOString(),
      nextAutoRefresh: new Date(Date.now() + 30000).toISOString(),
      healthStatus: metrics.status,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to refresh metrics',
    });
  }
});

/**
 * GET /dashboard/export
 * Export metrics as JSON or CSV
 */
router.get('/export', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();
  const format = (req.query.format as string) || 'json';

  if (!metrics) {
    return res.status(503).json({ error: 'Metrics unavailable' });
  }

  if (format === 'csv') {
    // Export as CSV
    const csv = `Metric,Value\nStatus,${metrics.status}\nTimestamp,${metrics.timestamp}\nActive Connections,${metrics.connection.active}\nConnection Usage,${metrics.connection.percentUsed.toFixed(1)}%\nStorage Used,${metrics.storage.percentUsed.toFixed(1)}%\nCache Hit Ratio,${metrics.performance.cacheHitRatio.toFixed(1)}%\nQueries Per Second,${metrics.performance.qps.toFixed(1)}\n`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="db-health.csv"');
    res.send(csv);
  } else {
    // Export as JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="db-health.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      metrics,
    });
  }
});

/**
 * Health check endpoint (for load balancers)
 */
router.get('/health', (req: Request, res: Response) => {
  const metrics = healthMonitor.getMetrics();

  if (!metrics) {
    return res.status(503).json({ status: 'unhealthy' });
  }

  const statusCode = metrics.status === 'healthy' ? 200 : metrics.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json({
    status: metrics.status,
    timestamp: new Date().toISOString(),
  });
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  healthMonitor.stop();
});

export default router;
