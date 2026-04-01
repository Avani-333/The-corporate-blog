import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';

interface ExtensionCheckRow {
  enabled: boolean;
}

interface PgVersionRow {
  version_num: number;
}

interface SlowQueryStatRow {
  queryid: string | null;
  query_text: string;
  calls: number;
  total_exec_ms: number;
  mean_exec_ms: number;
  rows_processed: number;
  shared_blks_hit: number;
  shared_blks_read: number;
  temp_blks_written: number;
}

function normalizeQueryText(queryText: string): string {
  return queryText.replace(/\s+/g, ' ').trim();
}

function summarizeQueryText(queryText: string, maxLength = 220): string {
  const normalized = normalizeQueryText(queryText);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function classifyQuery(queryText: string): QueryType {
  const prefix = normalizeQueryText(queryText).slice(0, 12).toUpperCase();
  if (prefix.startsWith('SELECT')) return 'SELECT';
  if (prefix.startsWith('INSERT')) return 'INSERT';
  if (prefix.startsWith('UPDATE')) return 'UPDATE';
  if (prefix.startsWith('DELETE')) return 'DELETE';
  return 'OTHER';
}

async function isPgStatStatementsEnabled(): Promise<boolean> {
  const rows = await prisma.$queryRaw<ExtensionCheckRow[]>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
    ) AS enabled
  `);

  return Boolean(rows[0]?.enabled);
}

async function getPgVersionNum(): Promise<number> {
  const rows = await prisma.$queryRaw<PgVersionRow[]>(Prisma.sql`
    SELECT current_setting('server_version_num')::int AS version_num
  `);
  return Number(rows[0]?.version_num || 0);
}

function buildRecommendations(
  queries: Array<{ queryType: QueryType; calls: number; meanExecMs: number; ioMissRatio: number; tempBlocksWritten: number }>
): string[] {
  const recommendations: string[] = [];

  const heavyReadQuery = queries.find((q) => q.queryType === 'SELECT' && q.ioMissRatio > 0.25);
  if (heavyReadQuery) {
    recommendations.push('High I/O miss ratio detected on SELECT queries. Review missing indexes and filter selectivity.');
  }

  const tempHeavyQuery = queries.find((q) => q.tempBlocksWritten > 1000);
  if (tempHeavyQuery) {
    recommendations.push('Large temp block writes observed. Investigate heavy sorts/hashes and tune work_mem or query shape.');
  }

  const highCallSlowQuery = queries.find((q) => q.calls > 500 && q.meanExecMs > 20);
  if (highCallSlowQuery) {
    recommendations.push('High-frequency slow query found. Prioritize this pattern first for maximum latency reduction.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No critical hotspots detected at current threshold. Keep monitoring and tune top mean-time queries iteratively.');
  }

  return recommendations;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const parsedLimit = Number.parseInt(searchParams.get('limit') || '20', 10);
  const parsedMinMeanMs = Number.parseFloat(searchParams.get('minMeanMs') || '25');

  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 5), 100);
  const minMeanMs = Number.isNaN(parsedMinMeanMs) ? 25 : Math.min(Math.max(parsedMinMeanMs, 1), 5000);

  try {
    const enabled = await isPgStatStatementsEnabled();

    if (!enabled) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          reason: 'pg_stat_statements extension is not enabled. Enable it to collect historical query performance data.',
          source: 'pg_stat_statements',
          settings: { limit, minMeanMs },
          summary: {
            totalTrackedQueries: 0,
            slowQueriesAboveThreshold: 0,
            totalExecMsAcrossSlowQueries: 0,
            avgMeanExecMsAcrossSlowQueries: 0,
          },
          analysis: {
            topByMeanMs: null,
            topByTotalExecMs: null,
            topByCalls: null,
            byType: {},
          },
          recommendations: [],
          queries: [],
        },
      });
    }

    const pgVersionNum = await getPgVersionNum();

    const statsRows = pgVersionNum >= 130000
      ? await prisma.$queryRaw<SlowQueryStatRow[]>(Prisma.sql`
          SELECT
            queryid::text AS queryid,
            query AS query_text,
            calls,
            total_exec_time::float8 AS total_exec_ms,
            mean_exec_time::float8 AS mean_exec_ms,
            rows::float8 AS rows_processed,
            shared_blks_hit::float8 AS shared_blks_hit,
            shared_blks_read::float8 AS shared_blks_read,
            temp_blks_written::float8 AS temp_blks_written
          FROM pg_stat_statements
          WHERE query IS NOT NULL
            AND query <> ''
            AND mean_exec_time >= ${minMeanMs}
            AND query NOT ILIKE '%pg_stat_statements%'
          ORDER BY mean_exec_time DESC
          LIMIT ${limit}
        `)
      : await prisma.$queryRaw<SlowQueryStatRow[]>(Prisma.sql`
          SELECT
            queryid::text AS queryid,
            query AS query_text,
            calls,
            total_time::float8 AS total_exec_ms,
            mean_time::float8 AS mean_exec_ms,
            rows::float8 AS rows_processed,
            shared_blks_hit::float8 AS shared_blks_hit,
            shared_blks_read::float8 AS shared_blks_read,
            temp_blks_written::float8 AS temp_blks_written
          FROM pg_stat_statements
          WHERE query IS NOT NULL
            AND query <> ''
            AND mean_time >= ${minMeanMs}
            AND query NOT ILIKE '%pg_stat_statements%'
          ORDER BY mean_time DESC
          LIMIT ${limit}
        `);

    const queries = statsRows.map((row) => {
      const sharedHit = Number(row.shared_blks_hit);
      const sharedRead = Number(row.shared_blks_read);
      const ioMissRatio = sharedHit + sharedRead > 0 ? sharedRead / (sharedHit + sharedRead) : 0;

      return {
        queryId: row.queryid,
        queryType: classifyQuery(row.query_text),
        querySample: summarizeQueryText(row.query_text),
        calls: Number(row.calls),
        totalExecMs: Number(row.total_exec_ms),
        meanExecMs: Number(row.mean_exec_ms),
        rowsProcessed: Number(row.rows_processed),
        sharedBlocksHit: sharedHit,
        sharedBlocksRead: sharedRead,
        tempBlocksWritten: Number(row.temp_blks_written),
        ioMissRatio,
      };
    });

    const totalExecMsAcrossSlowQueries = queries.reduce((acc, row) => acc + row.totalExecMs, 0);
    const avgMeanExecMsAcrossSlowQueries =
      queries.length > 0 ? queries.reduce((acc, row) => acc + row.meanExecMs, 0) / queries.length : 0;

    const topByMeanMs = queries.length > 0 ? [...queries].sort((a, b) => b.meanExecMs - a.meanExecMs)[0] : null;
    const topByTotalExecMs = queries.length > 0 ? [...queries].sort((a, b) => b.totalExecMs - a.totalExecMs)[0] : null;
    const topByCalls = queries.length > 0 ? [...queries].sort((a, b) => b.calls - a.calls)[0] : null;

    const byType = queries.reduce<Record<string, { count: number; totalExecMs: number; avgMeanExecMs: number }>>((acc, item) => {
      const existing = acc[item.queryType] || { count: 0, totalExecMs: 0, avgMeanExecMs: 0 };
      existing.count += 1;
      existing.totalExecMs += item.totalExecMs;
      acc[item.queryType] = existing;
      return acc;
    }, {});

    for (const key of Object.keys(byType)) {
      const typeItems = queries.filter((query) => query.queryType === key);
      byType[key].avgMeanExecMs =
        typeItems.length > 0
          ? typeItems.reduce((sum, item) => sum + item.meanExecMs, 0) / typeItems.length
          : 0;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          available: true,
          source: 'pg_stat_statements',
          settings: { limit, minMeanMs },
          summary: {
            totalTrackedQueries: queries.length,
            slowQueriesAboveThreshold: queries.length,
            totalExecMsAcrossSlowQueries,
            avgMeanExecMsAcrossSlowQueries,
          },
          analysis: {
            topByMeanMs,
            topByTotalExecMs,
            topByCalls,
            byType,
          },
          recommendations: buildRecommendations(queries),
          queries,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('DB slow query analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze slow queries',
      },
      { status: 500 }
    );
  }
}
