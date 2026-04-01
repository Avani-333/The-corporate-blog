/**
 * GET    /api/posts/[id]  — Fetch a single post
 * PUT    /api/posts/[id]  — Update an existing post
 * DELETE /api/posts/[id]  — Soft-delete a post with ISR cache invalidation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAccessToken, verifyAccessToken } from '@/lib/auth/jwt';
import { getPostById, updatePost, UpdatePostInput } from '@/lib/post-service';
import { UserRole } from '@/types';
import { hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { withRateLimit, API_RATE_LIMIT, CMS_WRITE_RATE_LIMIT } from '@/lib/security/rate-limit';
import { logDraftDeleted, logDraftError } from '@/lib/draft-logger';
import { softDeletePost } from '@/lib/database/softDelete';
import { invalidatePostCache, logCacheInvalidation } from '@/lib/cache/isrInvalidation';

// ============================================================================
// VALIDATION
// ============================================================================

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.any().optional(),
  contentHtml: z.string().optional(),
  excerpt: z.string().max(300).optional(),
  featuredImage: z.string().url().optional().or(z.literal('')),
  featuredImageAlt: z.string().max(200).optional(),
  seoTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED', 'PENDING_REVIEW']).optional(),
  scheduledAt: z.string().datetime().optional(),
  categoryIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  wordCount: z.number().int().nonnegative().optional(),
  readingTime: z.number().int().nonnegative().optional(),
});

// ============================================================================
// GET — Fetch single post
// ============================================================================

async function handleGet(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Optional authentication
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

    const result = await getPostById(id, userId, userRole);

    return NextResponse.json(
      { success: result.success, data: result.data, errors: result.errors },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error(`GET /api/posts/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT — Update post
// ============================================================================

async function handlePut(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const input: UpdatePostInput = {
      title: parsed.data.title,
      content: parsed.data.content,
      contentHtml: parsed.data.contentHtml,
      excerpt: parsed.data.excerpt,
      featuredImage: parsed.data.featuredImage,
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

    const result = await updatePost(id, input, user.id, user.role as UserRole);

    return NextResponse.json(
      { success: result.success, data: result.data, errors: result.errors },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error(`PUT /api/posts/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — Soft-delete post with ISR cache invalidation
// ============================================================================

async function handleDelete(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    // Check post exists and not already deleted
    const post = await prisma.post.findUnique({
      where: { id },
      select: { 
        id: true, 
        slug: true,
        authorId: true, 
        deletedAt: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, errors: ['Post not found'] },
        { status: 404 }
      );
    }

    if (post.deletedAt) {
      return NextResponse.json(
        { success: false, errors: ['Post is already deleted'] },
        { status: 410 }
      );
    }

    // Authorization
    const isOwner = post.authorId === user.id;
    const canDeleteAny = hasPermission(user.role as UserRole, 'DELETE_ANY_POSTS');

    if (!isOwner && !canDeleteAny) {
      return NextResponse.json(
        { success: false, errors: ['Insufficient permissions'] },
        { status: 403 }
      );
    }

    // 🆕 Use soft delete utility (creates audit log automatically)
    const deletedPost = await softDeletePost(prisma, id, {
      userId: user.id,
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // 🆕 Invalidate ISR cache for deleted post and related pages
    try {
      await invalidatePostCache({
        postSlug: post.slug,
        postId: id,
        categorySlug: post.categoryId,
      });

      logCacheInvalidation('post_deleted', id, {
        slug: post.slug,
        userId: user.id,
      });
    } catch (cacheError) {
      console.error('[CACHE] ISR invalidation failed:', cacheError);
      // Don't fail the delete operation if cache invalidation fails
    }

    // Log draft deletion (legacy logging)
    logDraftDeleted({
      postId: id,
      userId: user.id,
      source: 'api',
    });

    return NextResponse.json(
      { 
        success: true, 
        data: { 
          id,
          slug: post.slug,
          deletedAt: deletedPost.deletedAt,
          message: 'Post deleted and ISR cache invalidated'
        }, 
        errors: [] 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`DELETE /api/posts/${params.id} error:`, error);
    logDraftError({
      operation: 'DRAFT_DELETED',
      postId: params.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      source: 'api',
    });
    return NextResponse.json(
      { success: false, errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withRateLimit(handleGet, API_RATE_LIMIT);
export const PUT = withRateLimit(handlePut, CMS_WRITE_RATE_LIMIT);
export const DELETE = withRateLimit(handleDelete, CMS_WRITE_RATE_LIMIT);
