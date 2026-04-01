# Soft Delete & Audit Logging - Implementation Examples

Real-world code examples for integrating soft delete and audit logging into your routes.

## Table of Contents

1. [Post Routes Examples](#post-routes-examples)
2. [User Routes Examples](#user-routes-examples)
3. [Comment Routes Examples](#comment-routes-examples)
4. [Admin Dashboard Examples](#admin-dashboard-examples)
5. [Error Handling Examples](#error-handling-examples)
6. [Migration Examples](#migration-examples)

---

## Post Routes Examples

### Example 1: Create Post with Audit Logging

```typescript
// backend/src/routes/posts.ts

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import AuditLogger from '../services/auditLogger';
import { AuditRequest } from '../middleware/auditTracker';

const router = Router();
const prisma = new PrismaClient();
const auditLogger = new AuditLogger(prisma);

// POST /api/posts - Create a new post
router.post('/', authenticate, async (req: AuditRequest, res) => {
  try {
    // Validate request body
    if (!req.body.title || !req.body.slug) {
      return res.status(400).json({ error: 'Title and slug are required' });
    }

    // Check slug is unique
    const existingPost = await prisma.post.findUnique({
      where: { slug: req.body.slug },
    });

    if (existingPost && !existingPost.deletedAt) {
      return res.status(409).json({ error: 'Slug already exists' });
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        title: req.body.title,
        slug: req.body.slug,
        content: req.body.content || '',
        excerpt: req.body.excerpt,
        authorId: req.user.id,
        categoryId: req.body.categoryId,
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        seoTitle: req.body.seoTitle,
        metaDescription: req.body.metaDescription,
        status: 'DRAFT',
        wordCount: calculateWordCount(req.body.content),
      },
      include: { author: true, category: true },
    });

    // 🆕 Log the creation
    await auditLogger.logPostCreate(
      post.id,
      {
        title: post.title,
        slug: post.slug,
        authorId: post.authorId,
        category: post.categoryId,
        tags: post.tags,
      },
      {
        userId: req.user.id,
        userEmail: req.user.email,
        username: req.user.username,
        ipAddress: req.auditContext?.ipAddress,
        userAgent: req.auditContext?.userAgent,
        requestId: req.auditContext?.requestId,
        sessionId: req.auditContext?.sessionId,
      }
    );

    res.status(201).json({
      success: true,
      data: post,
      message: 'Post created successfully',
    });
  } catch (error) {
    console.error('Error creating post:', error);

    // Log failed creation attempt
    await auditLogger.log({
      action: 'CREATE',
      entity: 'POST',
      entityId: '',
      context: {
        userId: req.user?.id,
        ipAddress: req.auditContext?.ipAddress,
      },
      status: 'FAILED',
      errorMessage: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create post',
    });
  }
});

// Helper function
function calculateWordCount(content: string): number {
  return content ? content.split(/\s+/).length : 0;
}

export default router;
```

---

### Example 2: Update Post with Change Tracking

```typescript
// backend/src/routes/posts.ts

// PUT /api/posts/:id - Update a post
router.put('/:postId', authenticate, async (req: AuditRequest, res) => {
  try {
    const { postId } = req.params;

    // Get the old state
    const oldPost = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true },
    });

    if (!oldPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check authorization
    if (oldPost.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    // Prevent editing deleted posts
    if (oldPost.deletedAt) {
      return res.status(410).json({ error: 'Cannot edit a deleted post' });
    }

    // Update the post
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title: req.body.title ?? oldPost.title,
        content: req.body.content ?? oldPost.content,
        excerpt: req.body.excerpt ?? oldPost.excerpt,
        categoryId: req.body.categoryId ?? oldPost.categoryId,
        tags: Array.isArray(req.body.tags) ? req.body.tags : oldPost.tags,
        seoTitle: req.body.seoTitle ?? oldPost.seoTitle,
        metaDescription: req.body.metaDescription ?? oldPost.metaDescription,
        editedBy: req.user.id,
        wordCount: calculateWordCount(req.body.content ?? oldPost.content),
        updatedAt: new Date(),
      },
    });

    // 🆕 Detect what changed
    const changedFields: string[] = [];
    const oldData: Record<string, any> = {};
    const newData: Record<string, any> = {};

    if (oldPost.title !== updatedPost.title) {
      changedFields.push('title');
      oldData.title = oldPost.title;
      newData.title = updatedPost.title;
    }

    if (oldPost.content !== updatedPost.content) {
      changedFields.push('content');
      oldData.content = oldPost.content;
      newData.content = updatedPost.content;
    }

    if (oldPost.excerpt !== updatedPost.excerpt) {
      changedFields.push('excerpt');
      oldData.excerpt = oldPost.excerpt;
      newData.excerpt = updatedPost.excerpt;
    }

    if (oldPost.categoryId !== updatedPost.categoryId) {
      changedFields.push('categoryId');
      oldData.categoryId = oldPost.categoryId;
      newData.categoryId = updatedPost.categoryId;
    }

    if (JSON.stringify(oldPost.tags) !== JSON.stringify(updatedPost.tags)) {
      changedFields.push('tags');
      oldData.tags = oldPost.tags;
      newData.tags = updatedPost.tags;
    }

    // 🆕 Log only if something changed
    if (changedFields.length > 0) {
      await auditLogger.logPostUpdate(
        postId,
        {
          oldData,
          newData,
          changedFields,
        },
        {
          userId: req.user.id,
          userEmail: req.user.email,
          username: req.user.username,
          ipAddress: req.auditContext?.ipAddress,
          userAgent: req.auditContext?.userAgent,
          requestId: req.auditContext?.requestId,
        }
      );
    }

    res.json({
      success: true,
      data: updatedPost,
      message: 'Post updated successfully',
      changedFields,
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});
```

---

### Example 3: Publish/Unpublish Post with Audit Trail

```typescript
// backend/src/routes/posts.ts

// POST /api/posts/:id/publish - Publish a post
router.post('/:postId/publish', authenticate, async (req: AuditRequest, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.deletedAt) {
      return res.status(410).json({ error: 'Cannot publish a deleted post' });
    }

    if (post.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Post is already published' });
    }

    // Publish the post
    const publishedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedBy: req.user.id,
        publishedAt: new Date(),
        publishedAt_audit: new Date(),  // For audit trail
      },
    });

    // 🆕 Log publication with rich metadata
    await auditLogger.logPostPublish(
      postId,
      {
        title: publishedPost.title,
        slug: publishedPost.slug,
        category: publishedPost.categoryId,
        tags: publishedPost.tags,
        scheduledFor: req.body.scheduledFor,
      },
      {
        userId: req.user.id,
        username: req.user.username,
        ipAddress: req.auditContext?.ipAddress,
        userAgent: req.auditContext?.userAgent,
        requestId: req.auditContext?.requestId,
      }
    );

    // Send notification (optional)
    await notifyFollowers(publishedPost);

    res.json({
      success: true,
      data: publishedPost,
      message: 'Post published successfully',
    });
  } catch (error) {
    console.error('Error publishing post:', error);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// DELETE /api/posts/:id - Soft delete a post
router.delete('/:postId', authenticate, async (req: AuditRequest, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.deletedAt) {
      return res.status(410).json({ error: 'Post is already deleted' });
    }

    // 🆕 Use soft delete utility (automatically creates audit log)
    const { softDeletePost } = await import('@/lib/database/softDelete');

    await softDeletePost(prisma, postId, {
      userId: req.user.id,
      ipAddress: req.auditContext?.ipAddress,
      userAgent: req.auditContext?.userAgent,
    });

    res.json({
      success: true,
      message: 'Post deleted successfully',
      deletedAt: new Date(),
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// POST /api/posts/:id/restore - Restore a deleted post
router.post('/:postId/restore', authenticate, async (req: AuditRequest, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!post.deletedAt) {
      return res.status(400).json({ error: 'Post is not deleted' });
    }

    // 🆕 Use restore utility
    const { restorePost } = await import('@/lib/database/softDelete');

    const restoredPost = await restorePost(prisma, postId, {
      userId: req.user.id,
      ipAddress: req.auditContext?.ipAddress,
    });

    res.json({
      success: true,
      data: restoredPost,
      message: 'Post restored successfully',
    });
  } catch (error) {
    console.error('Error restoring post:', error);
    res.status(500).json({ error: 'Failed to restore post' });
  }
});

// GET /api/posts - List posts (filtering soft-deleted)
router.get('/', async (req: AuditRequest, res) => {
  try {
    // 🆕 Filter deleted posts by default
    const includeSoftDeleted = req.query.includeSoftDeleted === 'true';
    const isAdmin = req.user?.role === 'ADMIN';

    const posts = await prisma.post.findMany({
      where: {
        status: req.query.status || 'PUBLISHED',
        // 🆕 Only include deleted posts if explicitly requested by admin
        ...(!(includeSoftDeleted && isAdmin) && { deletedAt: null }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
          },
        },
        category: true,
      },
      orderBy: { publishedAt: 'desc' },
      skip: (req.query.page - 1) * 10 || 0,
      take: 10,
    });

    res.json({
      success: true,
      data: posts,
      total: posts.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});
```

---

## User Routes Examples

### Example 4: Create User with Audit Logging

```typescript
// backend/src/routes/users.ts

// POST /api/users - Create a new user
router.post('/', authenticateAdmin, async (req: AuditRequest, res) => {
  try {
    // Validate
    if (!req.body.email || !req.body.username) {
      return res.status(400).json({ error: 'Email and username required' });
    }

    // Check unique constraints
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: req.body.email },
          { username: req.body.username },
        ],
        deletedAt: null,
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email: req.body.email,
        username: req.body.username,
        name: req.body.name,
        passwordHash: await hashPassword(req.body.password),
        role: req.body.role || 'VIEWER',
        status: 'ACTIVE',
      },
    });

    // 🆕 Log creation
    await auditLogger.logUserCreate(
      newUser.id,
      {
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
      },
      {
        userId: req.user.id,
        username: req.user.username,
        ipAddress: req.auditContext?.ipAddress,
        requestId: req.auditContext?.requestId,
      }
    );

    // Don't return password hash
    const { passwordHash, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});
```

---

### Example 5: Update User with Audit Trail

```typescript
// backend/src/routes/users.ts

// PUT /api/users/:id - Update a user
router.put('/:userId', authenticateAdmin, async (req: AuditRequest, res) => {
  try {
    const { userId } = req.params;

    const oldUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!oldUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (oldUser.deletedAt) {
      return res.status(410).json({ error: 'Cannot edit a deleted user' });
    }

    // Update
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: req.body.role ?? oldUser.role,
        name: req.body.name ?? oldUser.name,
        status: req.body.status ?? oldUser.status,
      },
    });

    // 🆕 Detect changes
    const changedFields: string[] = [];
    const changes: Record<string, any> = {
      oldData: {},
      newData: {},
    };

    if (oldUser.role !== updatedUser.role) {
      changedFields.push('role');
      changes.oldData.role = oldUser.role;
      changes.newData.role = updatedUser.role;
    }

    if (changedFields.length > 0) {
      // 🆕 Log the changes
      await auditLogger.logUserUpdate(
        userId,
        {
          ...changes,
          changedFields,
        },
        {
          userId: req.user.id,
          username: req.user.username,
          ipAddress: req.auditContext?.ipAddress,
        }
      );
    }

    const { passwordHash, ...userWithoutPassword } = updatedUser;
    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Soft delete a user
router.delete('/:userId', authenticateAdmin, async (req: AuditRequest, res) => {
  try {
    const { softDeleteUser } = await import('@/lib/database/softDelete');

    await softDeleteUser(prisma, req.params.userId, {
      userId: req.user.id,
      ipAddress: req.auditContext?.ipAddress,
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/users/:id/suspend - Suspend a user
router.post('/:userId/suspend', authenticateAdmin, async (req: AuditRequest, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { status: 'SUSPENDED' },
    });

    // 🆕 Log suspension
    await auditLogger.logUserSuspend(
      user.id,
      req.body.reason,
      {
        userId: req.user.id,
        ipAddress: req.auditContext?.ipAddress,
      }
    );

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});
```

---

## Comment Routes Examples

### Example 6: Comment with Audit Trail

```typescript
// backend/src/routes/comments.ts

// POST /api/posts/:postId/comments - Create comment
router.post(
  '/:postId/comments',
  authenticate,
  async (req: AuditRequest, res) => {
    try {
      const post = await prisma.post.findUnique({
        where: { id: req.params.postId },
      });

      if (!post || post.deletedAt) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const comment = await prisma.comment.create({
        data: {
          content: req.body.content,
          postId: req.params.postId,
          authorId: req.user.id,
        },
      });

      // 🆕 Log comment creation
      await auditLogger.logCommentCreate(
        comment.id,
        {
          postId: comment.postId,
          authorId: comment.authorId,
          content: comment.content,
        },
        {
          userId: req.user.id,
          ipAddress: req.auditContext?.ipAddress,
        }
      );

      res.status(201).json({ success: true, data: comment });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);
```

---

## Admin Dashboard Examples

### Example 7: Audit Trail View

```typescript
// backend/src/routes/admin.ts

// GET /api/admin/audit-trail - View audit logs
router.get('/audit-trail', authenticateAdmin, async (req: AuditRequest, res) => {
  try {
    const { entity, action, userId, limit = 50, offset = 0 } = req.query;

    const logs = await auditLogger.getRecentActions(
      parseInt(limit as string),
      entity as any
    );

    res.json({
      success: true,
      data: logs,
      total: logs.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/admin/posts/:id/history - Post audit trail
router.get(
  '/posts/:postId/history',
  authenticateAdmin,
  async (req: AuditRequest, res) => {
    try {
      const history = await auditLogger.getEntityAuditTrail(
        'POST',
        req.params.postId,
        100
      );

      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }
);

// GET /api/admin/posts/:id/editors - Who edited a post
router.get(
  '/posts/:postId/editors',
  authenticateAdmin,
  async (req: AuditRequest, res) => {
    try {
      const { getPostEditors } = await import('@/lib/database/softDelete');

      const editors = await getPostEditors(prisma, req.params.postId);

      res.json({ success: true, data: editors });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch editors' });
    }
  }
);
```

---

## Error Handling Examples

### Example 8: Comprehensive Error Handling

```typescript
// backend/src/services/errorHandler.ts

export async function handleRouteError(
  error: Error,
  req: AuditRequest,
  auditLogger: AuditLogger,
  operation: string
) {
  console.error(`Error in ${operation}:`, error);

  // Log failed operation
  await auditLogger.log({
    action: 'UPDATE' as any, // Could be any action
    entity: 'POST',
    entityId: req.params?.id || 'unknown',
    context: {
      userId: req.user?.id,
      ipAddress: req.auditContext?.ipAddress,
      requestId: req.auditContext?.requestId,
    },
    status: 'FAILED',
    errorMessage: error.message,
  }).catch(logError => {
    console.error('Audit logging failed:', logError);
  });

  return {
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An error occurred'
      : error.message,
  };
}
```

---

## Migration Examples

### Example 9: Bulk Operation with Audit Trail

```typescript
// scripts/migrate-to-soft-delete.ts

import { PrismaClient } from '@prisma/client';
import AuditLogger from '../backend/src/services/auditLogger';

const prisma = new PrismaClient();
const auditLogger = new AuditLogger(prisma);

async function migrateyDeletedPosts() {
  const deletedPostIds = await prisma.$queryRaw`
    SELECT id FROM posts 
    WHERE status = 'DELETED' OR "deletedAt" IS NOT NULL
    LIMIT 100
  `;

  for (const { id } of deletedPostIds) {
    const post = await prisma.post.findUnique({ where: { id } });

    // Ensure soft delete is recorded properly
    await prisma.post.update({
      where: { id },
      data: {
        deletedAt: post.deletedAt || new Date(),
        deletedBy: post.deletedBy || 'system-migration',
      },
    });

    // Log the migration
    await auditLogger.log({
      action: 'UPDATE',
      entity: 'POST',
      entityId: id,
      context: {
        userId: 'system',
      },
      status: 'SUCCESS',
      errorMessage: 'Soft delete migration',
    });
  }

  console.log(`Migrated ${deletedPostIds.length} soft-deleted posts`);
}

migrateyDeletedPosts().catch(console.error);
```

---

## Database View Examples

### Example 10: Using PostgreSQL Views

```sql
-- Query active users
SELECT * FROM active_users WHERE role = 'EDITOR';

-- Query published posts with author info
SELECT 
  pp.id,
  pp.title,
  pp.slug,
  pp."publishedAt",
  u.username as "publishedBy"
FROM published_posts pp
JOIN users u ON pp."publishedBy" = u.id
ORDER BY pp."publishedAt" DESC;

-- Query complete post edit history
SELECT 
  pat.id,
  pat."postTitle",
  pat."actionType",
  pat."actionUser",
  pat."actionTime",
  pat."changes"
FROM post_audit_trail pat
WHERE pat."postId" = $1
ORDER BY pat."actionTime" DESC;
```

---

## Quick Copy-Paste Templates

### Delete Entity (Post or User)

```typescript
const { softDeletePost } = await import('@/lib/database/softDelete');
await softDeletePost(prisma, entityId, {
  userId: req.user.id,
  ipAddress: req.auditContext?.ipAddress,
});
```

### Log Action

```typescript
await auditLogger.logPostUpdate(
  postId,
  { oldData, newData, changedFields },
  {
    userId: req.user.id,
    userEmail: req.user.email,
    username: req.user.username,
    ipAddress: req.auditContext?.ipAddress,
    userAgent: req.auditContext?.userAgent,
  }
);
```

###Filter Deleted Records

```typescript
const records = await prisma.post.findMany({
  where: {
    deletedAt: null,  // Exclude deleted
    // other filters...
  },
});
```

---

All examples follow:
- Error handling best practices
- Audit context logging
- Type safety with TypeScript
- Database transaction patterns
- Request validation
