/**
 * Database Configuration and Connection Pooling
 * Advanced PostgreSQL connection management for The Corporate Blog
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const DATABASE_CONFIG = {
  // Connection Pool Settings
  pool: {
    // Production settings for high-traffic scenarios
    production: {
      connectionLimit: 25,        // Max connections per instance
      acquireTimeoutMillis: 30000, // 30 seconds to acquire connection
      createTimeoutMillis: 30000,  // 30 seconds to create connection
      destroyTimeoutMillis: 5000,  // 5 seconds to destroy connection
      idleTimeoutMillis: 300000,   // 5 minutes idle timeout
      reapIntervalMillis: 1000,    // Check for idle connections every second
      createRetryIntervalMillis: 200, // Retry connection creation every 200ms
      propagateCreateError: false,  // Don't crash on connection errors
    },
    
    // Development settings for local development
    development: {
      connectionLimit: 5,          // Lower limit for dev
      acquireTimeoutMillis: 10000, // 10 seconds
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 2000,
      idleTimeoutMillis: 180000,   // 3 minutes
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: true,   // Show errors in development
    },
    
    // Test environment settings
    test: {
      connectionLimit: 2,          // Minimal connections for testing
      acquireTimeoutMillis: 5000,
      createTimeoutMillis: 5000,
      destroyTimeoutMillis: 1000,
      idleTimeoutMillis: 60000,    // 1 minute
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: true,
    }
  },

  // Query Settings
  query: {
    queryTimeout: 30000,       // 30 seconds query timeout
    statementTimeout: 45000,   // 45 seconds statement timeout
    lockTimeout: 60000,        // 60 seconds lock timeout
    idleInTransactionSessionTimeout: 300000, // 5 minutes
  },

  // SSL Configuration
  ssl: {
    production: {
      rejectUnauthorized: true,
      require: true,
    },
    development: {
      rejectUnauthorized: false,
      require: false,
    },
    test: {
      rejectUnauthorized: false,
      require: false,
    }
  },

  // Monitoring & Health Checks
  monitoring: {
    enableMetrics: process.env.NODE_ENV === 'production',
    slowQueryThreshold: 1000,   // Log queries > 1 second
    healthCheckInterval: 30000,  // Check health every 30 seconds
    maxConnectionAge: 3600000,   // Recycle connections after 1 hour
  }
} as const;

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

type Environment = 'production' | 'development' | 'test';

export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment;
  return ['production', 'development', 'test'].includes(env) ? env : 'development';
}

export function getDatabaseConfig(env: Environment = getEnvironment()) {
  return {
    pool: DATABASE_CONFIG.pool[env],
    query: DATABASE_CONFIG.query,
    ssl: DATABASE_CONFIG.ssl[env],
    monitoring: DATABASE_CONFIG.monitoring
  };
}

// ============================================================================
// PRISMA CLIENT CONFIGURATION
// ============================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isProd = process.env.NODE_ENV === 'production';
const config = getDatabaseConfig();

// Enhanced Prisma Client with connection pooling
export const prisma = globalForPrisma.prisma ?? 
  new PrismaClient({
    log: isProd 
      ? ['error', 'warn'] 
      : ['query', 'info', 'warn', 'error'],
    
    errorFormat: 'colored',
    
    datasources: {
      db: {
        url: isProd 
          ? process.env.POSTGRES_PRISMA_URL    // Pooled connection for production
          : process.env.DATABASE_URL           // Direct connection for development
      }
    }
  });

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ============================================================================
// CONNECTION MONITORING
// ============================================================================

interface ConnectionStats {
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  totalConnections: number;
  queriesRun: number;
  lastHealthCheck: Date;
  averageQueryTime: number;
  slowQueries: number;
}

class DatabaseMonitor {
  private stats: ConnectionStats = {
    activeConnections: 0,
    idleConnections: 0,
    waitingConnections: 0,
    totalConnections: 0,
    queriesRun: 0,
    lastHealthCheck: new Date(),
    averageQueryTime: 0,
    slowQueries: 0
  };

  private queryTimes: number[] = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    if (config.monitoring.enableMetrics) {
      this.startHealthCheck();
      this.setupQueryLogging();
    }
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      config.monitoring.healthCheckInterval
    );
  }

  private async performHealthCheck() {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;
      
      this.stats.lastHealthCheck = new Date();
      
      if (duration > config.monitoring.slowQueryThreshold) {
        console.warn(`Slow health check query: ${duration}ms`);
      }

      // Log metrics in production
      if (isProd) {
        console.log('Database Health Check:', {
          duration: `${duration}ms`,
          timestamp: this.stats.lastHealthCheck.toISOString(),
          stats: this.getConnectionStats()
        });
      }
    } catch (error) {
      console.error('Database health check failed:', error);
      
      // Alert on health check failure in production
      if (isProd) {
        // Could integrate with monitoring service here
        // e.g., Sentry, DataDog, etc.
      }
    }
  }

  private setupQueryLogging() {
    // Middleware to track query performance
    prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      // Track query statistics
      this.stats.queriesRun++;
      this.queryTimes.push(duration);
      
      // Keep only last 100 query times for average calculation
      if (this.queryTimes.length > 100) {
        this.queryTimes.shift();
      }
      
      // Update average query time
      this.stats.averageQueryTime = 
        this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;

      // Log slow queries
      if (duration > config.monitoring.slowQueryThreshold) {
        this.stats.slowQueries++;
        console.warn(`Slow query detected:`, {
          action: params.action,
          model: params.model,
          duration: `${duration}ms`,
          args: params.args
        });
      }

      return result;
    });
  }

  getConnectionStats(): ConnectionStats {
    return { ...this.stats };
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Initialize monitor
const monitor = new DatabaseMonitor();

// ============================================================================
// CONNECTION UTILITIES
// ============================================================================

/**
 * Test database connection
 */
export async function testConnection(): Promise<{
  success: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return { success: true, latency };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get database connection status
 */
export async function getConnectionStatus() {
  const connectionTest = await testConnection();
  const stats = monitor.getConnectionStats();
  
  return {
    status: connectionTest.success ? 'connected' : 'disconnected',
    latency: connectionTest.latency,
    error: connectionTest.error,
    environment: getEnvironment(),
    config: config.pool,
    stats,
    timestamp: new Date().toISOString()
  };
}

/**
 * Execute query with connection retry
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, 
        lastError.message);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}

/**
 * Gracefully close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    monitor.cleanup();
    await prisma.$disconnect();
    console.log('Database connections closed gracefully');
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
}

// ============================================================================
// TRANSACTION UTILITIES
// ============================================================================

/**
 * Execute multiple operations in a transaction
 */
export async function executeInTransaction<T>(
  operations: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  return executeWithRetry(async () => {
    return prisma.$transaction(operations, {
      maxWait: 5000,    // 5 seconds max wait for transaction start
      timeout: 30000,   // 30 seconds timeout for entire transaction
      isolationLevel: 'ReadCommitted'
    });
  });
}

// ============================================================================
// CLEANUP HANDLER
// ============================================================================

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connections...');
  await closeDatabaseConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...');
  await closeDatabaseConnections();
  process.exit(0);
});

// Export everything
export default prisma;
export { monitor, PrismaClient };