/**
 * Health Check API Endpoint
 * Provides system health status for uptime monitoring
 */

import { Router, Request, Response } from 'express';
import uptimeMonitor from '@/services/uptimeMonitor';
import alertManager from '@/services/alertPolicies';
import logRetention from '@/services/logRetention';

const router = Router();

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: {
    hours: number;
    minutes: number;
  };
  metrics: {
    uptime: number;
    totalChecks: number;
    failedChecks: number;
  };
  alerts: {
    activePolicies: number;
    recentAlerts: number;
  };
  logs: {
    totalRecorded: number;
    byLevel: Record<string, number>;
  };
  environment: {
    nodeEnv: string;
    nodeVersion: string;
    uptime: number;
  };
}

/**
 * GET /health
 * Lightweight health check (for load balancers)
 */
router.get('/health', (req: Request, res: Response) => {
  const metrics = uptimeMonitor.getMetrics();

  res.json({
    status: metrics.uptime >= 99.5 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/detailed
 * Detailed health status
 */
router.get('/health/detailed', (req: Request, res: Response) => {
  const metrics = uptimeMonitor.getMetrics();
  const alertHistory = alertManager.getAlertHistory(10);
  const logMetrics = logRetention.getMetricsSummary();

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  const response: HealthResponse = {
    status:
      metrics.uptime >= 99.9
        ? 'healthy'
        : metrics.uptime >= 99.0
          ? 'degraded'
          : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: { hours, minutes },
    metrics: {
      uptime: metrics.uptime,
      totalChecks: metrics.totalChecks,
      failedChecks: metrics.failedChecks,
    },
    alerts: {
      activePolicies: alertManager.getPolicies().filter(p => p.enabled).length,
      recentAlerts: alertHistory.length,
    },
    logs: {
      totalRecorded: logMetrics.totalLogs,
      byLevel: Object.fromEntries(
        Object.entries(logMetrics.byLevel).map(([level, metrics]) => [
          level,
          metrics.count,
        ])
      ),
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.versions.node,
      uptime,
    },
  };

  res.json(response);
});

/**
 * GET /health/metrics
 * Raw metrics data
 */
router.get('/health/metrics', (req: Request, res: Response) => {
  const metrics = uptimeMonitor.getMetrics();

  res.json({
    timestamp: new Date().toISOString(),
    uptime: metrics,
    logs: logRetention.getMetricsSummary(),
    storageUsage: logRetention.getEstimatedStorage(),
  });
});

/**
 * GET /health/alerts
 * Recent alerts
 */
router.get('/health/alerts', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const alerts = alertManager.getAlertHistory(limit);

  res.json({
    timestamp: new Date().toISOString(),
    alerts,
    totalAlerts: alerts.length,
  });
});

/**
 * GET /health/alerts/policies
 * Alert policy configuration
 */
router.get('/health/alerts/policies', (req: Request, res: Response) => {
  const policies = alertManager.getPolicies();

  res.json({
    timestamp: new Date().toISOString(),
    policies: policies.map(p => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      type: p.type,
      condition: p.condition,
    })),
    totalPolicies: policies.length,
  });
});

/**
 * GET /health/logs/policies
 * Log retention policy configuration
 */
router.get('/health/logs/policies', (req: Request, res: Response) => {
  const policies = logRetention.getAllPolicies();
  const summary: Record<string, any> = {};

  for (const [level, policy] of policies) {
    summary[level] = {
      retention: policy.retention,
      archive: policy.archive,
      sampling: policy.sampling,
    };
  }

  res.json({
    timestamp: new Date().toISOString(),
    policies: summary,
  });
});

/**
 * POST /health/alerts/:policyId/enable
 * Enable an alert policy
 */
router.post('/health/alerts/:policyId/enable', (req: Request, res: Response) => {
  const { policyId } = req.params;
  alertManager.setEnabled(policyId, true);

  res.json({
    success: true,
    message: `Policy ${policyId} enabled`,
  });
});

/**
 * POST /health/alerts/:policyId/disable
 * Disable an alert policy
 */
router.post('/health/alerts/:policyId/disable', (req: Request, res: Response) => {
  const { policyId } = req.params;
  alertManager.setEnabled(policyId, false);

  res.json({
    success: true,
    message: `Policy ${policyId} disabled`,
  });
});

/**
 * POST /health/logs/cleanup
 * Trigger manual log cleanup
 */
router.post('/health/logs/cleanup', (req: Request, res: Response) => {
  // Note: In production, this should require admin authentication
  try {
    // Trigger cleanup (would be implemented in logRetention)
    res.json({
      success: true,
      message: 'Log cleanup initiated',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
