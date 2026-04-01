-- Database Optimization Migration
-- Add missing indexes and optimize query patterns

-- =============================================================================
-- 1. MISSING INDEXES ON FREQUENTLY QUERIED FIELDS
-- =============================================================================

-- Posts: slug is frequently searched in API routes, page lookups, sitemap
CREATE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts"("slug");

-- Categories and Tags: slug lookups in routing and filtering
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags"("slug");

-- User authentication: googleId lookups in OAuth flow
CREATE INDEX IF NOT EXISTS "users_googleId_idx" ON "users"("googleId");

-- =============================================================================
-- 2. COMPOUND INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================

-- Posts: Most common filter + order pattern (status, publishedAt, createdAt)
-- Already exists: @@index([status, publishedAt])
-- Add additional useful combinations:
CREATE INDEX IF NOT EXISTS "posts_deletedAt_publishedAt_idx" 
  ON "posts"("deletedAt", "publishedAt") 
  WHERE "deletedAt" IS NULL;  -- Include only non-deleted

-- Posts: Listing by author with pagination
CREATE INDEX IF NOT EXISTS "posts_authorId_publishedAt_idx" 
  ON "posts"("authorId", "publishedAt" DESC);

-- Posts: Status transitions - useful for drafts, scheduled posts
CREATE INDEX IF NOT EXISTS "posts_status_scheduledAt_idx" 
  ON "posts"("status", "scheduledAt");

-- Posts: View count sorting (for trending/popular)
CREATE INDEX IF NOT EXISTS "posts_viewCount_publishedAt_idx" 
  ON "posts"("viewCount" DESC, "publishedAt" DESC);

-- Posts: Sponsored posts lookup with affiliate tracking
CREATE INDEX IF NOT EXISTS "posts_isSponsor_affiliateLink_idx" 
  ON "posts"("is_sponsored", "affiliateLinkVia" DESC);

-- Users: Username lookup (for profile pages, author presence checks)
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");

-- RefreshTokens: Common lookup patterns for auth
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_isRevoked_idx" 
  ON "refresh_tokens"("userId", "isRevoked");

-- RefreshTokens: Cleanup queries for expired tokens
CREATE INDEX IF NOT EXISTS "refresh_tokens_expiresAt_isRevoked_idx" 
  ON "refresh_tokens"("expiresAt", "isRevoked");

-- =============================================================================
-- 3. JUNCTION TABLE INDEXES (PostTag, PostCategory)
-- =============================================================================

-- PostTag: Query all tags for a post (common in post detail load)
CREATE INDEX IF NOT EXISTS "post_tags_postId_idx" ON "post_tags"("postId");

-- PostTag: Query all posts with a specific tag (tag archive page)
CREATE INDEX IF NOT EXISTS "post_tags_tagId_idx" ON "post_tags"("tagId");

-- PostCategory: Query all categories for a post
CREATE INDEX IF NOT EXISTS "post_categories_postId_idx" ON "post_categories"("postId");

-- PostCategory: Query all posts in a category (category page)
CREATE INDEX IF NOT EXISTS "post_categories_categoryId_idx" ON "post_categories"("categoryId");

-- PostCategory: Useful for: which posts are in multiple categories
CREATE INDEX IF NOT EXISTS "post_categories_categoryId_postId_idx" 
  ON "post_categories"("categoryId", "postId");

-- =============================================================================
-- 4. ANALYTICS & ENGAGEMENT INDEXES
-- =============================================================================

-- PostView: Track views for analytics (date range queries)
CREATE INDEX IF NOT EXISTS "post_views_viewedOn_idx" ON "post_views"("viewedOn");

-- PostView: User analytics - which posts did user view
CREATE INDEX IF NOT EXISTS "post_views_userId_idx" ON "post_views"("userId");

-- PostView: Post analytics - who viewed this post
CREATE INDEX IF NOT EXISTS "post_views_postId_viewedOn_idx" 
  ON "post_views"("postId", "viewedOn" DESC);

-- PostLike: Track user likes for deduplication
CREATE INDEX IF NOT EXISTS "post_likes_userId_postId_idx" 
  ON "post_likes"("userId", "postId");

-- PostLike: Count likes per post
CREATE INDEX IF NOT EXISTS "post_likes_postId_idx" ON "post_likes"("postId");

-- Comment: Filter by post and status (for listing approved comments)
CREATE INDEX IF NOT EXISTS "comments_postId_status_idx" 
  ON "comments"("postId", "status") 
  WHERE "status" = 'PUBLISHED';  -- Partial index for published only

-- Comment: Filter by author
CREATE INDEX IF NOT EXISTS "comments_userId_idx" ON "comments"("userId");

-- AffiliateClick: Track affiliate conversions by post
CREATE INDEX IF NOT EXISTS "affiliate_clicks_postId_idx" ON "affiliate_clicks"("postId");

-- AffiliateClick: Time-based reporting (conversion trends)
CREATE INDEX IF NOT EXISTS "affiliate_clicks_createdAt_idx" ON "affiliate_clicks"("createdAt" DESC);

-- =============================================================================
-- 5. AUDIT & SECURITY INDEXES (from soft delete migration)
-- =============================================================================
-- These are important for audit log queries and compliance reporting

-- AuditLog: Query by entity type and ID (most common query pattern)
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entityId_idx" 
  ON "audit_logs"("entity", "entityId") 
  WHERE "status" = 'SUCCESS';  -- Partial index for successful operations

-- AuditLog: User activity tracking
CREATE INDEX IF NOT EXISTS "audit_logs_userId_createdAt_idx" 
  ON "audit_logs"("userId", "createdAt" DESC);

-- AuditLog: Target user tracking (who was affected)
CREATE INDEX IF NOT EXISTS "audit_logs_targetUserId_idx" 
  ON "audit_logs"("targetUserId");

-- AuditLog: Action type queries
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" 
  ON "audit_logs"("action", "createdAt" DESC);

-- AuditLog: Time-based reporting
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- =============================================================================
-- 6. FULL-TEXT SEARCH INDEXES (for internal suggestions, search features)
-- =============================================================================

-- Post content search (for search functionality)
CREATE INDEX IF NOT EXISTS "posts_title_gin_idx" 
  ON "posts" USING GIN(to_tsvector('english', "title"));

-- Post excerpt search
CREATE INDEX IF NOT EXISTS "posts_excerpt_gin_idx" 
  ON "posts" USING GIN(to_tsvector('english', COALESCE("excerpt", '')));

-- Post SEO metadata search
CREATE INDEX IF NOT EXISTS "posts_seoTitle_gin_idx" 
  ON "posts" USING GIN(to_tsvector('english', COALESCE("seoTitle", '')));

-- =============================================================================
-- 7. PARTIAL INDEXES (for soft-deleted record filtering)
-- =============================================================================

-- Optimize "show only active posts" queries
CREATE INDEX IF NOT EXISTS "posts_active_publishedAt_idx" 
  ON "posts"("publishedAt" DESC) 
  WHERE "deletedAt" IS NULL AND "status" = 'PUBLISHED';

-- Optimize "show only active users" queries
CREATE INDEX IF NOT EXISTS "users_active_idx" 
  ON "users"("createdAt" DESC) 
  WHERE "deletedAt" IS NULL;

-- Optimize "show only active categories"
CREATE INDEX IF NOT EXISTS "categories_visible_idx" 
  ON "categories"("name") 
  WHERE "isVisible" = true;

-- =============================================================================
-- 8. STATISTICS & MAINTENANCE
-- =============================================================================

-- Analyze tables to ensure query planner has accurate statistics
ANALYZE "posts";
ANALYZE "users";
ANALYZE "post_views";
ANALYZE "post_likes";
ANALYZE "comments";
ANALYZE "audit_logs";
ANALYZE "categories";
ANALYZE "tags";
ANALYZE "post_categories";
ANALYZE "post_tags";

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check all indexes created:
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;

-- Check for duplicate indexes:
-- SELECT * FROM pg_stat_user_indexes 
-- ORDER BY schemaname, tablename;

-- Check index usage (identify unused indexes that can be removed):
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- ORDER BY pg_relation_size(indexrelid) DESC;
