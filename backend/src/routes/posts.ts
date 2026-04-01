import { Router } from 'express';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { validateQuery, validateParams, commonSchemas } from '@/middleware/validation';
import { prisma } from '@/config/database';
import { incrementPostViewCount } from '@/services/view-counter';

const router = Router();

function getClientIp(request: Request): string {
  // req.ip is set by Express and respects trusted proxy configuration.
  return request.ip || request.socket.remoteAddress || '0.0.0.0';
}

function getDailyBucket(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function createIpUaHash(ipAddress: string, userAgent: string): string {
  return crypto.createHash('sha256').update(`${ipAddress}|${userAgent}`).digest('hex');
}

function normalizeUserAgent(request: Request): string {
  const ua = String(request.headers['user-agent'] || 'unknown').trim();
  // Keep a bounded value to avoid abuse via very large headers.
  return ua.length > 512 ? ua.slice(0, 512) : ua;
}

interface InternalSuggestionRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date;
  shared_categories: number;
  shared_tags: number;
  category_score: number;
  tag_score: number;
  keyword_score: number;
  ranking_score: number;
}

interface PopularPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date;
  view_count: number;
  unique_daily_views_last_window: number;
}

// GET /api/posts
router.get('/', validateQuery(commonSchemas.pagination), (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Posts list endpoint - coming soon',
    query: req.query,
  });
});

// GET /api/posts/popular
router.get('/popular', async (req: Request, res: Response) => {
  const parsedLimit = Number.parseInt(String(req.query.limit ?? '10'), 10);
  const parsedWindowDays = Number.parseInt(String(req.query.windowDays ?? '7'), 10);

  const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 50);
  const windowDays = Number.isNaN(parsedWindowDays) ? 7 : Math.min(Math.max(parsedWindowDays, 1), 90);

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - windowDays + 1);
  sinceDate.setUTCHours(0, 0, 0, 0);

  const popularPosts = await prisma.$queryRaw<PopularPostRow[]>(Prisma.sql`
    SELECT
      p.id,
      p.slug,
      p.title,
      p.excerpt,
      p."publishedAt",
      p."viewCount"::int AS view_count,
      COUNT(pv.id)::int AS unique_daily_views_last_window
    FROM posts p
    LEFT JOIN post_views pv
      ON pv."postId" = p.id
      AND pv."viewedOn" >= ${sinceDate}
    WHERE p.status = 'PUBLISHED'
      AND p."publishedAt" <= NOW()
    GROUP BY p.id
    ORDER BY unique_daily_views_last_window DESC, p."viewCount" DESC, p."publishedAt" DESC
    LIMIT ${limit};
  `);

  return res.json({
    success: true,
    data: {
      windowDays,
      since: sinceDate.toISOString(),
      total: popularPosts.length,
      posts: popularPosts,
    },
  });
});

// GET /api/posts/:id/internal-suggestions
router.get(
  '/:id/internal-suggestions',
  validateParams(commonSchemas.id),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsedLimit = Number.parseInt(String(req.query.limit ?? '6'), 10);
    const limit = Number.isNaN(parsedLimit) ? 6 : Math.min(Math.max(parsedLimit, 1), 20);

    const targetPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        excerpt: true,
        status: true,
        publishedAt: true,
      },
    });

    if (!targetPost) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    const suggestions = await prisma.$queryRaw<InternalSuggestionRow[]>(Prisma.sql`
      WITH target_post AS (
        SELECT
          p.id,
          p.title,
          COALESCE(p.excerpt, '') AS excerpt
        FROM posts p
        WHERE p.id = ${id}
        LIMIT 1
      ),
      target_categories AS (
        SELECT pc."categoryId"
        FROM post_categories pc
        WHERE pc."postId" = ${id}
      ),
      target_tags AS (
        SELECT pt."tagId"
        FROM post_tags pt
        WHERE pt."postId" = ${id}
      ),
      target_counts AS (
        SELECT
          (SELECT COUNT(*)::float FROM target_categories) AS target_category_count,
          (SELECT COUNT(*)::float FROM target_tags) AS target_tag_count
      ),
      candidate_base AS (
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p."publishedAt",
          ts_rank(
            to_tsvector(
              'english',
              COALESCE(p.title, '') || ' ' || COALESCE(p.excerpt, '') || ' ' || COALESCE(p."metaDescription", '')
            ),
            plainto_tsquery(
              'english',
              COALESCE(
                NULLIF(
                  trim((SELECT concat_ws(' ', tp.title, tp.excerpt) FROM target_post tp)),
                  ''
                ),
                'blog'
              )
            )
          ) AS keyword_score
        FROM posts p
        WHERE p.id <> ${id}
          AND p.status = 'PUBLISHED'
          AND p."publishedAt" <= NOW()
      ),
      category_overlap AS (
        SELECT
          pc."postId" AS id,
          COUNT(*)::float AS shared_categories
        FROM post_categories pc
        INNER JOIN target_categories tc ON tc."categoryId" = pc."categoryId"
        GROUP BY pc."postId"
      ),
      tag_overlap AS (
        SELECT
          pt."postId" AS id,
          COUNT(*)::float AS shared_tags
        FROM post_tags pt
        INNER JOIN target_tags tt ON tt."tagId" = pt."tagId"
        GROUP BY pt."postId"
      )
      SELECT
        cb.id,
        cb.slug,
        cb.title,
        cb.excerpt,
        cb."publishedAt",
        COALESCE(co.shared_categories, 0)::int AS shared_categories,
        COALESCE(to2.shared_tags, 0)::int AS shared_tags,
        CASE
          WHEN tc.target_category_count > 0
          THEN COALESCE(co.shared_categories, 0) / tc.target_category_count
          ELSE 0
        END AS category_score,
        CASE
          WHEN tc.target_tag_count > 0
          THEN COALESCE(to2.shared_tags, 0) / tc.target_tag_count
          ELSE 0
        END AS tag_score,
        COALESCE(cb.keyword_score, 0) AS keyword_score,
        (
          (CASE
            WHEN tc.target_category_count > 0
            THEN COALESCE(co.shared_categories, 0) / tc.target_category_count
            ELSE 0
          END * 0.55)
          +
          (CASE
            WHEN tc.target_tag_count > 0
            THEN COALESCE(to2.shared_tags, 0) / tc.target_tag_count
            ELSE 0
          END * 0.20)
          +
          (LEAST(COALESCE(cb.keyword_score, 0), 1.0) * 0.25)
        ) AS ranking_score
      FROM candidate_base cb
      CROSS JOIN target_counts tc
      LEFT JOIN category_overlap co ON co.id = cb.id
      LEFT JOIN tag_overlap to2 ON to2.id = cb.id
      ORDER BY ranking_score DESC, cb."publishedAt" DESC
      LIMIT ${limit};
    `);

    return res.json({
      success: true,
      data: {
        postId: id,
        limit,
        strategy: {
          sharedCategories: 0.55,
          tagSimilarity: 0.20,
          keywordOverlap: 0.25,
          notes: 'Tag similarity is future-ready and automatically contributes when post tags are present.',
        },
        suggestions,
      },
    });
  }
);

// GET /api/posts/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  const post = await prisma.post.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
      publishedAt: {
        lte: new Date(),
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      featuredImage: true,
      featuredImageAlt: true,
      publishedAt: true,
      updatedAt: true,
      readingTime: true,
      wordCount: true,
      viewCount: true,
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found',
    });
  }

  const ipAddress = getClientIp(req);
  const userAgent = normalizeUserAgent(req);
  const referrer = typeof req.headers.referer === 'string' ? req.headers.referer : undefined;
  const viewedOn = getDailyBucket();
  const ipUaHash = createIpUaHash(ipAddress, userAgent);

  let uniqueDailyViewTracked = false;

  try {
    await prisma.postView.create({
      data: {
        postId: post.id,
        userId: null,
        ipUaHash,
        viewedOn,
        ipAddress,
        userAgent,
        referrer,
      },
    });

    uniqueDailyViewTracked = true;

    await incrementPostViewCount(post.id, 1);
  } catch (error: unknown) {
    // P2002 means the same IP+UA already viewed this post today.
    const errorCode = (error as { code?: string } | null)?.code;
    const isUniqueViolation = errorCode === 'P2002';

    if (!isUniqueViolation) {
      throw error;
    }
  }

  return res.json({
    success: true,
    data: {
      ...post,
      uniqueDailyViewTracked,
    },
  });
});

// POST /api/posts
router.post('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Create post endpoint - coming soon',
  });
});

// PUT /api/posts/:id
router.put('/:id', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Update post endpoint - coming soon',
    id: req.params.id,
  });
});

// DELETE /api/posts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // This endpoint should be called from Next.js API routes with Server Actions
    // which can call revalidatePath for cache invalidation

    res.status(200).json({
      success: true,
      message: 'Use POST /api/posts/:id/delete endpoint instead',
      note: 'Soft delete with ISR cache invalidation should be called from next.js/app/api routes',
      id: req.params.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Delete operation failed',
    });
  }
});

export default router;