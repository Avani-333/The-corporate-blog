/**
 * Database Query Monitoring & N+1 Detection
 * 
 * This utility monitors database queries and detects N+1 patterns
 * in real-time during development and testing.
 * 
 * Usage:
 * - Enable in development: LOG_QUERIES=true npm run dev
 * - Add to prisma.$use middleware for runtime monitoring
 * - Set breakpoints for production debugging
 * 
 * @see docs/DATABASE_OPTIMIZATION_QUICK_REFERENCE.md
 * @see docs/DATABASE_OPTIMIZATION_IMPLEMENTATION_COMPLETE.md
 */

import { Prisma } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

interface QueryRecord {
  timestamp: number;
  duration: number;
  model: string;
  action: string;
  args: any;
  stack?: string;
}

interface QueryPattern {
  model: string;
  action: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  lastSeen: number;
  isN1Pattern: boolean;
}

// ============================================================================
// QUERY RECORDING
// ============================================================================

let queryLog: QueryRecord[] = [];
const patternMap = new Map<string, QueryPattern>();

export function startQueryMonitoring(prisma: any) {
  if (process.env.LOG_QUERIES !== 'true') {
    return;
  }

  // Use Prisma middleware to log all queries
  prisma.$use(async (params: any, next: any) => {
    const startTime = Date.now();

    try {
      const result = await next(params);
      const duration = Date.now() - startTime;

      recordQuery({
        timestamp: startTime,
        duration,
        model: params.model,
        action: params.action,
        args: params.args,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      recordQuery({
        timestamp: startTime,
        duration,
        model: params.model,
        action: params.action,
        args: params.args,
      });

      throw error;
    }
  });
}

function recordQuery(query: QueryRecord) {
  queryLog.push(query);

  const key = `${query.model}.${query.action}`;
  const existing = patternMap.get(key);

  if (existing) {
    existing.count++;
    existing.totalDuration += query.duration;
    existing.avgDuration = existing.totalDuration / existing.count;
    existing.lastSeen = query.timestamp;
  } else {
    patternMap.set(key, {
      model: query.model,
      action: query.action,
      count: 1,
      totalDuration: query.duration,
      avgDuration: query.duration,
      lastSeen: query.timestamp,
      isN1Pattern: false,
    });
  }
}

// ============================================================================
// N+1 DETECTION
// ============================================================================

/**
 * Analyzes query patterns to detect N+1 problems
 * 
 * Heuristics:
 * - Multiple findMany/findFirst calls in rapid succession with similar parameters
 * - Loop patterns: Same query repeated with different WHERE clauses
 * - Separate queries for related data that could be joined
 */
export function analyzeForN1Patterns(): QueryPattern[] {
  const window = 1000; // Look at queries within 1 second windows
  const suspiciousPatterns: QueryPattern[] = [];

  // Find patterns with multiple same queries in short time window
  patternMap.forEach((pattern) => {
    // More than 3 of the same query in rapid succession is suspicious
    if (pattern.count > 3) {
      // Check if queries are happening within small time windows
      const queriesInWindow = queryLog.filter(
        (q) => q.model === pattern.model && q.action === pattern.action
      );

      const timestamps = queriesInWindow.map((q) => q.timestamp);
      const gaps: number[] = [];

      for (let i = 1; i < timestamps.length; i++) {
        gaps.push(timestamps[i] - timestamps[i - 1]);
      }

      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

      // If queries are happening every 5ms or faster, likely N+1
      if (avgGap < 10) {
        pattern.isN1Pattern = true;
        suspiciousPatterns.push(pattern);
      }
    }
  });

  return suspiciousPatterns;
}

// ============================================================================
// REPORTING
// ============================================================================

export interface QueryReport {
  totalQueries: number;
  totalDuration: number;
  avgQueryTime: number;
  patterns: QueryPattern[];
  suspiciousPatterns: QueryPattern[];
  n1Detected: boolean;
  recommendations: string[];
}

/**
 * Generate detailed report of query execution
 */
export function generateQueryReport(): QueryReport {
  const n1Patterns = analyzeForN1Patterns();

  const sortedPatterns = Array.from(patternMap.values()).sort(
    (a, b) => b.totalDuration - a.totalDuration
  );

  const totalDuration = Array.from(patternMap.values()).reduce(
    (sum, p) => sum + p.totalDuration,
    0
  );

  const recommendations: string[] = [];

  // Generate recommendations for suspicious patterns
  for (const pattern of n1Patterns) {
    if (pattern.model === 'post' && pattern.action === 'findMany') {
      recommendations.push(
        `⚠️ Detected N+1 pattern: Multiple post.findMany() calls. ` +
        `Consider using batch loading or Promise.all() for this operation. ` +
        `See lib/slug-validation.ts for example.`
      );
    } else if (pattern.model === 'post' && pattern.action === 'findFirst') {
      recommendations.push(
        `⚠️ Detected N+1 pattern: Multiple post.findFirst() calls in loop. ` +
        `Use single findMany() with IN clause instead. ` +
        `Example: await prisma.post.findMany({ where: { slug: { in: slugs } } })`
      );
    } else {
      recommendations.push(
        `⚠️ Detected N+1 pattern in ${pattern.model}.${pattern.action}. ` +
        `Review query implementation and consider batch loading.`
      );
    }
  }

  // Identify slow queries
  for (const pattern of sortedPatterns) {
    if (pattern.avgDuration > 50) {
      recommendations.push(
        `🐢 Slow query detected: ${pattern.model}.${pattern.action} ` +
        `(avg: ${pattern.avgDuration.toFixed(2)}ms, count: ${pattern.count}). ` +
        `Consider adding an index or optimizing the query.`
      );
    }
  }

  // Check for missing includes
  const postSelects = sortedPatterns.filter(
    (p) => p.model === 'post' && p.action === 'findUnique'
  );

  if (postSelects.length > 0 && postSelects.length < sortedPatterns.length * 0.1) {
    recommendations.push(
      `💡 Tip: For post.findUnique(), always use proper includes to load related data. ` +
      `See POST_INCLUDE in lib/post-service.ts for the standard pattern.`
    );
  }

  return {
    totalQueries: queryLog.length,
    totalDuration,
    avgQueryTime: totalDuration / queryLog.length,
    patterns: sortedPatterns,
    suspiciousPatterns: n1Patterns,
    n1Detected: n1Patterns.length > 0,
    recommendations,
  };
}

/**
 * Print detailed report to console
 */
export function printQueryReport() {
  const report = generateQueryReport();

  console.log('\n' + '='.repeat(80));
  console.log('DATABASE QUERY REPORT');
  console.log('='.repeat(80) + '\n');

  console.log(`📊 SUMMARY`);
  console.log(`  Total Queries: ${report.totalQueries}`);
  console.log(`  Total Duration: ${report.totalDuration}ms`);
  console.log(`  Average Query Time: ${report.avgQueryTime.toFixed(2)}ms\n`);

  console.log(`🔍 QUERY PATTERNS (sorted by duration)`);
  console.log('-'.repeat(80));
  console.log('Model\t\tAction\t\tCount\tAvg Time\tTotal Time');
  console.log('-'.repeat(80));

  for (const pattern of report.patterns.slice(0, 10)) {
    const n1Marker = pattern.isN1Pattern ? ' ⚠️ N+1' : '';
    console.log(
      `${pattern.model.padEnd(15)} ${pattern.action.padEnd(15)} ` +
      `${pattern.count.toString().padEnd(5)} ` +
      `${pattern.avgDuration.toFixed(2)}ms`.padEnd(10) +
      `${pattern.totalDuration.toFixed(0)}ms${n1Marker}`
    );
  }

  if (report.suspiciousPatterns.length > 0) {
    console.log(`\n⚠️  SUSPICIOUS PATTERNS (Potential N+1 Queries)`);
    console.log('-'.repeat(80));

    for (const pattern of report.suspiciousPatterns) {
      console.log(
        `${pattern.model}.${pattern.action}() - ` +
        `${pattern.count} queries in rapid succession (${pattern.avgDuration.toFixed(2)}ms avg)`
      );
    }
  }

  if (report.recommendations.length > 0) {
    console.log(`\n💡 RECOMMENDATIONS`);
    console.log('-'.repeat(80));

    for (const rec of report.recommendations) {
      console.log(`${rec}\n`);
    }
  }

  console.log('\n' + '='.repeat(80));

  if (report.n1Detected) {
    console.log('❌ N+1 QUERIES DETECTED - Review recommendations above');
  } else {
    console.log('✅ No N+1 patterns detected!');
  }

  console.log('='.repeat(80) + '\n');

  return report;
}

// ============================================================================
// RESET & TESTING
// ============================================================================

/**
 * Reset monitoring data (useful for test isolation)
 */
export function resetQueryLog() {
  queryLog = [];
  patternMap.clear();
}

/**
 * Get all queries recorded since start
 */
export function getQueryLog(): QueryRecord[] {
  return [...queryLog];
}

/**
 * Get pattern summary (useful for assertions in tests)
 */
export function getPatternSummary(): Map<string, QueryPattern> {
  return new Map(patternMap);
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Assert no N+1 patterns detected in given operation
 * 
 * Usage in tests:
 * ```typescript
 * resetQueryLog();
 * await performSomeOperation();
 * assertNoN1Patterns(); // Will throw if N+1 detected
 * ```
 */
export function assertNoN1Patterns() {
  const report = generateQueryReport();

  if (report.n1Detected) {
    const patterns = report.suspiciousPatterns
      .map((p) => `${p.model}.${p.action}() (${p.count} queries)`)
      .join(', ');

    throw new Error(
      `N+1 query patterns detected: ${patterns}. ` +
      `Review the implementation to use batch queries or Promise.all().`
    );
  }
}

/**
 * Assert query count is below threshold
 */
export function assertQueryCountBelow(maxQueries: number) {
  const report = generateQueryReport();

  if (report.totalQueries > maxQueries) {
    throw new Error(
      `Query count exceeded threshold. ` +
      `Expected: <${maxQueries}, Got: ${report.totalQueries}`
    );
  }
}

/**
 * Assert average query time is below threshold
 */
export function assertAvgQueryTimeBelow(maxMs: number) {
  const report = generateQueryReport();

  if (report.avgQueryTime > maxMs) {
    throw new Error(
      `Average query time exceeded threshold. ` +
      `Expected: <${maxMs}ms, Got: ${report.avgQueryTime.toFixed(2)}ms`
    );
  }
}

// ============================================================================
// INTEGRATION
// ============================================================================

/**
 * Initialize query monitoring in development
 * 
 * Usage in prisma client initialization:
 * ```typescript
 * import { initializeQueryMonitoring } from '@/lib/database/queryMonitoring';
 * 
 * // In PrismaClient initialization:
 * initializeQueryMonitoring(prisma);
 * ```
 */
export function initializeQueryMonitoring(prisma: any) {
  if (process.env.NODE_ENV !== 'production') {
    startQueryMonitoring(prisma);

    // Optional: Print report at server shutdown
    if (process.env.PRINT_QUERY_REPORT === 'true') {
      process.on('beforeExit', () => {
        printQueryReport();
      });
    }
  }
}

export default {
  startQueryMonitoring,
  analyzeForN1Patterns,
  generateQueryReport,
  printQueryReport,
  resetQueryLog,
  getQueryLog,
  getPatternSummary,
  assertNoN1Patterns,
  assertQueryCountBelow,
  assertAvgQueryTimeBelow,
  initializeQueryMonitoring,
};
