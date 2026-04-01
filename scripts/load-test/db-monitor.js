#!/usr/bin/env node

/**
 * Database Connection Monitor for Load Testing
 * Tracks PostgreSQL connections in real-time during load tests
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/blog_db';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000;  // 2 seconds
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'db-monitoring.json';
const REPORT_INTERVAL = process.env.REPORT_INTERVAL || 30000;  // 30 seconds

// ============================================================================
// MONITORING CLASS
// ============================================================================

class DatabaseMonitor {
  constructor() {
    this.client = null;
    this.samples = [];
    this.peaks = {
      totalConnections: 0,
      activeConnections: 0,
      memoryUsage: 0,
    };
    this.startTime = new Date();
    this.isRunning = false;
  }

  async connect() {
    try {
      this.client = new Client({ connectionString: DATABASE_URL });
      await this.client.connect();
      console.log(`${GREEN}✓${RESET} Connected to database`);
      return true;
    } catch (error) {
      console.error(`${RED}✗${RESET} Failed to connect to database:`, error.message);
      return false;
    }
  }

  async collectMetrics() {
    try {
      // Get connection details
      const connResult = await this.client.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          max(extract(epoch from (now() - query_start))) as longest_query_seconds
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      // Get database size
      const sizeResult = await this.client.query(`
        SELECT 
          pg_size_pretty(pg_database.datsize) as size,
          pg_database.datsize as size_bytes
        FROM (SELECT pg_database_size(current_database()) as datsize) as pg_database
      `);

      // Get cache usage
      const cacheResult = await this.client.query(`
        SELECT 
          sum(heap_blks_read) as heap_read,
          sum(heap_blks_hit) as heap_hit,
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_ratio
        FROM pg_statio_user_tables
      `);

      const sample = {
        timestamp: new Date(),
        connections: {
          total: parseInt(connResult.rows[0].total_connections),
          active: parseInt(connResult.rows[0].active_connections),
          idle: parseInt(connResult.rows[0].idle_connections),
          idleInTransaction: parseInt(connResult.rows[0].idle_in_transaction),
          longestQuerySeconds: parseFloat(connResult.rows[0].longest_query_seconds) || 0,
        },
        database: {
          size: sizeResult.rows[0].size,
          sizeBytes: parseInt(sizeResult.rows[0].size_bytes),
        },
        cache: {
          hitRatio: parseFloat(cacheResult.rows[0].cache_ratio) || 0,
          heapRead: parseInt(cacheResult.rows[0].heap_read) || 0,
          heapHit: parseInt(cacheResult.rows[0].heap_hit) || 0,
        },
      };

      this.samples.push(sample);
      this.updatePeaks(sample);

      return sample;
    } catch (error) {
      console.error(`${RED}✗${RESET} Error collecting metrics:`, error.message);
      return null;
    }
  }

  updatePeaks(sample) {
    if (sample.connections.total > this.peaks.totalConnections) {
      this.peaks.totalConnections = sample.connections.total;
    }
    if (sample.connections.active > this.peaks.activeConnections) {
      this.peaks.activeConnections = sample.connections.active;
    }
  }

  async start() {
    if (!await this.connect()) {
      process.exit(1);
    }

    this.isRunning = true;
    console.log(`${BLUE}Starting database monitoring (every ${POLL_INTERVAL}ms)${RESET}\n`);

    // Start metrics collection
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, POLL_INTERVAL);

    // Start periodic reports
    this.reportInterval = setInterval(() => {
      this.printCurrentStatus();
    }, REPORT_INTERVAL);

    // Print initial status
    await this.collectMetrics();
    this.printCurrentStatus();
  }

  async stop() {
    this.isRunning = false;
    clearInterval(this.metricsInterval);
    clearInterval(this.reportInterval);

    if (this.client) {
      await this.client.end();
    }

    console.log(`\n${GREEN}✓${RESET} Monitoring stopped\n`);
  }

  printCurrentStatus() {
    if (this.samples.length === 0) return;

    const latest = this.samples[this.samples.length - 1];
    const elapsed = Math.floor((new Date() - this.startTime) / 1000);

    console.log(`${BLUE}[${new Date().toLocaleTimeString()}] Database Status (elapsed: ${elapsed}s)${RESET}`);
    console.log(`  ${GREEN}Total Connections:${RESET} ${latest.connections.total}/${this.peaks.totalConnections} peak`);
    console.log(`  ${GREEN}Active Queries:${RESET} ${latest.connections.active} (${this.peaks.activeConnections} peak)`);
    console.log(`  ${GREEN}Idle Connections:${RESET} ${latest.connections.idle}`);
    console.log(`  ${GREEN}Idle in Transaction:${RESET} ${latest.connections.idleInTransaction}`);

    if (latest.connections.longestQuerySeconds > 0) {
      console.log(`  ${YELLOW}⚠ Longest Query:${RESET} ${latest.connections.longestQuerySeconds.toFixed(2)}s`);
    }

    console.log(`  ${GREEN}Cache Hit Ratio:${RESET} ${(latest.cache.hitRatio * 100).toFixed(2)}%`);
    console.log(`  ${GREEN}Database Size:${RESET} ${latest.database.size}`);
    console.log('');

    // Alert on high connections
    if (latest.connections.total > 20) {
      console.log(`  ${YELLOW}⚠ WARNING: High connection count (${latest.connections.total}/25)${RESET}`);
    }
  }

  async generateReport() {
    const report = {
      startTime: this.startTime,
      endTime: new Date(),
      durationSeconds: Math.floor((new Date() - this.startTime) / 1000),
      samples: this.samples,
      peaks: this.peaks,
      summary: {
        totalSamples: this.samples.length,
        avgConnections: this.calculateAverage('connections.total'),
        maxConnections: this.peaks.totalConnections,
        avgCacheHitRatio: this.calculateAverage('cache.hitRatio'),
        avgQueryDuration: this.calculateAverage('connections.longestQuerySeconds'),
      },
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
    console.log(`${GREEN}✓${RESET} Report saved: ${OUTPUT_FILE}`);

    // Print summary
    this.printSummary(report);

    return report;
  }

  calculateAverage(path) {
    if (this.samples.length === 0) return 0;

    const values = this.samples.map(s => {
      let value = s;
      for (const key of path.split('.')) {
        value = value[key];
      }
      return value;
    });

    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  printSummary(report) {
    console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
    console.log(`${BLUE}DATABASE MONITORING REPORT${RESET}`);
    console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);

    const summary = report.summary;

    console.log(`${GREEN}Test Duration:${RESET} ${summary.durationSeconds} seconds`);
    console.log(`${GREEN}Total Samples:${RESET} ${summary.totalSamples}\n`);

    console.log(`${GREEN}Connection Statistics:${RESET}`);
    console.log(`  Average: ${summary.avgConnections.toFixed(1)}`);
    console.log(`  Peak: ${summary.maxConnections}\n`);

    console.log(`${GREEN}Performance:${RESET}`);
    console.log(`  Avg Cache Hit Ratio: ${(summary.avgCacheHitRatio * 100).toFixed(2)}%`);
    console.log(`  Avg Longest Query: ${summary.avgQueryDuration.toFixed(2)}s\n`);

    console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const monitor = new DatabaseMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(`\n${YELLOW}Shutting down...${RESET}`);
    await monitor.stop();
    const report = await monitor.generateReport();
    process.exit(0);
  });

  // Start monitoring
  await monitor.start();
}

main().catch(error => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});

module.exports = DatabaseMonitor;
