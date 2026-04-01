/**
 * Audit Logger Service
 * Handles creation and management of audit log entries
 * Tracks all user actions on posts, users, and other entities
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'PUBLISH'
  | 'UNPUBLISH'
  | 'SCHEDULE'
  | 'RESTORE'
  | 'UNDELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND'
  | 'ACTIVATE'
  | 'LOCK'
  | 'UNLOCK';

export type AuditEntity =
  | 'USER'
  | 'POST'
  | 'COMMENT'
  | 'CATEGORY'
  | 'TAG'
  | 'IMAGE'
  | 'SETTING'
  | 'NOTIFICATION';

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
}

export interface AuditData {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  targetUserId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changedFields?: string[];
  publishDetails?: {
    title?: string;
    slug?: string;
    publishedAt?: Date;
    scheduledFor?: Date;
    category?: string;
    tags?: string[];
  };
  editDetails?: {
    previousTitle?: string;
    currentTitle?: string;
    editedSections?: string[];
    wordCountChange?: number;
  };
  context?: AuditContext;
  status?: AuditStatus;
  errorMessage?: string;
}

class AuditLogger {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Log an action to the audit trail
   */
  async log(data: AuditData): Promise<any> {
    try {
      const requestId = data.context?.requestId || uuidv4();
      const changedFields = data.changedFields || Object.keys(data.newData || {});

      const auditEntry = await this.prisma.auditLog.create({
        data: {
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          userId: data.context?.userId,
          targetUserId: data.targetUserId,
          oldData: data.oldData,
          newData: data.newData,
          changedFields,
          publishDetails: data.publishDetails,
          editDetails: data.editDetails,
          ipAddress: data.context?.ipAddress,
          userAgent: data.context?.userAgent,
          requestId,
          status: data.status || 'SUCCESS',
          errorMessage: data.errorMessage,
        },
      });

      return auditEntry;
    } catch (error) {
      console.error('Audit logging failed:', error);
      throw error;
    }
  }

  /**
   * Log a post creation
   */
  async logPostCreate(
    postId: string,
    postData: {
      title: string;
      slug: string;
      authorId: string;
      category?: string;
      tags?: string[];
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'CREATE',
      entity: 'POST',
      entityId: postId,
      newData: postData,
      changedFields: ['title', 'slug', 'authorId', 'category', 'tags'],
      context,
    });
  }

  /**
   * Log a post update
   */
  async logPostUpdate(
    postId: string,
    changes: {
      oldData: Record<string, any>;
      newData: Record<string, any>;
      changedFields: string[];
    },
    context: AuditContext
  ): Promise<any> {
    const editDetails =
      'title' in changes.oldData && 'title' in changes.newData
        ? {
            previousTitle: changes.oldData.title,
            currentTitle: changes.newData.title,
            editedSections: changes.changedFields.filter((f) =>
              ['content', 'excerpt', 'title'].includes(f)
            ),
            wordCountChange:
              (changes.newData.wordCount || 0) - (changes.oldData.wordCount || 0),
          }
        : undefined;

    return this.log({
      action: 'UPDATE',
      entity: 'POST',
      entityId: postId,
      oldData: changes.oldData,
      newData: changes.newData,
      changedFields: changes.changedFields,
      editDetails,
      context,
    });
  }

  /**
   * Log a post publication
   */
  async logPostPublish(
    postId: string,
    publishData: {
      title: string;
      slug: string;
      category?: string;
      tags?: string[];
      scheduledFor?: Date;
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'PUBLISH',
      entity: 'POST',
      entityId: postId,
      publishDetails: {
        title: publishData.title,
        slug: publishData.slug,
        publishedAt: new Date(),
        category: publishData.category,
        tags: publishData.tags,
        scheduledFor: publishData.scheduledFor,
      },
      changedFields: ['status', 'publishedAt', 'publishedBy'],
      context,
    });
  }

  /**
   * Log a scheduled post publication
   */
  async logPostSchedule(
    postId: string,
    scheduleData: {
      title: string;
      scheduledFor: Date;
      category?: string;
      tags?: string[];
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'SCHEDULE',
      entity: 'POST',
      entityId: postId,
      publishDetails: {
        title: scheduleData.title,
        scheduledFor: scheduleData.scheduledFor,
        category: scheduleData.category,
        tags: scheduleData.tags,
      },
      changedFields: ['status', 'scheduledAt'],
      context,
    });
  }

  /**
   * Log a post unpublication
   */
  async logPostUnpublish(
    postId: string,
    postTitle: string,
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'UNPUBLISH',
      entity: 'POST',
      entityId: postId,
      newData: {
        status: 'DRAFT',
      },
      changedFields: ['status', 'publishedAt'],
      context,
    });
  }

  /**
   * Log a post deletion (soft delete)
   */
  async logPostDelete(
    postId: string,
    postData: {
      title: string;
      authorId: string;
      status: string;
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'DELETE',
      entity: 'POST',
      entityId: postId,
      oldData: postData,
      changedFields: ['deletedAt', 'deletedBy', 'status'],
      context,
    });
  }

  /**
   * Log a post restoration
   */
  async logPostRestore(
    postId: string,
    postTitle: string,
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'RESTORE',
      entity: 'POST',
      entityId: postId,
      newData: {
        status: 'DRAFT',
        deletedAt: null,
      },
      changedFields: ['deletedAt', 'deletedBy', 'status'],
      context,
    });
  }

  /**
   * Log a user creation
   */
  async logUserCreate(
    userId: string,
    userData: {
      email: string;
      username: string;
      name?: string;
      role: string;
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'CREATE',
      entity: 'USER',
      entityId: userId,
      targetUserId: userId,
      newData: userData,
      changedFields: ['email', 'username', 'name', 'role'],
      context,
    });
  }

  /**
   * Log a user update
   */
  async logUserUpdate(
    userId: string,
    changes: {
      oldData: Record<string, any>;
      newData: Record<string, any>;
      changedFields: string[];
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'UPDATE',
      entity: 'USER',
      entityId: userId,
      targetUserId: userId,
      oldData: changes.oldData,
      newData: changes.newData,
      changedFields: changes.changedFields,
      context,
    });
  }

  /**
   * Log a user deletion (soft delete)
   */
  async logUserDelete(
    userId: string,
    userData: {
      email: string;
      username: string;
      role: string;
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'DELETE',
      entity: 'USER',
      entityId: userId,
      targetUserId: userId,
      oldData: userData,
      changedFields: ['deletedAt', 'deletedBy', 'status'],
      context,
    });
  }

  /**
   * Log a user suspension
   */
  async logUserSuspend(
    userId: string,
    reason?: string,
    context?: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'SUSPEND',
      entity: 'USER',
      entityId: userId,
      targetUserId: userId,
      newData: {
        status: 'SUSPENDED',
        suspensionReason: reason,
      },
      changedFields: ['status'],
      context: context || {},
    });
  }

  /**
   * Log a user reactivation
   */
  async logUserActivate(
    userId: string,
    context?: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'ACTIVATE',
      entity: 'USER',
      entityId: userId,
      targetUserId: userId,
      newData: {
        status: 'ACTIVE',
      },
      changedFields: ['status'],
      context: context || {},
    });
  }

  /**
   * Log a comment creation
   */
  async logCommentCreate(
    commentId: string,
    commentData: {
      postId: string;
      authorId: string;
      content: string;
    },
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'CREATE',
      entity: 'COMMENT',
      entityId: commentId,
      newData: commentData,
      changedFields: ['content', 'postId', 'authorId'],
      context,
    });
  }

  /**
   * Log a comment deletion
   */
  async logCommentDelete(
    commentId: string,
    postId: string,
    context: AuditContext
  ): Promise<any> {
    return this.log({
      action: 'DELETE',
      entity: 'COMMENT',
      entityId: commentId,
      oldData: {
        postId,
      },
      changedFields: ['deletedAt'],
      context,
    });
  }

  /**
   * Get audit trail for an entity
   */
  async getEntityAuditTrail(
    entity: AuditEntity,
    entityId: string,
    limit: number = 100
  ): Promise<any[]> {
    return this.prisma.auditLog.findMany({
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
  async getUserActivityLog(
    userId: string,
    limit: number = 100
  ): Promise<any[]> {
    return this.prisma.auditLog.findMany({
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
   * Get recent actions across all entities
   */
  async getRecentActions(
    limit: number = 50,
    entity?: AuditEntity
  ): Promise<any[]> {
    return this.prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
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
   * Get audit statistics for a time period
   */
  async getAuditStats(options: {
    from?: Date;
    to?: Date;
    entity?: AuditEntity;
    userId?: string;
  }): Promise<{
    totalActions: number;
    actionBreakdown: Record<AuditAction, number>;
    entityBreakdown: Record<AuditEntity, number>;
    topUsers: Array<{ userId: string; username: string; actionCount: number }>;
  }> {
    const where: any = {};

    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) where.createdAt.gte = options.from;
      if (options.to) where.createdAt.lte = options.to;
    }

    if (options.entity) where.entity = options.entity;
    if (options.userId) where.userId = options.userId;

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const actionBreakdown: Record<AuditAction, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      PUBLISH: 0,
      UNPUBLISH: 0,
      SCHEDULE: 0,
      RESTORE: 0,
      UNDELETE: 0,
      APPROVE: 0,
      REJECT: 0,
      SUSPEND: 0,
      ACTIVATE: 0,
      LOCK: 0,
      UNLOCK: 0,
    };

    const entityBreakdown: Record<AuditEntity, number> = {
      USER: 0,
      POST: 0,
      COMMENT: 0,
      CATEGORY: 0,
      TAG: 0,
      IMAGE: 0,
      SETTING: 0,
      NOTIFICATION: 0,
    };

    const userActions = new Map<
      string,
      { userId: string; username: string; actionCount: number }
    >();

    logs.forEach((log) => {
      actionBreakdown[log.action as AuditAction]++;
      entityBreakdown[log.entity as AuditEntity]++;

      if (log.userId && log.user) {
        const key = log.userId;
        if (!userActions.has(key)) {
          userActions.set(key, {
            userId: log.userId,
            username: log.user.username,
            actionCount: 0,
          });
        }
        const entry = userActions.get(key)!;
        entry.actionCount++;
      }
    });

    const topUsers = Array.from(userActions.values())
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    return {
      totalActions: logs.length,
      actionBreakdown,
      entityBreakdown,
      topUsers,
    };
  }
}

export default AuditLogger;
