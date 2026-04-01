# Soft Delete & Audit Logging Implementation Checklist

## Overview

This checklist guides you through implementing soft delete and audit logging in your API routes. Use this to systematically update existing endpoints.

## Phase 1: Database Migration (✅ COMPLETED)

- ✅ Prisma schema updated with soft delete fields
- ✅ AuditLog model redesigned with comprehensive tracking
- ✅ Enums created (AuditAction, AuditEntity, AuditStatus)
- ✅ Database migration file generated
- ✅ 14 CHECK constraints defined
- ✅ 3 PostgreSQL views created
- ✅ 7 strategic indexes added

### To Apply Migration:

```bash
# 1. Apply migration
npm run prisma:migrate:deploy

# 2. Verify schema
npm run prisma:generate

# 3. Verify data integrity
npm run prisma:db:seed   # If you have seed data
```

---

## Phase 2: Application Layer Setup (✅ COMPLETED)

- ✅ Soft delete utility functions created (`lib/database/softDelete.ts`)
- ✅ Audit logger service created (`backend/src/services/auditLogger.ts`)
- ✅ Audit tracking middleware created (`backend/src/middleware/auditTracker.ts`)
- ✅ Developer documentation completed (`docs/SOFT_DELETE_AND_AUDIT_GUIDE.md`)
- ✅ Implementation examples provided (`docs/IMPLEMENTATION_EXAMPLES.md`)

### Library Files Created:

| File | Purpose | Export |
|------|---------|--------|
| `lib/database/softDelete.ts` | Soft delete operations | `softDeletePost`, `softDeleteUser`, `restorePost`, etc. |
| `backend/src/services/auditLogger.ts` | Audit logging | `AuditLogger` class with 15+ methods |
| `backend/src/middleware/auditTracker.ts` | Request context capture | `auditTrackingMiddleware`, `getAuditContext` |

---

## Phase 3: Express Setup (🟡 IN PROGRESS)

### 3.1: Update Express App Entry Point

**File**: `backend/src/index.ts` or `backend/src/server.ts`

**Status**: NOT STARTED

**Checklist**:
- [ ] Import audit middleware
- [ ] Import AuditLogger
- [ ] Initialize PrismaClient
- [ ] Add `auditTrackingMiddleware` to all routes
- [ ] Register `createAuditLogMiddleware` for monitored routes
- [ ] Test middleware is working

**Code Template**:

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {
  auditTrackingMiddleware,
  createAuditLogMiddleware,
} from './middleware/auditTracker';
import AuditLogger from './services/auditLogger';

const app = express();
const prisma = new PrismaClient();
const auditLogger = new AuditLogger(prisma);

// 1. Add audit tracking to ALL requests
app.use(auditTrackingMiddleware);

// 2. Add audit logging middleware for specific monitored routes
app.use(
  createAuditLogMiddleware(auditLogger, [
    { path: '/api/posts', entity: 'POST' },
    { path: '/api/posts/[id]', entity: 'POST' },
    { path: '/api/users', entity: 'USER' },
    { path: '/api/comments', entity: 'COMMENT' },
  ])
);

// Your existing routes...
app.use('/api/posts', postRouter);
app.use('/api/users', userRouter);
```

---

## Phase 4: Update API Routes (🟡 IN PROGRESS)

### 4.1: Post Routes - Create

**File**: `backend/src/routes/posts.ts` → POST `/api/posts`

**Status**: NOT STARTED

**Changes Required**:
1. Add audit logging after post creation
2. Capture user context from request

**Code Template**:

```typescript
import AuditRequest from '../middleware/auditTracker';
import AuditLogger from '../services/auditLogger';

app.post('/api/posts', authenticate, async (req: AuditRequest, res) => {
  try {
    const post = await prisma.post.create({
      data: {
        title: req.body.title,
        slug: req.body.slug,
        content: req.body.content,
        authorId: req.user.id,
        // ... other fields
      },
    });

    // 🆕 Log creation
    await auditLogger.logPostCreate(
      post.id,
      {
        title: post.title,
        slug: post.slug,
        authorId: post.authorId,
        category: req.body.category,
        tags: req.body.tags,
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

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Verification**:
- [ ] Audit log created after each post creation
- [ ] User information captured correctly
- [ ] Request ID and IP address recorded

---

### 4.2: Post Routes - Update

**File**: `backend/src/routes/posts.ts` → PUT `/api/posts/:id`

**Status**: NOT STARTED

**Changes Required**:
1. Capture old state before update
2. Log what changed
3. Update `editedBy` field

**Code Template**:

```typescript
app.put('/api/posts/:id', authenticate, async (req: AuditRequest, res) => {
  try {
    // 🆕 Get old state
    const oldPost = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!oldPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Update with editedBy tracking
    const updatedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        content: req.body.content,
        editedBy: req.user.id,  // 🆕 Track who edited
        updatedAt: new Date(),
        // ... other fields
      },
    });

    // 🆕 Determine what changed
    const changedFields = [];
    if (oldPost.title !== updatedPost.title) changedFields.push('title');
    if (oldPost.content !== updatedPost.content) changedFields.push('content');
    if (oldPost.excerpt !== updatedPost.excerpt) changedFields.push('excerpt');

    // 🆕 Log the update
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
      }
    );

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Verification**:
- [ ] Changed fields captured correctly
- [ ] Audit log shows before/after values
- [ ] `editedBy` field updated on post

---

### 4.3: Post Routes - Publish

**File**: `backend/src/routes/posts.ts` → POST `/api/posts/:id/publish`

**Status**: NOT STARTED

**Changes Required**:
1. Log publish action with metadata
2. Update `publishedBy` field
3. Set `publishedAt`

**Code Template**:

```typescript
app.post('/api/posts/:id/publish', authenticate, async (req: AuditRequest, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Publish the post
    const publishedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        status: 'PUBLISHED',
        publishedBy: req.user.id,  // 🆕 Track who published
        publishedAt: new Date(),
      },
    });

    // 🆕 Log publication with metadata
    await auditLogger.logPostPublish(
      req.params.id,
      {
        title: publishedPost.title,
        slug: publishedPost.slug,
        category: publishedPost.categoryId,
        tags: publishedPost.tags,
      },
      {
        userId: req.user.id,
        username: req.user.username,
        ipAddress: req.auditContext?.ipAddress,
        userAgent: req.auditContext?.userAgent,
      }
    );

    res.json(publishedPost);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Verification**:
- [ ] `publishedBy` field set to current user
- [ ] `publishedAt` timestamp recorded
- [ ] Audit log shows publish action

---

### 4.4: Post Routes - Delete

**File**: `backend/src/routes/posts.ts` → DELETE `/api/posts/:id`

**Status**: NOT STARTED

**Changes Required**:
1. Use `softDeletePost` utility instead of hard delete
2. Remove any hard delete queries

**Code Template**:

```typescript
import { softDeletePost } from '@/lib/database/softDelete';

app.delete('/api/posts/:id', authenticate, async (req: AuditRequest, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // 🆕 Use soft delete utility (automatically logs)
    await softDeletePost(prisma, req.params.id, {
      userId: req.user.id,
      ipAddress: req.auditContext?.ipAddress,
      userAgent: req.auditContext?.userAgent,
    });

    res.json({ message: 'Post deleted', deletedAt: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Verification**:
- [ ] No hard DELETE queries in code
- [ ] `softDeletePost` utility is used
- [ ] Audit log created by utility

---

### 4.5: Post Routes - Restore

**File**: `backend/src/routes/posts.ts` → POST `/api/posts/:id/restore`

**Status**: NOT STARTED

**Changes Required**:
1. Add restore endpoint if not exists
2. Use `restorePost` utility

**Code Template**:

```typescript
import { restorePost } from '@/lib/database/softDelete';

// NEW: Restore deleted post
app.post('/api/posts/:id/restore', authenticate, async (req: AuditRequest, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!post.deletedAt) {
      return res.status(400).json({ error: 'Post is not deleted' });
    }

    // 🆕 Restore using utility (automatically logs)
    await restorePost(prisma, req.params.id, {
      userId: req.user.id,
      ipAddress: req.auditContext?.ipAddress,
    });

    res.json({ message: 'Post restored' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Verification**:
- [ ] Endpoint responds to POST /api/posts/:id/restore
- [ ] `restorePost` utility used
- [ ] Deleted posts can be recovered

---

### 4.6: Post Routes - List (with Soft Delete Filter)

**File**: `backend/src/routes/posts.ts` → GET `/api/posts`

**Status**: NOT STARTED

**Changes Required**:
1. Filter out deleted posts by default
2. Add option to include deleted posts for admin

**Code Template**:

```typescript
app.get('/api/posts', async (req: AuditRequest, res) => {
  try {
    // 🆕 Filter deleted posts by default
    const includeSoftDeleted = req.query.includeSoftDeleted === 'true' && req.user?.role === 'ADMIN';

    const posts = await prisma.post.findMany({
      where: {
        ...(req.query.status && { status: req.query.status }),
        ...(!includeSoftDeleted && { deletedAt: null }),  // 🆕
      },
      orderBy: { publishedAt: 'desc' },
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Verification**:
- [ ] Normal queries exclude deleted posts
- [ ] Admin can optionally include soft-deleted posts
- [ ] No deleted posts shown to regular users

---

### 4.7: User Routes - Similar Updates

**Files**:
- `backend/src/routes/users.ts` → POST `/api/users` (create)
- `backend/src/routes/users.ts` → PUT `/api/users/:id` (update)
- `backend/src/routes/users.ts` → DELETE `/api/users/:id` (soft delete)
- `backend/src/routes/users.ts` → POST `/api/users/:id/restore` (restore)

**Status**: NOT STARTED

**Changes**:
1. Add `logUserCreate` after user creation
2. Add `logUserUpdate` when user is modified
3. Use `softDeleteUser` instead of hard delete
4. Add restore endpoint with `restoreUser`
5. Filter `deletedAt: null` in user queries

**Code Template** (POST /api/users):

```typescript
app.post('/api/users', authenticate, async (req: AuditRequest, res) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        username: req.body.username,
        name: req.body.name,
        role: req.body.role,
      },
    });

    // 🆕 Log creation
    await auditLogger.logUserCreate(
      user.id,
      {
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      {
        userId: req.user.id,
        ipAddress: req.auditContext?.ipAddress,
      }
    );

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Phase 5: Frontend Updates (⏳ NOT STARTED)

**For later consideration:**

- Update delete confirmation to mention soft delete
- Add "Restore" option to deleted posts/users
- Show deletion timestamp and who deleted
- Display edit history UI
- Show publishing timeline with who published when

---

## Phase 6: Testing (⏳ NOT STARTED)

### Unit Tests

Create `backend/tests/softDelete.test.ts`:

```typescript
describe('Soft Delete', () => {
  it('should soft delete a post', async () => {
    // Test implementation
  });

  it('should restore a deleted post', async () => {
    // Test implementation
  });

  it('should filter deleted posts from queries', async () => {
    // Test implementation
  });
});
```

Create `backend/tests/auditLogger.test.ts`:

```typescript
describe('Audit Logger', () => {
  it('should log post creation', async () => {
    // Test implementation
  });

  it('should capture changed fields', async () => {
    // Test implementation
  });

  it('should track who published a post', async () => {
    // Test implementation
  });
});
```

### Integration Tests

- Test middleware captures context correctly
- Test audit logs created after each operation
- Test soft delete filter works across API

### End-to-End Tests

- Create, edit, delete, restore post workflow
- Verify audit trail shows all operations
- Check publishing history

---

## Phase 7: Documentation (🟡 IN PROGRESS)

- ✅ Developer guide created (`docs/SOFT_DELETE_AND_AUDIT_GUIDE.md`)
- ✅ Implementation examples provided
- ✅ This checklist created

**Remaining**:
- [ ] API endpoint documentation updated
- [ ] Database schema diagrams added
- [ ] Example scenarios documented
- [ ] Troubleshooting guide completed
- [ ] Migration guide for existing data

---

## Implementation Order (Recommended)

### Week 1: Foundation
1. Apply database migration
2. Setup Express app with middleware
3. Verify middleware works with test requests

### Week 2: Core Routes
1. Update POST /api/posts (create)
2. Update POST /api/users (create)
3. Update PUT /api/posts/:id (edit)
4. Update PUT /api/users/:id (edit)

### Week 3: Advanced Operations
1. Update DELETE /api/posts/:id (soft delete)
2. Update DELETE /api/users/:id (soft delete)
3. Add POST /api/posts/:id/restore (restore)
4. Add POST /api/users/:id/restore (restore)

### Week 4: Query Filters & Testing
1. Update GET /api/posts (add deletedAt filter)
2. Update GET /api/users (add deletedAt filter)
3. Write unit tests
4. Write integration tests

### Week 5: Polish & Documentation
1. Complete API documentation
2. Add error handling examples
3. Create admin dashboard for audit logs
4. Final verification

---

## Quick Reference: Common Updates

### Filter deleted records:
```typescript
where: { 
  deletedAt: null,  // Add this to all queries
}
```

### Log an action:
```typescript
await auditLogger.logPostUpdate(id, { oldData, newData, changedFields }, context);
```

### Use soft delete:
```typescript
await softDeletePost(prisma, postId, { userId });
```

### Get contexts from request:
```typescript
const context: AuditContext = {
  userId: req.user.id,
  userEmail: req.user.email,
  username: req.user.username,
  ipAddress: req.auditContext?.ipAddress,
  userAgent: req.auditContext?.userAgent,
  requestId: req.auditContext?.requestId,
};
```

---

## Success Criteria

Once complete, you should have:

- ✅ All API routes use soft delete (never hard delete)
- ✅ All create/update/delete operations logged
- ✅ Publishing history tracked (`publishedBy`, `editedBy`)
- ✅ Audit trail available for all entities
- ✅ Deleted posts/users can be restored
- ✅ Deleted records excluded from normal queries
- ✅ Admin can view deleted records if needed
- ✅ All changes attributed to users with context

---

## Support & Questions

For questions about implementation:
1. Check `docs/SOFT_DELETE_AND_AUDIT_GUIDE.md` for detailed guide
2. Review examples in `lib/database/softDelete.ts`
3. Check middleware code in `backend/src/middleware/auditTracker.ts`
4. Review AuditLogger class in `backend/src/services/auditLogger.ts`

For debugging:
- Enable Prisma logging: `DEBUG=prisma:* npm run dev`
- Check audit_logs table: `SELECT * FROM audit_logs ORDER BY "createdAt" DESC LIMIT 10;`
- Verify soft delete fields: `SELECT id, title, "deletedAt", "deletedBy" FROM posts WHERE deleted_at IS NOT NULL;`
