import { Router } from 'express';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { config } from '@/config/environment';

const router = Router();

interface RecirculationRow {
  total_views: number;
  internal_recirculated_views: number;
}

interface BounceTrendRow {
  viewed_on: Date;
  total_views: number;
  estimated_bounces: number;
  estimated_bounce_rate: number;
}

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

function getFrontendHost(): string {
  try {
    return new URL(config.frontendUrl).hostname;
  } catch {
    return 'localhost';
  }
}

function getUtcDay(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, val) => acc + val, 0) / values.length;
}

function normalizeQueryText(queryText: string): string {
  return queryText.replace(/\s+/g, ' ').trim();
}

function summarizeQueryText(queryText: string, maxLength = 180): string {
  const normalized = normalizeQueryText(queryText);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function classifyQuery(queryText: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
  const prefix = normalizeQueryText(queryText).slice(0, 10).toUpperCase();
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

// GET /api/analytics/stats
// Validates whether popular-post traffic improves internal recirculation.
router.get('/stats', async (req: Request, res: Response) => {
  const frontendHost = getFrontendHost();
  const parsedPopularLimit = Number.parseInt(String(req.query.popularLimit ?? '10'), 10);
  const popularLimit = Number.isNaN(parsedPopularLimit)
    ? 10
    : Math.min(Math.max(parsedPopularLimit, 1), 50);

  const currentSince = getUtcDay(6); // 7-day window
  const previousSince = getUtcDay(13);
  const previousUntil = getUtcDay(7);

  const popularPosts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() },
    },
    select: { id: true },
    orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
    take: popularLimit,
  });

  const popularPostIds = popularPosts.map((post) => post.id);

  if (popularPostIds.length === 0) {
    return res.json({
      success: true,
      data: {
        popularPostCount: 0,
        recirculation: {
          currentRate: 0,
          previousRate: 0,
          uplift: 0,
          enhanced: false,
        },
      },
    });
  }

  const currentWindow = await prisma.$queryRaw<RecirculationRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::int AS total_views,
      COUNT(*) FILTER (
        WHERE pv.referrer IS NOT NULL
          AND pv.referrer <> ''
          AND (pv.referrer ILIKE ${`%${frontendHost}%`} OR pv.referrer LIKE '/%')
      )::int AS internal_recirculated_views
    FROM post_views pv
    WHERE pv."postId" IN (${Prisma.join(popularPostIds)})
      AND pv."viewedOn" >= ${currentSince}
  `);

  const previousWindow = await prisma.$queryRaw<RecirculationRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::int AS total_views,
      COUNT(*) FILTER (
        WHERE pv.referrer IS NOT NULL
          AND pv.referrer <> ''
          AND (pv.referrer ILIKE ${`%${frontendHost}%`} OR pv.referrer LIKE '/%')
      )::int AS internal_recirculated_views
    FROM post_views pv
    WHERE pv."postId" IN (${Prisma.join(popularPostIds)})
      AND pv."viewedOn" >= ${previousSince}
      AND pv."viewedOn" < ${previousUntil}
  `);

  const currentTotals = currentWindow[0] || { total_views: 0, internal_recirculated_views: 0 };
  const previousTotals = previousWindow[0] || { total_views: 0, internal_recirculated_views: 0 };

  const currentRate =
    currentTotals.total_views > 0
      ? currentTotals.internal_recirculated_views / currentTotals.total_views
      : 0;
  const previousRate =
    previousTotals.total_views > 0
      ? previousTotals.internal_recirculated_views / previousTotals.total_views
      : 0;

  const uplift = currentRate - previousRate;

  return res.json({
    success: true,
    data: {
      popularPostCount: popularPostIds.length,
      recirculation: {
        currentRate,
        previousRate,
        uplift,
        enhanced: uplift >= 0,
      },
      windows: {
        currentSince: currentSince.toISOString(),
        previousSince: previousSince.toISOString(),
        previousUntil: previousUntil.toISOString(),
      },
    },
  });
});

// GET /api/analytics/bounce-trend
// Returns estimated bounce-rate trend over time using referrer-based proxy.
router.get('/bounce-trend', async (req: Request, res: Response) => {
  const frontendHost = getFrontendHost();
  const parsedDays = Number.parseInt(String(req.query.days ?? '14'), 10);
  const days = Number.isNaN(parsedDays) ? 14 : Math.min(Math.max(parsedDays, 7), 90);

  const since = getUtcDay(days - 1);

  const rows = await prisma.$queryRaw<BounceTrendRow[]>(Prisma.sql`
    SELECT
      pv."viewedOn" AS viewed_on,
      COUNT(*)::int AS total_views,
      COUNT(*) FILTER (
        WHERE pv.referrer IS NULL
          OR pv.referrer = ''
          OR NOT (pv.referrer ILIKE ${`%${frontendHost}%`} OR pv.referrer LIKE '/%')
      )::int AS estimated_bounces,
      (
        COUNT(*) FILTER (
          WHERE pv.referrer IS NULL
            OR pv.referrer = ''
            OR NOT (pv.referrer ILIKE ${`%${frontendHost}%`} OR pv.referrer LIKE '/%')
        )::float / NULLIF(COUNT(*), 0)
      ) AS estimated_bounce_rate
    FROM post_views pv
    WHERE pv."viewedOn" >= ${since}
    GROUP BY pv."viewedOn"
    ORDER BY pv."viewedOn" ASC
  `);

  const series = rows.map((row) => ({
    date: row.viewed_on,
    totalViews: Number(row.total_views),
    estimatedBounces: Number(row.estimated_bounces),
    estimatedBounceRate: Number(row.estimated_bounce_rate || 0),
  }));

  const half = Math.floor(series.length / 2);
  const firstHalfAvg = avg(series.slice(0, half).map((item) => item.estimatedBounceRate));
  const secondHalfAvg = avg(series.slice(half).map((item) => item.estimatedBounceRate));

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (secondHalfAvg - firstHalfAvg > 0.01) trend = 'up';
  if (firstHalfAvg - secondHalfAvg > 0.01) trend = 'down';

  return res.json({
    success: true,
    data: {
      days,
      since: since.toISOString(),
      trend,
      firstHalfAverageBounceRate: firstHalfAvg,
      secondHalfAverageBounceRate: secondHalfAvg,
      series,
      notes:
        'Estimated bounce rate uses a referrer-based proxy (missing/external referrer treated as likely bounce).',
    },
  });
});

// GET /api/analytics/db/slow-queries
// Uses pg_stat_statements to surface slow query patterns for tuning.
router.get('/db/slow-queries', async (req: Request, res: Response) => {
  const parsedLimit = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const parsedMinMeanMs = Number.parseFloat(String(req.query.minMeanMs ?? '25'));

  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 5), 100);
  const minMeanMs = Number.isNaN(parsedMinMeanMs) ? 25 : Math.min(Math.max(parsedMinMeanMs, 1), 5000);

  const enabled = await isPgStatStatementsEnabled();
  if (!enabled) {
    return res.json({
      success: true,
      data: {
        available: false,
        reason:
          'pg_stat_statements extension is not enabled. Enable it to collect historical query performance data.',
        settings: {
          limit,
          minMeanMs,
        },
        summary: {
          totalTrackedQueries: 0,
          slowQueriesAboveThreshold: 0,
          totalExecMsAcrossSlowQueries: 0,
          avgMeanExecMsAcrossSlowQueries: 0,
        },
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
        ORDER BY mean_time DESC
        LIMIT ${limit}
      `);

  const queries = statsRows.map((row) => {
    const ioMissRatio = row.shared_blks_hit + row.shared_blks_read > 0
      ? row.shared_blks_read / (row.shared_blks_hit + row.shared_blks_read)
      : 0;

    return {
      queryId: row.queryid,
      queryType: classifyQuery(row.query_text),
      querySample: summarizeQueryText(row.query_text),
      calls: Number(row.calls),
      totalExecMs: Number(row.total_exec_ms),
      meanExecMs: Number(row.mean_exec_ms),
      rowsProcessed: Number(row.rows_processed),
      sharedBlocksHit: Number(row.shared_blks_hit),
      sharedBlocksRead: Number(row.shared_blks_read),
      tempBlocksWritten: Number(row.temp_blks_written),
      ioMissRatio,
    };
  });

  const totalExecMsAcrossSlowQueries = queries.reduce((acc, row) => acc + row.totalExecMs, 0);
  const avgMeanExecMsAcrossSlowQueries = queries.length > 0
    ? queries.reduce((acc, row) => acc + row.meanExecMs, 0) / queries.length
    : 0;

  return res.json({
    success: true,
    data: {
      available: true,
      source: 'pg_stat_statements',
      settings: {
        limit,
        minMeanMs,
      },
      summary: {
        totalTrackedQueries: queries.length,
        slowQueriesAboveThreshold: queries.length,
        totalExecMsAcrossSlowQueries,
        avgMeanExecMsAcrossSlowQueries,
      },
      recommendations: [
        'Prioritize queries with high meanExecMs and high calls to maximize impact.',
        'Inspect high ioMissRatio queries for missing indexes or poor selectivity.',
        'Review tempBlocksWritten spikes for large sorts/hashes and memory tuning opportunities.',
      ],
      queries,
    },
  });
});

export default router;