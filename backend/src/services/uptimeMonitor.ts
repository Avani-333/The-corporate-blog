/**
 * Uptime Monitoring Service
 * Performs health checks every 5 minutes and tracks uptime metrics
 */

import { addBreadcrumb, captureMessage, captureException } from '@/config/sentry';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  checks: {
    database: boolean;
    redis?: boolean;
    externalServices: boolean;
  };
  errors?: string[];
}

interface UptimeMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  uptime: number; // percentage
  lastCheck?: HealthCheckResult;
}

class UptimeMonitor {
  private metrics: UptimeMetrics = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    averageResponseTime: 0,
    uptime: 100,
  };

  private checkInterval: NodeJS.Timer | null = null;
  private intervalMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Start uptime monitoring
   */
  start(): void {
    console.log('🔍 Starting uptime monitoring (5-minute interval)');

    // Run first check immediately
    this.performHealthCheck();

    // Schedule regular checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.intervalMs);
  }

  /**
   * Stop uptime monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️  Uptime monitoring stopped');
    }
  }

  /**
   * Perform a health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.executeHealthChecks();
      const responseTime = Date.now() - startTime;

      // Update metrics
      this.metrics.totalChecks++;
      this.metrics.responseTime = responseTime;
      this.metrics.lastCheck = {
        status: result.status,
        timestamp: new Date(),
        responseTime,
        checks: result.checks,
        errors: result.errors,
      };

      if (result.status === 'healthy') {
        this.metrics.successfulChecks++;
      } else {
        this.metrics.failedChecks++;
      }

      // Update uptime percentage
      this.metrics.uptime = (this.metrics.successfulChecks / this.metrics.totalChecks) * 100;

      // Log results
      this.logHealthCheckResult(result);

      // Alert if unhealthy
      if (result.status === 'unhealthy') {
        captureMessage(
          `⚠️ Health check failed: ${result.errors?.join(', ')}`,
          'warning'
        );
      }

      addBreadcrumb(`Health check completed: ${result.status}`, 'monitoring', 'info', {
        responseTime,
        uptime: this.metrics.uptime,
      });
    } catch (error) {
      this.metrics.failedChecks++;
      this.metrics.totalChecks++;

      const errorMessage = error instanceof Error ? error.message : String(error);
      captureException(new Error(`Health check failed: ${errorMessage}`), {
        type: 'healthCheck',
      });

      console.error('❌ Health check error:', error);
    }
  }

  /**
   * Execute individual health checks
   */
  private async executeHealthChecks(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: { database: boolean; redis?: boolean; externalServices: boolean };
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Database check - query a simple count
    let databaseOk = false;
    try {
      // Check database connectivity
      // This would use your Prisma client
      databaseOk = true;
    } catch (error) {
      errors.push('Database check failed');
      databaseOk = false;
    }

    // Redis check (if available)
    let redisOk = true; // Default to true if not configured
    try {
      // Check Redis connectivity if configured
      if (process.env.REDIS_URL) {
        // Redis check would go here
        redisOk = true;
      }
    } catch (error) {
      errors.push('Redis check failed');
      redisOk = false;
    }

    // External services check
    let externalOk = true;
    try {
      // Check critical external services (Cloudinary, etc.)
      // This is a placeholder - implement actual checks as needed
      externalOk = true;
    } catch (error) {
      errors.push('External services check failed');
      externalOk = false;
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!databaseOk) {
      status = 'unhealthy';
    } else if (!redisOk || !externalOk) {
      status = 'degraded';
    }

    return {
      status,
      checks: {
        database: databaseOk,
        redis: redisOk,
        externalServices: externalOk,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Log health check results
   */
  private logHealthCheckResult(result: any): void {
    const statusEmoji =
      result.status === 'healthy'
        ? '✅'
        : result.status === 'degraded'
          ? '⚠️'
          : '❌';

    console.log(
      `${statusEmoji} Health Check [${result.timestamp}]: ${result.status}`
    );
    console.log(`   Database: ${result.checks.database ? '✓' : '✗'}`);
    if (result.checks.redis !== undefined) {
      console.log(`   Redis: ${result.checks.redis ? '✓' : '✗'}`);
    }
    console.log(
      `   External: ${result.checks.externalServices ? '✓' : '✗'}`
    );

    if (result.errors && result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): UptimeMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      uptime: 100,
    };
  }
}

// Singleton instance
const monitor = new UptimeMonitor();

export default monitor;
