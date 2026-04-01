import { Router } from 'express';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { validateQuery, commonSchemas } from '@/middleware/validation';
import { prisma } from '@/config/database';

const router = Router();

interface SearchRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  relevance: number;
}

type SearchSort = 'relevance' | 'date';

const SEARCH_VECTOR_SQL = Prisma.sql`
  (
    setweight(to_tsvector('english', COALESCE(p.title, '')), 'A') ||
    setweight(to_tsvector('english', tcb_extract_headings_text(COALESCE(p."contentHtml", ''))), 'B') ||
    setweight(to_tsvector('english', tcb_extract_body_text(COALESCE(p."contentHtml", ''))), 'C')
  )
`;

router.get('/', validateQuery(commonSchemas.search), async (req: Request, res: Response) => {
  const query = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();
  const author = String(req.query.author || '').trim();
  const rawSort = String(req.query.sort || 'relevance').toLowerCase();
  const sort: SearchSort = rawSort === 'date' ? 'date' : 'relevance';

  const parsedPage = Number.parseInt(String(req.query.page || '1'), 10);
  const parsedLimit = Number.parseInt(String(req.query.limit || '10'), 10);
  const page = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
  const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 50);
  const offset = (page - 1) * limit;

  const orderBySql =
    sort === 'date'
      ? Prisma.sql`p."publishedAt" DESC, p."createdAt" DESC`
      : Prisma.sql`relevance DESC, p."publishedAt" DESC, p."createdAt" DESC`;

  const likeCategory = category ? `%${category}%` : '';
  const likeAuthor = author ? `%${author}%` : '';

  const rows = query
    ? await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
        WITH search_query AS (
          SELECT websearch_to_tsquery('english', ${query}) AS q
        )
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p."publishedAt",
          ts_rank_cd(${SEARCH_VECTOR_SQL}, sq.q, 32)::float8 AS relevance
        FROM posts p
        CROSS JOIN search_query sq
        WHERE p.status = 'PUBLISHED'
          AND p."publishedAt" IS NOT NULL
          AND p."publishedAt" <= NOW()
          AND ${SEARCH_VECTOR_SQL} @@ sq.q
          ${category ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM post_categories pc
          INNER JOIN categories c ON c.id = pc."categoryId"
          WHERE pc."postId" = p.id
            AND (c.slug ILIKE ${likeCategory} OR c.name ILIKE ${likeCategory})
        )
      ` : Prisma.empty}
          ${author ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = p."authorId"
            AND (
              COALESCE(u.username, '') ILIKE ${likeAuthor}
              OR COALESCE(u.name, '') ILIKE ${likeAuthor}
            )
        )
      ` : Prisma.empty}
        ORDER BY ${orderBySql}
        LIMIT ${limit}
        OFFSET ${offset};
      `)
    : await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p."publishedAt",
          0::float8 AS relevance
        FROM posts p
        WHERE p.status = 'PUBLISHED'
          AND p."publishedAt" IS NOT NULL
          AND p."publishedAt" <= NOW()
          ${category ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM post_categories pc
          INNER JOIN categories c ON c.id = pc."categoryId"
          WHERE pc."postId" = p.id
            AND (c.slug ILIKE ${likeCategory} OR c.name ILIKE ${likeCategory})
        )
      ` : Prisma.empty}
          ${author ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = p."authorId"
            AND (
              COALESCE(u.username, '') ILIKE ${likeAuthor}
              OR COALESCE(u.name, '') ILIKE ${likeAuthor}
            )
        )
      ` : Prisma.empty}
        ORDER BY p."publishedAt" DESC, p."createdAt" DESC
        LIMIT ${limit}
        OFFSET ${offset};
      `);

  const totalResult = query
    ? await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        WITH search_query AS (
          SELECT websearch_to_tsquery('english', ${query}) AS q
        )
        SELECT COUNT(*)::bigint AS total
        FROM posts p
        CROSS JOIN search_query sq
        WHERE p.status = 'PUBLISHED'
          AND p."publishedAt" IS NOT NULL
          AND p."publishedAt" <= NOW()
          AND ${SEARCH_VECTOR_SQL} @@ sq.q
          ${category ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM post_categories pc
          INNER JOIN categories c ON c.id = pc."categoryId"
          WHERE pc."postId" = p.id
            AND (c.slug ILIKE ${likeCategory} OR c.name ILIKE ${likeCategory})
        )
      ` : Prisma.empty}
          ${author ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = p."authorId"
            AND (
              COALESCE(u.username, '') ILIKE ${likeAuthor}
              OR COALESCE(u.name, '') ILIKE ${likeAuthor}
            )
        )
      ` : Prisma.empty}
      `)
    : await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM posts p
        WHERE p.status = 'PUBLISHED'
          AND p."publishedAt" IS NOT NULL
          AND p."publishedAt" <= NOW()
          ${category ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM post_categories pc
          INNER JOIN categories c ON c.id = pc."categoryId"
          WHERE pc."postId" = p.id
            AND (c.slug ILIKE ${likeCategory} OR c.name ILIKE ${likeCategory})
        )
      ` : Prisma.empty}
          ${author ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = p."authorId"
            AND (
              COALESCE(u.username, '') ILIKE ${likeAuthor}
              OR COALESCE(u.name, '') ILIKE ${likeAuthor}
            )
        )
      ` : Prisma.empty}
      `);

  const total = Number(totalResult[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: {
      query,
      sort,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      results: rows,
    },
  });
});

export default router;