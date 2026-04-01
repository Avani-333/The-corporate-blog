# Soft Delete & Audit Logging Implementation Guide

## Overview

This guide explains how to use the soft delete and audit logging features in The Corporate Blog. These features enable:

- **Soft Deletes**: Users and posts can be deleted without permanently removing data
- **Audit Trail**: Complete history of who did what, when, and why
- **Data Recovery**: Easy restoration of soft-deleted records
- **Compliance**: GDPR-ready with comprehensive audit logs

## Table of Contents

1. [Soft Delete Overview](#soft-delete-overview)
2. [Audit Logging Overview](#audit-logging-overview)
3. [Using Soft Delete](#using-soft-delete)
4. [Using Audit Logging](#using-audit-logging)
5. [Querying Soft-Deleted Data](#querying-soft-deleted-data)
6. [Best Practices](#best-practices)
7. [Examples](#examples)
8. [API Endpoints](#api-endpoints)

---

## Soft Delete Overview

### What is Soft Delete?

Soft delete is a pattern where records aren't permanently removed from the database. Instead:
- A `deletedAt` timestamp is set
- A `deletedBy` field records who deleted the record
- The record remains in the database but is excluded from normal queries
- The record can be restored later

### Supported Entities

Currently, soft delete is implemented for:
- **User**: `deletedAt`, `deletedBy` fields
- **Post**: `deletedAt`, `deletedBy` fields

### Database Schema

#### User Model
```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  username    String
  name        String?
  deletedAt   DateTime?
  deletedBy   String?    // User ID of who deleted this user
  status      String   @default("ACTIVE")  // ACTIVE, SUSPENDED, INACTIVE
  
  @@index([deletedAt])
}
```

#### Post Model
```prisma
model Post {
  id            String   @id @default(cuid())
  title         String   @db.VarChar(255)
  slug          String   @unique
  content       String
  deletedAt     DateTime?
  deletedBy     String?    // User ID of who deleted this post
  publishedBy   String?    // User ID of who published this post
  editedBy      String?    // User ID of who last edited this post
  publishedAt   DateTime?
  publishedAt_audit DateTime?  // For audit trail
  
  @@index([deletedAt])
  @@index([publishedBy])
  @@index([editedBy])
}
```

---

## Audit Logging Overview

### What is Audit Logging?

Audit logging automatically records:
- **Who** made the change (userId, username, email)
- **What** changed (action: CREATE, UPDATE, DELETE, PUBLISH, etc.)
- **When** it happened (createdAt timestamp)
- **Where** from (IP address)
- **How** (user agent, request ID)
- **Change details** (old values, new values, changed fields)

### Audit Actions

14 action types are supported:

| Action | Description |
|--------|-------------|
| `CREATE` | Entity created |
| `UPDATE` | Entity updated |
| `DELETE` | Entity soft-deleted |
| `PUBLISH` | Post published |
| `UNPUBLISH` | Post unpublished |
| `SCHEDULE` | Post scheduled for publication |
| `RESTORE` | Soft-deleted entity restored |
| `UNDELETE` | Same as RESTORE (alias) |
| `APPROVE` | Content approved by moderator |
| `REJECT` | Content rejected |
| `SUSPEND` | User suspended |
| `ACTIVATE` | User reactivated |
| `LOCK` | Entity locked |
| `UNLOCK` | Entity unlocked |

### Audit Entities

8 entity types are tracked:

| Entity | Description |
|--------|-------------|
| `USER` | User account |
| `POST` | Blog post |
| `COMMENT` | Post comment |
| `CATEGORY` | Blog category |
| `TAG` | Blog tag |
| `IMAGE` | Uploaded image |
| `SETTING` | System settings |
| `NOTIFICATION` | User notification |

### AuditLog Schema

```prisma
model AuditLog {
  id              String   @id @default(cuid())
  action          AuditAction
  entity          AuditEntity
  entityId        String
  userId          String?    // Who made the change
  targetUserId    String?    // If action targeted a specific user
  oldData         Json?      // Previous state (for updates)
  newData         Json?      // New state (for creates/updates)
  changedFields   String[]   // Fields that changed
  publishDetails  Json?      // For PUBLISH actions
  editDetails     Json?      // For UPDATE actions on posts
  ipAddress       String?    // Source IP
  userAgent       String?    // Browser/client info
  requestId       String?    // Correlation ID
  status          AuditStatus // SUCCESS, FAILED, PARTIAL
  errorMessage    String?
  createdAt       DateTime   @default(now())
  
  user            User?      @relation("userAction")
  targetUser      User?      @relation("targetUser")
  
  @@index([entity, action])
  @@index([userId])
  @@index([createdAt])
  @@index([entity, entityId])
  @@index([entityId, action])
  @@index([targetUserId])
}
```

---

## Using Soft Delete

### Import Utilities

```typescript
import {
  softDeletePost,
  softDeleteUser,
  restorePost,
  restoreUser,
  getActivePosts,
  getActiveUsers,
  getDeletedPosts,
  getDeletedUsers,
  countDeletedPosts,
  countDeletedUsers,
} from '@/lib/database/softDelete';
```

### Delete a Post

```typescript
// Soft delete a post
const deletedPost = await softDeletePost(prisma, postId, {
  userId: currentUser.id,           // Who is deleting
  ipAddress: request.ipAddress,      // Audit trail
  userAgent: request.userAgent,      // Audit trail
});

console.log(deletedPost.deletedAt);  // Timestamp of deletion
console.log(deletedPost.deletedBy);  // ID of user who deleted
```

### Delete a User

```typescript
// Soft delete a user
const deletedUser = await softDeleteUser(prisma, userId, {
  userId: adminUserId,               // Admin performing deletion
  ipAddress: request.ipAddress,
  userAgent: request.userAgent,
});

console.log(deletedUser.deletedAt);  // When deleted
console.log(deletedUser.deletedBy);  // Who deleted it
```

### Restore a Deleted Entity

```typescript
// Restore a soft-deleted post
const restoredPost = await restorePost(prisma, postId, {
  userId: currentUser.id,
  ipAddress: request.ipAddress,
});

// Restore a soft-deleted user
const restoredUser = await restoreUser(prisma, userId, {
  userId: adminUserId,
});
```

---

## Using Audit Logging

### Setup: Import and Initialize

```typescript
import AuditLogger from '@/backend/src/services/auditLogger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const auditLogger = new AuditLogger(prisma);
```

### Log a Post Creation

```typescript
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
    userId: currentUser.id,
    userEmail: currentUser.email,
    username: currentUser.username,
    ipAddress: request.ipAddress,
    userAgent: request.headers['user-agent'],
    requestId: request.id,
  }
);
```

### Log a Post Update

```typescript
// Track changes
const oldPost = await prisma.post.findUnique({ where: { id: postId } });

// ...perform update...

const newPost = await prisma.post.findUnique({ where: { id: postId } });

// Log the change
await auditLogger.logPostUpdate(
  postId,
  {
    oldData: {
      title: oldPost.title,
      content: oldPost.content,
      wordCount: oldPost.wordCount,
    },
    newData: {
      title: newPost.title,
      content: newPost.content,
      wordCount: newPost.wordCount,
    },
    changedFields: ['title', 'content', 'wordCount'],
  },
  {
    userId: currentUser.id,
    userEmail: currentUser.email,
    username: currentUser.username,
    ipAddress: request.ipAddress,
    userAgent: request.headers['user-agent'],
  }
);
```

### Log a Post Publication

```typescript
await auditLogger.logPostPublish(
  post.id,
  {
    title: post.title,
    slug: post.slug,
    category: post.category,
    tags: post.tags,
  },
  {
    userId: currentUser.id,
    username: currentUser.username,
    ipAddress: request.ipAddress,
    userAgent: request.headers['user-agent'],
  }
);
```

### Log a Post Deletion

```typescript
await auditLogger.logPostDelete(
  post.id,
  {
    title: post.title,
    authorId: post.authorId,
    status: post.status,
  },
  {
    userId: currentUser.id,
    ipAddress: request.ipAddress,
  }
);
```

### Log a Scheduled Publication

```typescript
await auditLogger.logPostSchedule(
  post.id,
  {
    title: post.title,
    scheduledFor: new Date('2024-02-15T10:00:00Z'),
    category: post.category,
  },
  {
    userId: currentUser.id,
    username: currentUser.username,
  }
);
```

### Log User Actions

```typescript
// User created
await auditLogger.logUserCreate(
  newUser.id,
  {
    email: newUser.email,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role,
  },
  { userId: adminUser.id }
);

// User modified
await auditLogger.logUserUpdate(
  user.id,
  {
    oldData: { role: 'VIEWER' },
    newData: { role: 'EDITOR' },
    changedFields: ['role'],
  },
  { userId: adminUser.id }
);

// User deleted
await auditLogger.logUserDelete(
  user.id,
  {
    email: user.email,
    username: user.username,
    role: user.role,
  },
  { userId: adminUser.id }
);

// User suspended
await auditLogger.logUserSuspend(
  user.id,
  'Violates community guidelines',
  { userId: moderatorUser.id }
);

// User reactivated
await auditLogger.logUserActivate(
  user.id,
  { userId: adminUser.id }
);
```

---

## Querying Soft-Deleted Data

### Get Only Active Records

```typescript
// Get active posts (soft-deleted excluded)
const activePosts = await getActivePosts(prisma, {
  authorId: 'user-123',
  status: 'PUBLISHED',
});

// Get active users (soft-deleted excluded)
const activeUsers = await getActiveUsers(prisma, {
  role: 'EDITOR',
});

// Or use Prisma directly with filters
const activePosts = await prisma.post.findMany({
  where: {
    deletedAt: null,
    status: 'PUBLISHED',
  },
});
```

### Get Deleted Records

```typescript
// Get posts deleted in the last 30 days
const recentlyDeleted = await getDeletedPosts(prisma, {
  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  to: new Date(),
});

// Get posts deleted by a specific user
const userDeletedPosts = await getDeletedPosts(prisma, {
  authorId: 'user-123',
});

// Count deleted posts
const deletedPostCount = await countDeletedPosts(prisma);

// Count deleted users
const deletedUserCount = await countDeletedUsers(prisma);
```

### Get Audit Trail

```typescript
// Get all changes to a specific post
const postHistory = await auditLogger.getEntityAuditTrail('POST', postId);

// Get all changes made by a user
const userActivity = await auditLogger.getUserActivityLog(userId);

// Get recent audit events
const recentActions = await auditLogger.getRecentActions(50);

// Get audit stats for a time period
const stats = await auditLogger.getAuditStats({
  from: new Date('2024-01-01'),
  to: new Date('2024-02-01'),
  entity: 'POST',
});

console.log(stats.totalActions);      // Total number of actions
console.log(stats.actionBreakdown);   // Count by action type
console.log(stats.entityBreakdown);   // Count by entity type
console.log(stats.topUsers);          // Most active users
```

### Get Publishing History

```typescript
// Get all edits to a post
const edits = await auditLogger.getEntityAuditTrail('POST', postId);

// Get who published a post
const publisher = await auditLogger.getPostPublisher(postId);
if (publisher) {
  console.log(`Published by: ${publisher.publishedByUser.username}`);
  console.log(`Published at: ${publisher.publishedAt}`);
}

// Get all editors of a post
const editors = await auditLogger.getPostEditors(postId);
editors.forEach(editor => {
  console.log(`${editor.username}: ${editor.editCount} edits`);
});
```

---

## Using Middleware

### Setup Express App

```typescript
import express from 'express';
import {
  auditTrackingMiddleware,
  createAuditLogMiddleware,
} from '@/backend/src/middleware/auditTracker';
import AuditLogger from '@/backend/src/services/auditLogger';

const app = express();
const auditLogger = new AuditLogger(prisma);

// 1. Add audit tracking to all routes
app.use(auditTrackingMiddleware);

// 2. Add automatic audit logging for specific routes
app.use(
  createAuditLogMiddleware(auditLogger, [
    { path: '/api/posts', entity: 'POST' },
    { path: '/api/users', entity: 'USER' },
    { path: '/api/comments', entity: 'COMMENT' },
  ])
);

// Your routes will now have req.auditContext available
```

### Access Audit Context in Route Handlers

```typescript
app.post('/api/posts', (req: AuditRequest, res) => {
  const context = req.auditContext;
  console.log(`User ${context.username} from ${context.ipAddress}`);
  console.log(`Request ID: ${context.requestId}`);
  
  // Create post...
});

app.put('/api/posts/:id', async (req: AuditRequest, res) => {
  const oldPost = await prisma.post.findUnique({
    where: { id: req.params.id },
  });

  // Update post...
  
  // Log the change
  await auditLogger.logPostUpdate(
    req.params.id,
    {
      oldData: oldPost,
      newData: req.body,
      changedFields: Object.keys(req.body),
    },
    {
      userId: req.auditContext?.userId,
      userEmail: req.auditContext?.userEmail,
      username: req.auditContext?.username,
      ipAddress: req.auditContext?.ipAddress,
      userAgent: req.auditContext?.userAgent,
      requestId: req.auditContext?.requestId,
    }
  );

  res.json(updatedPost);
});
```

---

## Best Practices

### 1. Always Set Context When Logging

Always include user information and request context:

```typescript
// ✅ Good
await auditLogger.logPostUpdate(postId, changes, {
  userId: currentUser.id,
  username: currentUser.username,
  ipAddress: request.ipAddress,
  userAgent: request.headers['user-agent'],
  requestId: request.id,
});

// ❌ Bad
await auditLogger.logPostUpdate(postId, changes, {});
```

### 2. Log Before and After State

Capture both old and new values for audits:

```typescript
// Get old state
const oldPost = await prisma.post.findUnique({ where: { id } });

// Make changes
const newPost = await prisma.post.update({ ... });

// Log with both states
await auditLogger.logPostUpdate(id, {
  oldData: oldPost,
  newData: newPost,
  changedFields: ['title', 'content'],
}, context);
```

### 3. Always Use Soft Delete Utilities

Never directly set `deletedAt` without using the utilities:

```typescript
// ✅ Good
await softDeletePost(prisma, postId, { userId });

// ❌ Bad - doesn't create audit log
await prisma.post.update({
  where: { id: postId },
  data: { deletedAt: new Date() },
});
```

### 4. Filter Deleted Records in Queries

Always exclude soft-deleted records in normal queries:

```typescript
// ✅ Good
const posts = await prisma.post.findMany({
  where: { deletedAt: null, status: 'PUBLISHED' },
});

// ❌ Bad - includes deleted posts
const posts = await prisma.post.findMany({
  where: { status: 'PUBLISHED' },
});
```

### 5. Use Database Views for Complex Queries

PostgreSQL views simplify common queries:

```sql
-- Available views:
SELECT * FROM active_users;              -- All non-deleted users
SELECT * FROM published_posts;           -- Published, non-deleted posts
SELECT * FROM post_audit_trail;          -- Post changes with usernames
```

### 6. Archive Old Audit Logs

Periodically archive old audit logs (older than 1-2 years):

```typescript
// Archive logs older than 2 years
const twoYearsAgo = new Date();
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

const oldLogs = await prisma.auditLog.findMany({
  where: {
    createdAt: { lt: twoYearsAgo },
  },
});

// Export to storage, then delete
```

---

## Examples

### Example 1: Edit a Post with Full Audit Trail

```typescript
// backend/src/routes/posts.ts

app.put('/api/posts/:id', authenticate, async (req: AuditRequest, res) => {
  try {
    // Get old state
    const oldPost = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: { author: true },
    });

    if (!oldPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check authorization
    if (oldPost.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        content: req.body.content,
        excerpt: req.body.excerpt,
        editedBy: req.user.id,
        wordCount: calculateWords(req.body.content),
      },
    });

    // Log the changes
    const changedFields = [];
    if (oldPost.title !== updatedPost.title) changedFields.push('title');
    if (oldPost.content !== updatedPost.content) changedFields.push('content');
    if (oldPost.excerpt !== updatedPost.excerpt) changedFields.push('excerpt');

    await auditLogger.logPostUpdate(
      req.params.id,
      {
        oldData: {
          title: oldPost.title,
          content: oldPost.content,
          excerpt: oldPost.excerpt,
        },
        newData: {
          title: updatedPost.title,
          content: updatedPost.content,
          excerpt: updatedPost.excerpt,
        },
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

    res.json(updatedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Example 2: Delete and Restore a Post

```typescript
// Delete a post
app.delete('/api/posts/:id', authenticate, async (req: AuditRequest, res) => {
  const deletedPost = await softDeletePost(prisma, req.params.id, {
    userId: req.user.id,
    ipAddress: req.auditContext?.ipAddress,
  });

  res.json({ message: 'Post deleted', deletedAt: deletedPost.deletedAt });
});

// Restore a post
app.post('/api/posts/:id/restore', authenticate, async (req: AuditRequest, res) => {
  const restoredPost = await restorePost(prisma, req.params.id, {
    userId: req.user.id,
    ipAddress: req.auditContext?.ipAddress,
  });

  res.json({ message: 'Post restored' });
});
```

### Example 3: Admin Dashboard - Recent Activity

```typescript
// admin/src/routes/dashboard.ts

app.get('/api/admin/activity', authenticateAdmin, async (req: AuditRequest, res) => {
  const recentActions = await auditLogger.getRecentActions(50, 'POST');

  const stats = await auditLogger.getAuditStats({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  });

  res.json({
    recentActions,
    stats,
  });
});
```

---

## Database Constraints

The migration includes automatic database constraints to prevent invalid data:

### Email Validation
```sql
ALTER TABLE "User" ADD CONSTRAINT "email_format" CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$');
```

### Length Constraints
```sql
ALTER TABLE "Post" ADD CONSTRAINT "title_length" CHECK (length(title) <= 255);
ALTER TABLE "Post" ADD CONSTRAINT "seo_title_length" CHECK (length("seoTitle") <= 60);
```

### Positive Counts
```sql
ALTER TABLE "Post" ADD CONSTRAINT "view_count_positive" CHECK ("viewCount" >= 0);
ALTER TABLE "Post" ADD CONSTRAINT "like_count_positive" CHECK ("likeCount" >= 0);
```

### Future Date Prevention
```sql
ALTER TABLE "User" ADD CONSTRAINT "deleted_at_not_future" CHECK ("deletedAt" <= now());
```

---

## Troubleshooting

### Issue: Audit log entry not created

**Solution**: Ensure middleware is properly registered:
```typescript
app.use(auditTrackingMiddleware);
app.use(createAuditLogMiddleware(auditLogger, routes));
```

### Issue: Soft-deleted posts appearing in queries

**Solution**: Add `deletedAt: null` filter:
```typescript
const posts = await prisma.post.findMany({
  where: {
    deletedAt: null,  // Add this
    status: 'PUBLISHED',
  },
});
```

### Issue: Can't find who published a post

**Solution**: Check for PUBLISH action in audit trail:
```typescript
const publisher = await auditLogger.getPostPublisher(postId);
if (!publisher) {
  console.log('Post has never been published');
}
```

---

## Migration Guide

### For Existing Posts and Users

The migration preserves existing data:

1. **New nullable fields** are added with default NULL values
2. **Existing records** remain unchanged
3. **Soft delete is opt-in** - existing records aren't deleted
4. **Audit logs** start being recorded after migration
5. **Historical deletes before migration** won't have audit traces

### Recommended Post-Migration Steps

1. **Verify data integrity**:
   ```sql
   SELECT COUNT(*) FROM "User" WHERE "deletedAt" IS NOT NULL;    -- Should be 0
   SELECT COUNT(*) FROM "Post" WHERE "deletedAt" IS NOT NULL;    -- Should be 0
   ```

2. **Test soft delete functionality**:
   ```bash
   npm test -- --testPathPattern=softDelete
   ```

3. **Enable audit logging** in all API routes

4. **Update frontend** to handle soft deletes (add recovery UI)

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/triggers.html)
- [GDPR Compliance Guide](./SECURITY_HARDENING.md)
- [Database Schema](./DATABASE.md)
