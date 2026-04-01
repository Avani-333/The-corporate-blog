/**
 * Database Optimization Implementation Checklist
 * 
 * This checklist tracks all necessary changes to eliminate N+1 queries
 * and add missing indexes for optimal database performance.
 * 
 * Status: Complete implementation guide with code examples
 */

# Database Optimization Implementation Checklist

## Phase 1: Deploy New Indexes ⏳ (CRITICAL)

### 1.1 Create Migration
- [ ] Run migration: `npx prisma migrate dev --name add_query_optimization_indexes`
- [ ] Verify indexes created in PostgreSQL: `\d+ posts` / `\d+ users`
- [ ] Confirm no errors in migration logs
- [ ] File: `prisma/migrations/add_query_optimization_indexes/migration.sql`

**Expected Duration**: 5-10 minutes (depends on database size)

**Impact**: Immediate improvement in query performance for:
- Post lookups by slug
- Category/tag lookups
- User lookups by username/googleId
- Audit log time-range queries

### 1.2 Index Verification
Execute these queries after migration:

```sql
-- Verify index creation
SELECT indexname FROM pg_indexes 
WHERE tablename = 'posts' 
ORDER BY indexname;

-- Check index usage (run after load testing)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Success Criteria**:
- ✅ 30+ new indexes created
- ✅ No duplicate indexes
- ✅ All compound indexes present
- ✅ Partial indexes for soft-deleted records

---

## Phase 2: Refactor N+1 Query Patterns 🔄 (HIGH PRIORITY)

### 2.1 Slug Validation Service
**File**: `lib/slug-validation.ts` → Replace with `lib/database/optimizedSlugValidator.ts`

**Before** (100 queries worst case):
```typescript
// OLD PATTERN - DO NOT USE
let slug = baseSlug;
let counter = 1;
while (true) {
  const exists = await prisma.post.findFirst({ where: { slug } });
  if (!exists) break;
  slug = `${baseSlug}-${counter++}`;
}
```

**After** (1 query):
```typescript
// NEW PATTERN - USE THIS
const optimizedValidator = createOptimizedSlugValidator(prisma);
const uniqueSlug = await optimizedValidator.generateUniquePostSlug(baseSlug);
```

**Implementation Steps**:
1. [ ] Delete/backup original `lib/slug-validation.ts`
2. [ ] Create new `lib/database/optimizedSlugValidator.ts`
3. [ ] Update all imports:
   - `components/editor/PostEditor.tsx`
   - `app/api/posts/route.ts`
   - `backend/src/routes/posts.ts`
4. [ ] Test with: `npm test -- --testPathPattern="slug"`
5. [ ] Load test to verify improvement

**Expected Performance Gain**:
- Before: 100 queries per slug generation (worst case)
- After: 1 query
- Improvement: **100x faster** in worst case, **5-10x typical**

---

### 2.2 Affiliate Service
**File**: `lib/affiliate-service.ts` → Replace with `lib/database/optimizedAffiliateService.ts`

**Before** (2-3 queries per operation):
```typescript
// OLD PATTERN - DO NOT USE
const post = await prisma.post.findUnique({ where: { id: postId } });
const click = await prisma.affiliateClick.create({
  data: { postId: post.id, linkUrl }
});
```

**After** (1 atomic transaction):
```typescript
// NEW PATTERN - USE THIS
const service = createOptimizedAffiliateService(prisma);
const click = await service.trackAffiliateClickOptimized(postId, linkUrl);
```

**Implementation Steps**:
1. [ ] Create new `lib/database/optimizedAffiliateService.ts`
2. [ ] Update imports in:
   - `components/blog/AffiliateTracker.tsx`
   - `app/api/affiliate/*`
   - `backend/src/routes/affiliate.ts`
3. [ ] Update function calls to use optimized versions
4. [ ] Test with: `npm test -- --testPathPattern="affiliate"`

**Expected Performance Gain**:
- Before: 2-3 sequential queries per operation
- After: 1 atomic transaction
- Improvement: **2-3x faster**, more reliable

---

### 2.3 Google OAuth Flow
**File**: `lib/auth/google-oauth.ts` → Update login flow

**Before** (2-3 queries):
```typescript
// OLD PATTERN - DO NOT USE
const user = await prisma.user.findUnique({ where: { email } });
if (user) {
  await prisma.user.update({ where: { id: user.id }, data: { googleId } });
} else {
  await prisma.user.create({ data: { email, googleId, ... } });
}
```

**After** (1 atomic upsert):
```typescript
// NEW PATTERN - USE THIS
const user = await prisma.user.upsert({
  where: { email },
  update: { googleId, lastLogin: new Date() },
  create: { email, googleId, ... }
});
```

**Implementation Steps**:
1. [ ] Update `lib/auth/google-oauth.ts` lines 209-261
2. [ ] Replace conditional update/create with upsert
3. [ ] Test OAuth flow: Sign in with Google
4. [ ] Verify token generation works correctly
5. [ ] Load test authentication endpoint

**Expected Performance Gain**:
- Before: 2-3 sequential queries per login
- After: 1 atomic operation
- Improvement: **2-3x faster**, reduced race conditions

---

### 2.4 Sitemap Generation
**File**: `app/sitemap.ts` → Parallelize queries

**Before** (4 sequential queries):
```typescript
// OLD PATTERN - DO NOT USE
const posts = await prisma.post.findMany(...);
const categories = await prisma.category.findMany(...);
const tags = await prisma.tag.findMany(...);
const users = await prisma.user.findMany(...);
```

**After** (4 parallel queries):
```typescript
// NEW PATTERN - USE THIS
const [posts, categories, tags, users] = await Promise.all([
  prisma.post.findMany(...),
  prisma.category.findMany(...),
  prisma.tag.findMany(...),
  prisma.user.findMany(...),
]);
```

**Implementation Steps**:
1. [ ] Update `app/sitemap.ts` lines 72-128
2. [ ] Wrap queries in `Promise.all()`
3. [ ] Test sitemap generation: `curl localhost:3000/sitemap.xml`
4. [ ] Verify all URLs present
5. [ ] Load test sitemap endpoint

**Expected Performance Gain**:
- Before: 4 sequential queries
- After: 4 parallel queries
- Improvement: **4x faster** (assuming similar query times)

---

### 2.5 Query Service Consolidation
**File**: Create new `lib/database/optimizedQueries.ts`

**Implementation Steps**:
1. [ ] Create `lib/database/optimizedQueries.ts` with OptimizedQueryService class
2. [ ] Update APIs to use optimized methods:
   - [x] `getPostWithRelations()` - Single query with all relations
   - [x] `getPostBySlugWithRelations()` - Blog post detail page
   - [x] `getPostsWithRelations()` - Batch load posts
   - [x] `getPostsByCategory()` - Category page
   - [x] `getSitemapData()` - Parallel queries
3. [ ] Replace individual queries with service calls
4. [ ] Test each endpoint

**Files to Update**:
- [ ] `app/api/posts/[id]/route.ts` - Use `getPostWithRelations()`
- [ ] `app/blog/[slug]/page.tsx` - Use `getPostBySlugWithRelations()`
- [ ] `app/categories/[slug]/page.tsx` - Use `getPostsByCategory()`
- [ ] `app/search/page.tsx` - Use batch loading methods
- [ ] `app/sitemap.ts` - Use `getSitemapData()`

---

## Phase 3: Verification & Testing 🧪 (MEDIUM PRIORITY)

### 3.1 Query Logging
Enable query logging in `.env`:

```bash
DATABASE_URL="postgresql://...?statement_cache_size=0"

# In development
LOG_QUERIES=true
```

### 3.2 N+1 Detection
Install and use query analyzer:

```typescript
// In development, log all queries
prisma.$use(async (params, next) => {
  const result = await next(params);
  if (process.env.LOG_QUERIES) {
    console.log(`${params.model}.${params.action}:`, params);
  }
  return result;
});
```

### 3.3 Performance Baseline Comparison
Run load tests before and after:

```bash
# Before optimization
npm run load-test:sustained
# Record P95, P99, error rate

# Apply refactoring
# Deploy new indexes

# After optimization
npm run load-test:sustained
# Compare metrics
```

**Expected Improvement**:
- ✅ P95 response time: -20% to -40%
- ✅ Database connections: -10% to -20%
- ✅ Error rate: -50% to -100% (especially for slug generation)

### 3.4 Index Performance Validation
After 1 week of production, check:

```sql
-- Find unused indexes (removing them saves memory)
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find missing indexes (query planner requests)
SELECT * FROM pg_stat_statements
WHERE query LIKE '%seq scan%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Phase 4: Post-Deployment Monitoring 📊 (LOW PRIORITY)

### 4.1 Query Performance Monitoring
Monitor these metrics:

```bash
# P95 Response Time Target
Baseline: ~600ms
Target: < 500ms (or better)

# Database Connections
Baseline: 20-25 concurrent
Target: < 20

# Query Cache Hit Rate
Baseline: 60-70%
Target: > 75%

# N+1 Detected Queries
Baseline: 15-20 per minute
Target: < 5 per minute
```

### 4.2 Production Deployment Steps
1. [ ] Deploy migration to staging
2. [ ] Test all endpoints on staging
3. [ ] Run load test on staging
4. [ ] Deploy to production during low traffic
5. [ ] Monitor application metrics for 1 hour
6. [ ] Verify no query performance degradation
7. [ ] Document any issues

### 4.3 Rollback Plan
If performance regresses:

```bash
# Rollback migration
npx prisma migrate resolve --rolled-back add_query_optimization_indexes

# Revert code changes
git revert <commit-hash>

# Restart application
npm run dev
```

---

## Summary of Changes

### Files Modified/Created:
- ✅ `prisma/migrations/add_query_optimization_indexes/migration.sql` - 30+ new indexes
- ✅ `lib/database/optimizedQueries.ts` - Refactored query service (300+ lines)
- ✅ `lib/database/optimizedSlugValidator.ts` - Batch slug validation (150+ lines)
- ✅ `lib/database/optimizedAffiliateService.ts` - Optimized affiliate tracking (200+ lines)
- ⏳ `lib/slug-validation.ts` - To be replaced
- ⏳ `lib/affiliate-service.ts` - To be updated
- ⏳ `lib/auth/google-oauth.ts` - To be updated
- ⏳ `app/sitemap.ts` - To be updated

### Expected Performance Improvements:
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Slug generation | 100 queries | 1 query | **100x** |
| Sitemap generation | 4 sequential | 4 parallel | **4x** |
| Affiliate click | 2-3 queries | 1 transaction | **2-3x** |
| OAuth login | 2-3 queries | 1 upsert | **2-3x** |
| Blog post detail | 5+ queries | 1 query | **5x** |
| P95 response time | 600ms | <500ms | **15-20%** |

### Risk Assessment:
- ✅ **Low Risk** - Migrations are additive (only adds indexes)
- ✅ **Low Risk** - New services are backward compatible
- ⚠️ **Medium Risk** - OAuth changes to transaction (test thoroughly)
- ⚠️ **Medium Risk** - Slug validation change (verify all slug generation paths)

### Testing Checklist:
- [ ] Unit tests for optimized services
- [ ] Integration tests for each endpoint
- [ ] Load test with 2,000 concurrent users
- [ ] Verify no N+1 queries (query logging)
- [ ] Check index usage stats
- [ ] Monitor P95/P99 response times
- [ ] Verify OAuth flow works correctly
- [ ] Test slug generation for edge cases

---

## Timeline

| Phase | Task | Duration | Priority |
|-------|------|----------|----------|
| 1 | Deploy indexes | 30 min | CRITICAL |
| 2.1 | Slug validation refactor | 2 hours | CRITICAL |
| 2.2 | Affiliate service refactor | 1.5 hours | HIGH |
| 2.3 | OAuth flow update | 1 hour | HIGH |
| 2.4 | Sitemap parallel queries | 30 min | MEDIUM |
| 2.5 | Query service consolidation | 2 hours | MEDIUM |
| 3 | Verification & testing | 3 hours | MEDIUM |
| 4 | Monitoring setup | 1 hour | LOW |

**Total Estimated Time**: ~11 hours
**Recommended Approach**: Deploy in phases over 2-3 days with testing between phases

---

## Key Metrics to Track

After implementation, monitor these metrics:

```bash
# Database metrics
- Connection pool utilization (should decrease)
- Query execution time (P95, P99)
- Cache hit rate
- Slow query log entries

# Application metrics
- Response time (P95, P99)
- Error rate
- Memory usage
- CPU usage

# Business metrics
- Page load time
- User session length
- Bounce rate
- Search success rate
```

---

## Questions & Support

For questions during implementation:
1. Check `docs/DATABASE.md` for schema details
2. Review `docs/PERFORMANCE_MONITORING_SETUP.md`
3. Check load testing results with `npm run load-test:analyze`
4. Query the optimization service documentation

---

## Completion Checklist

- [ ] All migrations deployed
- [ ] All code refactored
- [ ] All tests passing
- [ ] Load test improvement verified
- [ ] No N+1 queries detected
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team notified of changes
