/**
 * Soft Delete Utilities
 * Helper functions for soft delete operations on User and Post models
 */

import { PrismaClient, Prisma } from '@prisma/client';

export interface SoftDeleteOptions {
  userId?: string; // User performing the deletion
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Soft delete a post
 */
export async function softDeletePost(
  prisma: PrismaClient,
  postId: string,
  options: SoftDeleteOptions = {}
): Promise<any> {
  const now = new Date();

  // Get post details before deletion (needed for cache invalidation)
  const preDeletePost = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      title: true,
      authorId: true,
      categoryId: true,
    },
  });

  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      deletedAt: now,
      deletedBy: options.userId,
      status: 'DELETED',
    },
  });

  // Log the deletion
  await logAudit(prisma, {
    action: 'DELETE',
    entity: 'POST',
    entityId: postId,
    userId: options.userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    oldData: post,
    changedFields: ['deletedAt', 'deletedBy', 'status'],
  });

  // 🆕 Invalidate ISR cache for this post
  // Import here to avoid circular dependency
  try {
    const { invalidatePostCache, logCacheInvalidation } = await import(
      '@/lib/cache/isrInvalidation'
    );

    await invalidatePostCache({
      postSlug: preDeletePost?.slug || '',
      postId,
    });

    logCacheInvalidation('post_deleted', postId, {
      slug: preDeletePost?.slug,
    });
  } catch (error) {
    console.error('[CACHE] ISR invalidation failed for soft delete:', error);
    // Don't throw - soft delete succeeded, cache invalidation is secondary
  }

  return post;
}

/**
 * Soft delete a user
 */
export async function softDeleteUser(
  prisma: PrismaClient,
  userId: string,
  options: SoftDeleteOptions = {}
): Promise<any> {
  const now = new Date();

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: now,
      deletedBy: options.userId,
      status: 'INACTIVE',
    },
  });

  // Log the deletion
  await logAudit(prisma, {
    action: 'DELETE',
    entity: 'USER',
    entityId: userId,
    userId: options.userId,
    targetUserId: userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    oldData: {
      status: 'ACTIVE',
      email: user.email,
      username: user.username,
    },
    changedFields: ['deletedAt', 'deletedBy', 'status'],
  });

  return user;
}

/**
 * Restore a soft-deleted post
 */
export async function restorePost(
  prisma: PrismaClient,
  postId: string,
  options: SoftDeleteOptions = {}
): Promise<any> {
  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      deletedAt: null,
      deletedBy: null,
      status: 'DRAFT', // Restore to draft by default
    },
  });

  // Log the restore
  await logAudit(prisma, {
    action: 'RESTORE',
    entity: 'POST',
    entityId: postId,
    userId: options.userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    changedFields: ['deletedAt', 'deletedBy', 'status'],
  });

  return post;
}

/**
 * Restore a soft-deleted user
 */
export async function restoreUser(
  prisma: PrismaClient,
  userId: string,
  options: SoftDeleteOptions = {}
): Promise<any> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: null,
      deletedBy: null,
      status: 'ACTIVE',
    },
  });

  // Log the restore
  await logAudit(prisma, {
    action: 'RESTORE',
    entity: 'USER',
    entityId: userId,
    userId: options.userId,
    targetUserId: userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    changedFields: ['deletedAt', 'deletedBy', 'status'],
  });

  return user;
}

/**
 * Permanently delete a soft-deleted post (hard delete)
 */
export async function permanentlyDeletePost(
  prisma: PrismaClient,
  postId: string,
  options: SoftDeleteOptions = {}
): Promise<void> {
  // Verify it's soft-deleted first
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post || !post.deletedAt) {
    throw new Error('Post not found or not soft-deleted');
  }

  // Log before deletion
  await logAudit(prisma, {
    action: 'DELETE', // Hard DELETE
    entity: 'POST',
    entityId: postId,
    userId: options.userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    oldData: post,
    changedFields: ['*'], // All fields deleted
  });

  // Perform hard delete
  await prisma.post.delete({
    where: { id: postId },
  });
}

/**
 * Get active posts only (excluding soft-deleted)
 */
export async function getActivePosts(
  prisma: PrismaClient,
  filter: Prisma.PostWhereInput = {}
): Promise<any[]> {
  return prisma.post.findMany({
    where: {
      ...filter,
      deletedAt: null,
    },
  });
}

/**
 * Get active users only (excluding soft-deleted)
 */
export async function getActiveUsers(
  prisma: PrismaClient,
  filter: Prisma.UserWhereInput = {}
): Promise<any[]> {
  return prisma.user.findMany({
    where: {
      ...filter,
      deletedAt: null,
    },
  });
}

/**
 * Get soft-deleted posts within a date range
 */
export async function getDeletedPosts(
  prisma: PrismaClient,
  options: {
    from?: Date;
    to?: Date;
    authorId?: string;
  } = {}
): Promise<any[]> {
  return prisma.post.findMany({
    where: {
      deletedAt: {
        not: null,
        ...(options.from && { gte: options.from }),
        ...(options.to && { lte: options.to }),
      },
      ...(options.authorId && { authorId: options.authorId }),
    },
    orderBy: {
      deletedAt: 'desc',
    },
  });
}

/**
 * Get soft-deleted users within a date range
 */
export async function getDeletedUsers(
  prisma: PrismaClient,
  options: {
    from?: Date;
    to?: Date;
  } = {}
): Promise<any[]> {
  return prisma.user.findMany({
    where: {
      deletedAt: {
        not: null,
        ...(options.from && { gte: options.from }),
        ...(options.to && { lte: options.to }),
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      deletedAt: true,
      deletedBy: true,
      createdAt: true,
    },
    orderBy: {
      deletedAt: 'desc',
    },
  });
}

/**
 * Count soft-deleted posts
 */
export async function countDeletedPosts(prisma: PrismaClient): Promise<number> {
  return prisma.post.count({
    where: {
      deletedAt: { not: null },
    },
  });
}

/**
 * Count soft-deleted users
 */
export async function countDeletedUsers(prisma: PrismaClient): Promise<number> {
  return prisma.user.count({
    where: {
      deletedAt: { not: null },
    },
  });
}

export interface AuditLogInput {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'RESTORE' | 'UNDELETE';
  entity: 'USER' | 'POST' | 'COMMENT' | 'CATEGORY' | 'TAG' | 'IMAGE';
  entityId: string;
  userId?: string;
  targetUserId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changedFields?: string[];
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  status?: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorMessage?: string;
}

/**
 * Create audit log entry
 */
export async function logAudit(
  prisma: PrismaClient,
  data: AuditLogInput
): Promise<any> {
  const changedFields = data.changedFields || Object.keys(data.newData || {});

  return prisma.auditLog.create({
    data: {
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      userId: data.userId,
      targetUserId: data.targetUserId,
      oldData: data.oldData,
      newData: data.newData,
      changedFields,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      requestId: data.requestId,
      status: data.status || 'SUCCESS',
      errorMessage: data.errorMessage,
    },
  });
}

/**
 * Get audit trail for an entity
 */
export async function getAuditTrail(
  prisma: PrismaClient,
  entity: string,
  entityId: string,
  limit: number = 100
): Promise<any[]> {
  return prisma.auditLog.findMany({
    where: {
      entity,
      entityId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get all changes made by a user
 */
export async function getUserChangeHistory(
  prisma: PrismaClient,
  userId: string,
  limit: number = 100
): Promise<any[]> {
  return prisma.auditLog.findMany({
    where: {
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get publishing history of a post
 */
export async function getPostPublishingHistory(
  prisma: PrismaClient,
  postId: string
): Promise<any[]> {
  return prisma.auditLog.findMany({
    where: {
      entityId: postId,
      entity: 'POST',
      action: { in: ['PUBLISH', 'UPDATE', 'SCHEDULE'] },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get who published a post and when
 */
export async function getPostPublisher(
  prisma: PrismaClient,
  postId: string
): Promise<{
  publishedBy: string | null;
  publishedByUser?: any;
  publishedAt: Date | null;
} | null> {
  const publishLog = await prisma.auditLog.findFirst({
    where: {
      entityId: postId,
      entity: 'POST',
      action: 'PUBLISH',
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!publishLog) return null;

  return {
    publishedBy: publishLog.userId,
    publishedByUser: publishLog.user,
    publishedAt: publishLog.createdAt,
  };
}

/**
 * Get all editors of a post
 */
export async function getPostEditors(
  prisma: PrismaClient,
  postId: string
): Promise<
  Array<{
    userId: string;
    username?: string;
    editCount: number;
    lastEdit: Date;
  }>
> {
  const edits = await prisma.auditLog.findMany({
    where: {
      entityId: postId,
      entity: 'POST',
      action: 'UPDATE',
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const editorMap = new Map<
    string,
    {
      userId: string;
      username?: string;
      editCount: number;
      lastEdit: Date;
    }
  >();

  edits.forEach((edit) => {
    const userId = edit.userId || 'unknown';
    const existing = editorMap.get(userId) || {
      userId,
      username: edit.user?.username,
      editCount: 0,
      lastEdit: edit.createdAt,
    };

    existing.editCount++;
    if (edit.createdAt > existing.lastEdit) {
      existing.lastEdit = edit.createdAt;
    }

    editorMap.set(userId, existing);
  });

  return Array.from(editorMap.values()).sort(
    (a, b) => b.lastEdit.getTime() - a.lastEdit.getTime()
  );
}
