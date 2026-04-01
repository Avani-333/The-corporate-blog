/**
 * POST /api/posts          — Create a new post (defaults to DRAFT)
 * GET  /api/posts          — List posts (paginated, filtered)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAccessToken, verifyAccessToken } from '@/lib/auth/jwt';
import { createPost, listPosts, CreatePostInput, ListPostsOptions } from '@/lib/post-service';
import { UserRole } from '@/types';
import { withRateLimit, CMS_WRITE_RATE_LIMIT, API_RATE_LIMIT } from '@/lib/security/rate-limit';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  content: z.any().optional(),
  contentHtml: z.string().optional(),
  excerpt: z.string().max(300).optional(),
  featuredImage: z.string().url().optional().or(z.literal('')),
  featuredImageAlt: z.string().max(200).optional(),
  seoTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'PENDING_REVIEW']).default('DRAFT'),
  scheduledAt: z.string().datetime().optional(),
  categoryIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
  wordCount: z.number().int().nonnegative().optional(),
  readingTime: z.number().int().nonnegative().optional(),
}).strict();

const listPostsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.string().optional(),
  authorId: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'publishedAt', 'title', 'viewCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

// ============================================================================
// POST — Create Post
// ============================================================================

async function handlePost(request: NextRequest) {
  try {
    // Authenticate
    const token = getAccessToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, errors: ['Authentication required'] },
        { status: 401 }
      );
    }

    const user = await verifyAccessToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, errors: ['Invalid or expired token'] },
        { status: 401 }
      );
    }

    // Parse & validate body
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const input: CreatePostInput = {
      title: parsed.data.title,
      content: parsed.data.content,
      contentHtml: parsed.data.contentHtml,
      excerpt: parsed.data.excerpt,
      featuredImage: parsed.data.featuredImage || undefined,
      featuredImageAlt: parsed.data.featuredImageAlt,
      seoTitle: parsed.data.seoTitle,
      metaDescription: parsed.data.metaDescription,
      status: parsed.data.status,
      scheduledAt: parsed.data.scheduledAt,
      categoryIds: parsed.data.categoryIds,
      tagIds: parsed.data.tagIds,
      wordCount: parsed.data.wordCount,
      readingTime: parsed.data.readingTime,
    };

    const result = await createPost(input, user.id, user.role as UserRole);

    return NextResponse.json(
      { success: result.success, data: result.data, errors: result.errors },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error('POST /api/posts error:', error);
    return NextResponse.json(
      { success: false, errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — List Posts
// ============================================================================

async function handleGet(request: NextRequest) {
  try {
    // Optional authentication (public endpoint, but authenticated users see more)
    let userId: string | undefined;
    let userRole: UserRole | undefined;

    const token = getAccessToken(request);
    if (token) {
      const user = await verifyAccessToken(token);
      if (user) {
        userId = user.id;
        userRole = user.role as UserRole;
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const parsed = listPostsSchema.safeParse(params);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const options: ListPostsOptions = {
      page: parsed.data.page,
      limit: parsed.data.limit,
      status: parsed.data.status,
      authorId: parsed.data.authorId,
      categoryId: parsed.data.categoryId,
      tagId: parsed.data.tagId,
      search: parsed.data.search,
      sortBy: parsed.data.sortBy,
      sortOrder: parsed.data.sortOrder,
    };

    const result = await listPosts(options, userId, userRole);

    return NextResponse.json(
      { success: result.success, data: result.data, errors: result.errors },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error('GET /api/posts error:', error);
    return NextResponse.json(
      { success: false, errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORTS (wrapped with rate limiting)
// ============================================================================

export const POST = withRateLimit(handlePost, CMS_WRITE_RATE_LIMIT);
export const GET = withRateLimit(handleGet, API_RATE_LIMIT);
