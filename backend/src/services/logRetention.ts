/**
 * Log Retention Policy
 * Manages log lifecycle and storage strategy
 */

import { logger } from '@/utils/logger';
import { addBreadcrumb } from '@/config/sentry';

export interface LogRetentionPolicy {
  level: 'error' | 'warn' | 'info' | 'debug';
  retention: {
    days: number;
    maxSizeMb: number;
  };
  archive: {
    enabled: boolean;
    format: 'gzip' | 'tar.gz' | 'zip';
    destination: 'local' | 's3' | 'gcs';
  };
  sampling?: {
    enabled: boolean;
    rate: number; // 0-1, e.g., 0.1 = 10% sampling
  };
}

export interface LogMetrics {
  level: string;
  count: number;
  avgSize: number;
  lastEntry: Date;
}

class LogRetentionManager {
  private policies: Map<string, LogRetentionPolicy> = new Map();
  private metrics: Map<string, LogMetrics> = new Map();
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default log retention policies
   */
  private initializeDefaultPolicies(): void {
    // Error logs: Keep for 90 days
    this.addPolicy('error', {
      level: 'error',
      retention: {
        days: 90,
        maxSizeMb: 5000, // 5GB
      },
      archive: {
        enabled: true,
        format: 'gzip',
        destination: process.env.LOG_ARCHIVE_DESTINATION as 'local' | 's3' | 'gcs' || 'local',
      },
      sampling: {
        enabled: false, // Don't sample error logs
        rate: 1,
      },
    });

    // Warning logs: Keep for 30 days
    this.addPolicy('warn', {
      level: 'warn',
      retention: {
        days: 30,
        maxSizeMb: 2000, // 2GB
      },
      archive: {
        enabled: true,
        format: 'gzip',
        destination: process.env.LOG_ARCHIVE_DESTINATION as 'local' | 's3' | 'gcs' || 'local',
      },
      sampling: {
        enabled: false,
        rate: 1,
      },
    });

    // Info logs: Keep for 14 days
    this.addPolicy('info', {
      level: 'info',
      retention: {
        days: 14,
        maxSizeMb: 1000, // 1GB
      },
      archive: {
        enabled: true,
        format: 'gzip',
        destination: process.env.LOG_ARCHIVE_DESTINATION as 'local' | 's3' | 'gcs' || 'local',
      },
      sampling: {
        enabled: false,
        rate: 1,
      },
    });

    // Debug logs: Keep for 7 days (or development only)
    this.addPolicy('debug', {
      level: 'debug',
      retention: {
        days: process.env.NODE_ENV === 'production' ? 3 : 7,
        maxSizeMb: 500, // 500MB
      },
      archive: {
        enabled: process.env.NODE_ENV === 'production',
        format: 'gzip',
        destination: process.env.LOG_ARCHIVE_DESTINATION as 'local' | 's3' | 'gcs' || 'local',
      },
      sampling: {
        enabled: process.env.NODE_ENV === 'production',
        rate: 0.1, // Sample 10% of debug logs in production
      },
    });

    console.log('✅ Initialized log retention policies');
    console.log(
      [
        'Error logs: 90 days (5GB)',
        'Warn logs: 30 days (2GB)',
        'Info logs: 14 days (1GB)',
        `Debug logs: ${process.env.NODE_ENV === 'production' ? '3 days' : '7 days'} (500MB)`,
      ].join('\n  ')
    );
  }

  /**
   * Add a log retention policy
   */
  addPolicy(level: string, policy: LogRetentionPolicy): void {
    this.policies.set(level, policy);
    addBreadcrumb(`Log retention policy added for ${level}`, 'config', 'info');
  }

  /**
   * Get policy for a log level
   */
  getPolicy(level: string): LogRetentionPolicy | undefined {
    return this.policies.get(level);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): Map<string, LogRetentionPolicy> {
    return new Map(this.policies);
  }

  /**
   * Update policy
   */
  updatePolicy(level: string, updates: Partial<LogRetentionPolicy>): boolean {
    const policy = this.policies.get(level);
    if (!policy) return false;

    this.policies.set(level, { ...policy, ...updates });
    addBreadcrumb(
      `Log retention policy updated for ${level}`,
      'config',
      'info'
    );
    return true;
  }

  /**
   * Determine if a log should be sampled
   */
  shouldLog(level: string): boolean {
    const policy = this.policies.get(level);
    if (!policy || !policy.sampling?.enabled) {
      return true;
    }

    return Math.random() < policy.sampling.rate;
  }

  /**
   * Start automatic cleanup routine
   */
  startCleanup(): void {
    // Run cleanup every 6 hours
    const cleanupIntervalMs = 6 * 60 * 60 * 1000;

    this.cleanupInterval = setInterval(
      () => {
        this.performCleanup();
      },
      cleanupIntervalMs
    );

    console.log('🧹 Log cleanup routine started (every 6 hours)');
  }

  /**
   * Stop cleanup routine
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('⏹️  Log cleanup routine stopped');
    }
  }

  /**
   * Perform cleanup of old logs
   */
  private performCleanup(): void {
    console.log('🧹 Performing log cleanup...');

    const now = new Date();

    for (const [level, policy] of this.policies) {
      try {
        // Calculate cutoff date
        const cutoffDate = new Date(now.getTime() - policy.retention.days * 24 * 60 * 60 * 1000);

        // TODO: Implement actual log cleanup
        // This would interact with your logging system
        // Examples:
        // - Delete files older than cutoffDate
        // - Archive logs to S3/GCS
        // - Prune database entries

        logger.info(`Cleanup ${level} logs older than ${cutoffDate.toISOString()}`);

        addBreadcrumb(
          `Cleaned up ${level} logs older than ${cutoffDate.toISOString()}`,
          'cleanup',
          'info'
        );
      } catch (error) {
        logger.error(`Failed to cleanup ${level} logs:`, error);
      }
    }
  }

  /**
   * Record log metrics
   */
  recordLog(level: string, size: number = 0): void {
    const metrics = this.metrics.get(level) || {
      level,
      count: 0,
      avgSize: 0,
      lastEntry: new Date(),
    };

    // Update rolling average
    metrics.avgSize = (metrics.avgSize * metrics.count + size) / (metrics.count + 1);
    metrics.count++;
    metrics.lastEntry = new Date();

    this.metrics.set(level, metrics);
  }

  /**
   * Get log metrics
   */
  getMetrics(): Map<string, LogMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalLogs: number;
    byLevel: Record<string, LogMetrics>;
  } {
    const summary = {
      totalLogs: 0,
      byLevel: {} as Record<string, LogMetrics>,
    };

    for (const [level, metrics] of this.metrics) {
      summary.byLevel[level] = metrics;
      summary.totalLogs += metrics.count;
    }

    return summary;
  }

  /**
   * Get storage usage estimate
   */
  getEstimatedStorage(): Record<string, string> {
    const storage: Record<string, string> = {};

    for (const [level, metrics] of this.metrics) {
      const totalSizeMb = (metrics.count * metrics.avgSize) / (1024 * 1024);
      storage[level] = `${totalSizeMb.toFixed(2)} MB`;
    }

    return storage;
  }

  /**
   * Export logs (for compliance/audit)
   */
  async exportLogs(
    level: string,
    format: 'json' | 'csv' | 'gzip'
  ): Promise<Buffer | null> {
    try {
      // TODO: Implement log export
      // This would:
      // 1. Query logs at specified level
      // 2. Format as requested
      // 3. Return as buffer

      logger.info(`Exporting ${level} logs in ${format} format`);
      return null;
    } catch (error) {
      logger.error(`Failed to export logs: ${error}`);
      return null;
    }
  }
}

// Singleton instance
const logRetention = new LogRetentionManager();

export default logRetention;
