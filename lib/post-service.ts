/**
 * Post Service Layer — Public REST API
 *
 * Provides CRUD operations for posts through the public /api/posts endpoints.
 * Distinct from the CMS service (lib/cms-service.ts) which handles the full
 * editor state. This service operates on flat JSON payloads.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateSlugFromTitle, validatePostSlugUniqueness } from '@/lib/slug-validation';
import { UserRole } from '@/types';
import {
  hasPermission,
  canPublishImmediately,
  canTransitionPostStatus,
  needsApprovalToPublish,
  getAvailablePostStatuses,
} from '@/lib/rbac';
import {
  logDraftCreated,
  logDraftUpdated,
  logDraftPublished,
  logDraftDeleted,
  logDraftStatusChanged,
  logDraftScheduled,
  logDraftArchived,
  logDraftError,
} from '@/lib/draft-logger';
import {
  attachFAQStructuredDataToContent,
  validateFAQSchemaConstraints,
} from '@/lib/faq-structured-data';

// ============================================================================
// TYPES
// ============================================================================

export interface CreatePostInput {
  title: string;
  content?: any;           // JSON block content
  contentHtml?: string;    // Pre-rendered HTML
  excerpt?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  seoTitle?: string;
  metaDescription?: string;
  status?: string;         // Defaults to DRAFT
  scheduledAt?: string;    // ISO 8601 datetime
  categoryIds?: string[];
  tagIds?: string[];
  wordCount?: number;
  readingTime?: number;
}

export interface UpdatePostInput {
  title?: string;
  content?: any;
  contentHtml?: string;
  excerpt?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  seoTitle?: string;
  metaDescription?: string;
  status?: string;
  scheduledAt?: string;
  categoryIds?: string[];
  tagIds?: string[];
  wordCount?: number;
  readingTime?: number;
}

export interface PostServiceResult {
  success: boolean;
  data?: any;
  errors: string[];
  statusCode: number;
}

// Standard include for post queries
const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      role: true,
    },
  },
  categories: {
    include: { category: true },
    orderBy: { order: 'asc' as const },
  },
  tags: {
    include: { tag: true },
  },
  _count: {
    select: {
      comments: true,
      likes: true,
      views: true,
    },
  },
} satisfies Prisma.PostInclude;

// ============================================================================
// CREATE POST
// ============================================================================

export async function createPost(
  input: CreatePostInput,
  authorId: string,
  authorRole: UserRole
): Promise<PostServiceResult> {
  const errors: string[] = [];

  // --- Permission check ---
  if (!hasPermission(authorRole, 'CREATE_POSTS')) {
    return { success: false, errors: ['Insufficient permissions to create posts'], statusCode: 403 };
  }

  // --- Title validation ---
  if (!input.title || input.title.trim().length === 0) {
    return { success: false, errors: ['Title is required'], statusCode: 400 };
  }

  if (input.title.length > 200) {
    return { success: false, errors: ['Title must be 200 characters or fewer'], statusCode: 400 };
  }

  // --- Determine initial status ---
  let status = 'DRAFT';
  if (input.status) {
    const allowed = getAvailablePostStatuses(authorRole);
    if (!allowed.includes(input.status)) {
      return {
        success: false,
        errors: [`You cannot create a post with status "${input.status}". Allowed: ${allowed.join(', ')}`],
        statusCode: 403,
      };
    }
    status = input.status;
  }

  // Contributors cannot publish directly
  if (status === 'PUBLISHED' && !canPublishImmediately(authorRole)) {
    return {
      success: false,
      errors: ['You do not have permission to publish directly. Submit for review instead.'],
      statusCode: 403,
    };
  }

  // Scheduled requires a datetime
  if (status === 'SCHEDULED' && !input.scheduledAt) {
    return { success: false, errors: ['scheduledAt is required when status is SCHEDULED'], statusCode: 400 };
  }

  // --- Generate unique slug ---
  let slug: string;
  try {
    slug = await generateSlugFromTitle(input.title);
  } catch (err) {
    return { success: false, errors: ['Failed to generate slug'], statusCode: 500 };
  }

  // --- Build post data ---
  let normalizedContent = input.content;
  if (input.content !== undefined && input.content !== null) {
    const faqValidation = validateFAQSchemaConstraints(input.content);
    if (!faqValidation.isValid) {
      return {
        success: false,
        errors: faqValidation.errors.map((err) => err.message),
        statusCode: 400,
      };
    }

    normalizedContent = attachFAQStructuredDataToContent(input.content);
  }

  const postData: Prisma.PostCreateInput = {
    title: input.title.trim(),
    slug,
    excerpt: input.excerpt?.trim() || null,
    content: normalizedContent ?? Prisma.DbNull,
    contentHtml: input.contentHtml || null,
    featuredImage: input.featuredImage || null,
    featuredImageAlt: input.featuredImageAlt || null,
    seoTitle: input.seoTitle?.trim() || null,
    metaDescription: input.metaDescription?.trim() || null,
    status: status as any,
    publishedAt: status === 'PUBLISHED' ? new Date() : null,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    wordCount: input.wordCount ?? null,
    readingTime: input.readingTime ?? null,
    author: { connect: { id: authorId } },
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create the post
      const post = await tx.post.create({
        data: postData,
        include: POST_INCLUDE,
      });

      // Attach categories
      if (input.categoryIds && input.categoryIds.length > 0) {
        await tx.postCategory.createMany({
          data: input.categoryIds.map((categoryId, idx) => ({
            postId: post.id,
            categoryId,
            order: idx,
          })),
          skipDuplicates: true,
        });
      }

      // Attach tags
      if (input.tagIds && input.tagIds.length > 0) {
        await tx.postTag.createMany({
          data: input.tagIds.map((tagId) => ({
            postId: post.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      // Re-fetch with relations if we added categories/tags
      if ((input.categoryIds?.length ?? 0) > 0 || (input.tagIds?.length ?? 0) > 0) {
        return tx.post.findUnique({
          where: { id: post.id },
          include: POST_INCLUDE,
        });
      }

      return post;
    });

    // Log draft creation
    if (result) {
      if (status === 'PUBLISHED') {
        logDraftPublished({
          postId: result.id,
          userId: authorId,
          slug,
          title: input.title,
          source: 'api',
        });
      } else if (status === 'SCHEDULED') {
        logDraftScheduled({
          postId: result.id,
          userId: authorId,
          slug,
          scheduledFor: input.scheduledAt,
          source: 'api',
        });
      } else {
        logDraftCreated({
          postId: result.id,
          userId: authorId,
          slug,
          title: input.title,
          source: 'api',
        });
      }
    }

    return {
      success: true,
      data: formatPostResponse(result),
      errors: [],
      statusCode: 201,
    };
  } catch (error) {
    console.error('Error creating post:', error);
    logDraftError({
      operation: 'DRAFT_CREATED',
      userId: authorId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      source: 'api',
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { success: false, errors: ['A post with this slug already exists'], statusCode: 409 };
      }
      if (error.code === 'P2025') {
        return { success: false, errors: ['Referenced category or tag not found'], statusCode: 404 };
      }
    }
    return { success: false, errors: ['Internal server error'], statusCode: 500 };
  }
}

// ============================================================================
// UPDATE POST
// ============================================================================

export async function updatePost(
  postId: string,
  input: UpdatePostInput,
  userId: string,
  userRole: UserRole
): Promise<PostServiceResult> {
  // --- Fetch existing post ---
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true, title: true, slug: true, version: true },
  });

  if (!existing) {
    return { success: false, errors: ['Post not found'], statusCode: 404 };
  }

  // --- Authorization: owner or MANAGE_ALL_POSTS ---
  const isOwner = existing.authorId === userId;
  if (!isOwner && !hasPermission(userRole, 'MANAGE_ALL_POSTS')) {
    return { success: false, errors: ['You do not have permission to edit this post'], statusCode: 403 };
  }

  if (isOwner && !hasPermission(userRole, 'EDIT_OWN_POSTS')) {
    return { success: false, errors: ['You do not have permission to edit posts'], statusCode: 403 };
  }

  // --- Status transition check ---
  if (input.status && input.status !== existing.status) {
    if (!canTransitionPostStatus(userRole, existing.status, input.status, isOwner)) {
      return {
        success: false,
        errors: [`Cannot transition from "${existing.status}" to "${input.status}" with your role`],
        statusCode: 403,
      };
    }
  }

  // Scheduled requires datetime
  const targetStatus = input.status || existing.status;
  if (targetStatus === 'SCHEDULED' && !input.scheduledAt) {
    // Only require if transitioning *to* SCHEDULED
    if (input.status === 'SCHEDULED') {
      return { success: false, errors: ['scheduledAt is required when status is SCHEDULED'], statusCode: 400 };
    }
  }

  // --- Title length ---
  if (input.title !== undefined && input.title.length > 200) {
    return { success: false, errors: ['Title must be 200 characters or fewer'], statusCode: 400 };
  }

  // --- Slug regeneration on title change ---
  let newSlug: string | undefined;
  if (input.title && input.title.trim() !== existing.title) {
    try {
      newSlug = await generateSlugFromTitle(input.title, postId);
    } catch {
      return { success: false, errors: ['Failed to generate slug'], statusCode: 500 };
    }
  }

  // --- Build update data ---
  const updateData: Prisma.PostUpdateInput = {
    version: { increment: 1 },
  };

  let normalizedContent = input.content;
  if (input.content !== undefined && input.content !== null) {
    const faqValidation = validateFAQSchemaConstraints(input.content);
    if (!faqValidation.isValid) {
      return {
        success: false,
        errors: faqValidation.errors.map((err) => err.message),
        statusCode: 400,
      };
    }

    normalizedContent = attachFAQStructuredDataToContent(input.content);
  }

  if (input.title !== undefined) updateData.title = input.title.trim();
  if (newSlug) updateData.slug = newSlug;
  if (input.excerpt !== undefined) updateData.excerpt = input.excerpt?.trim() || null;
  if (input.content !== undefined) updateData.content = normalizedContent ?? Prisma.DbNull;
  if (input.contentHtml !== undefined) updateData.contentHtml = input.contentHtml || null;
  if (input.featuredImage !== undefined) updateData.featuredImage = input.featuredImage || null;
  if (input.featuredImageAlt !== undefined) updateData.featuredImageAlt = input.featuredImageAlt || null;
  if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle?.trim() || null;
  if (input.metaDescription !== undefined) updateData.metaDescription = input.metaDescription?.trim() || null;
  if (input.wordCount !== undefined) updateData.wordCount = input.wordCount;
  if (input.readingTime !== undefined) updateData.readingTime = input.readingTime;

  // Handle status
  if (input.status) {
    updateData.status = input.status as any;
    if (input.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }
    if (input.status === 'SCHEDULED') {
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update the post
      const post = await tx.post.update({
        where: { id: postId },
        data: updateData,
        include: POST_INCLUDE,
      });

      // Replace categories if provided
      if (input.categoryIds !== undefined) {
        await tx.postCategory.deleteMany({ where: { postId } });
        if (input.categoryIds.length > 0) {
          await tx.postCategory.createMany({
            data: input.categoryIds.map((categoryId, idx) => ({
              postId,
              categoryId,
              order: idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Replace tags if provided
      if (input.tagIds !== undefined) {
        await tx.postTag.deleteMany({ where: { postId } });
        if (input.tagIds.length > 0) {
          await tx.postTag.createMany({
            data: input.tagIds.map((tagId) => ({
              postId,
              tagId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Re-fetch with updated relations
      if (input.categoryIds !== undefined || input.tagIds !== undefined) {
        return tx.post.findUnique({
          where: { id: postId },
          include: POST_INCLUDE,
        });
      }

      return post;
    });

    // Log draft operation based on status change
    if (result) {
      const newStatus = input.status || existing.status;
      if (input.status && input.status !== existing.status) {
        // Status change logging
        if (input.status === 'PUBLISHED' && existing.status === 'DRAFT') {
          logDraftPublished({
            postId,
            userId,
            slug: newSlug || existing.slug,
            title: input.title || existing.title,
            source: 'api',
          });
        } else if (input.status === 'SCHEDULED') {
          logDraftScheduled({
            postId,
            userId,
            slug: newSlug || existing.slug,
            scheduledFor: input.scheduledAt,
            source: 'api',
          });
        } else if (input.status === 'ARCHIVED') {
          logDraftArchived({
            postId,
            userId,
            previousStatus: existing.status,
            slug: newSlug || existing.slug,
            source: 'api',
          });
        } else {
          logDraftStatusChanged({
            postId,
            userId,
            previousStatus: existing.status,
            newStatus: input.status,
            slug: newSlug || existing.slug,
            source: 'api',
          });
        }
      } else {
        // Content update, no status change
        logDraftUpdated({
          postId,
          userId,
          slug: newSlug || existing.slug,
          title: input.title || existing.title,
          source: 'api',
        });
      }
    }

    return {
      success: true,
      data: formatPostResponse(result),
      errors: [],
      statusCode: 200,
    };
  } catch (error) {
    console.error('Error updating post:', error);
    logDraftError({
      operation: 'DRAFT_UPDATED',
      postId,
      userId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      source: 'api',
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { success: false, errors: ['A post with this slug already exists'], statusCode: 409 };
      }
      if (error.code === 'P2025') {
        return { success: false, errors: ['Referenced category or tag not found'], statusCode: 404 };
      }
    }
    return { success: false, errors: ['Internal server error'], statusCode: 500 };
  }
}

// ============================================================================
// GET SINGLE POST (by ID)
// ============================================================================

export async function getPostById(
  postId: string,
  userId?: string,
  userRole?: UserRole
): Promise<PostServiceResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: POST_INCLUDE,
  });

  if (!post) {
    return { success: false, errors: ['Post not found'], statusCode: 404 };
  }

  // Non-published posts are only visible to the author or users with MANAGE_ALL_POSTS
  if (post.status !== 'PUBLISHED') {
    const isOwner = userId && post.authorId === userId;
    const canManage = userRole && hasPermission(userRole, 'MANAGE_ALL_POSTS');
    if (!isOwner && !canManage) {
      return { success: false, errors: ['Post not found'], statusCode: 404 };
    }
  }

  return {
    success: true,
    data: formatPostResponse(post),
    errors: [],
    statusCode: 200,
  };
}

// ============================================================================
// LIST POSTS (with pagination)
// ============================================================================

export interface ListPostsOptions {
  page?: number;
  limit?: number;
  status?: string;
  authorId?: string;
  categoryId?: string;
  tagId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'publishedAt' | 'title' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

export async function listPosts(
  options: ListPostsOptions,
  userId?: string,
  userRole?: UserRole
): Promise<PostServiceResult> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 10));
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.PostWhereInput = {};

  // Non-admins/editors only see published posts (unless filtering own)
  const canSeeAll = userRole && hasPermission(userRole, 'MANAGE_ALL_POSTS');
  if (options.status && canSeeAll) {
    where.status = options.status as any;
  } else if (options.authorId && options.authorId === userId) {
    // Authors can see their own posts in any status
    if (options.status) where.status = options.status as any;
  } else {
    where.status = 'PUBLISHED';
  }

  if (options.authorId) where.authorId = options.authorId;

  if (options.categoryId) {
    where.categories = { some: { categoryId: options.categoryId } };
  }

  if (options.tagId) {
    where.tags = { some: { tagId: options.tagId } };
  }

  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: 'insensitive' } },
      { excerpt: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  // Build orderBy
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';
  const orderBy: Prisma.PostOrderByWithRelationInput = { [sortBy]: sortOrder };

  try {
    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        posts: posts.map(formatPostResponse),
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      errors: [],
      statusCode: 200,
    };
  } catch (error) {
    console.error('Error listing posts:', error);
    return { success: false, errors: ['Internal server error'], statusCode: 500 };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formats a raw Prisma post into a clean API response object
 */
function formatPostResponse(post: any): any {
  if (!post) return null;

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    contentHtml: post.contentHtml,
    featuredImage: post.featuredImage,
    featuredImageAlt: post.featuredImageAlt,
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    status: post.status,
    publishedAt: post.publishedAt,
    scheduledAt: post.scheduledAt,
    wordCount: post.wordCount,
    readingTime: post.readingTime,
    viewCount: post.viewCount,
    version: post.version,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author
      ? {
          id: post.author.id,
          name: post.author.name,
          username: post.author.username,
          avatar: post.author.avatar,
        }
      : null,
    categories: post.categories?.map((pc: any) => ({
      id: pc.category.id,
      name: pc.category.name,
      slug: pc.category.slug,
      color: pc.category.color,
    })) ?? [],
    tags: post.tags?.map((pt: any) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      slug: pt.tag.slug,
    })) ?? [],
    _count: post._count ?? {},
  };
}
