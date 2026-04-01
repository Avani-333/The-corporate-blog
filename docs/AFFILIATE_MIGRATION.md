# Affiliate System - Database Migration

## Prerequisites

Ensure you have already updated `prisma/schema.prisma` with:
- `is_sponsored` field on Post model
- `affiliateLinkVia` field on Post model  
- New `AffiliateClick` model
- New relation on User model

## Apply Migration

```bash
# 1. Generate Prisma Client with updated schema
npm run db:generate

# 2. Apply schema changes to database
npm run db:push

# 3. Verify migration (optional - connects to DB and checks)
npm run migrate:status
```

## What Gets Created

### New Table: `affiliate_clicks`

```sql
CREATE TABLE affiliate_clicks (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  post_slug TEXT NOT NULL,
  referrer TEXT,
  ip_address TEXT,
  user_agent TEXT,
  country_code TEXT,
  device_type TEXT,
  user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX (post_id),
  INDEX (post_slug),
  INDEX (user_id),
  INDEX (created_at),
  INDEX (post_id, created_at)
);
```

### Updated Table: `posts`

New columns added:
- `is_sponsored BOOLEAN DEFAULT false`
- `affiliate_link_via TEXT`

## Manual Migration (If Using External Tool)

If you're using an external migration tool instead of Prisma:

```sql
-- Add columns to posts table
ALTER TABLE posts
ADD COLUMN is_sponsored BOOLEAN DEFAULT false,
ADD COLUMN affiliate_link_via TEXT;

-- Create affiliate_clicks table
CREATE TABLE affiliate_clicks (
  id VARCHAR(255) PRIMARY KEY,
  post_id VARCHAR(255) NOT NULL,
  post_slug VARCHAR(255) NOT NULL,
  referrer TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  country_code VARCHAR(2),
  device_type VARCHAR(20),
  user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_post_id (post_id),
  INDEX idx_post_slug (post_slug),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_post_created (post_id, created_at)
);
```

## Rollback (If Needed)

```bash
npm run migrate:rollback
```

Or manually drop:
```sql
DROP TABLE affiliate_clicks;
ALTER TABLE posts DROP COLUMN is_sponsored;
ALTER TABLE posts DROP COLUMN affiliate_link_via;
```

## Verification

To verify migration was successful:

```bash
# Check if tables exist
psql $DATABASE_URL -c "\dt affiliate_clicks"
psql $DATABASE_URL -c "\d posts" | grep -E "(is_sponsored|affiliate)"

# Or use Prisma Studio
npm run db:studio
```

## Troubleshooting

### "Error: Foreign key constraint fails"
- Ensure `posts` table exists first
- Check all parent tables are accessible

### "Error: Column already exists"
- Schema might already be partially applied
- Check actual database schema vs schema.prisma

### "Connection refused"
- Verify DATABASE_URL is correct
- Check database server is running
- Check VPN/network connectivity if using remote DB

## Next Steps

1. ✅ Migration applied
2. Generate index on posts.slug if not exists: `CREATE INDEX idx_posts_slug ON posts(slug);`
3. Deploy to production (use `npm run db:deploy` for Railway/similar)
4. Start using the API endpoints
5. Begin tracking affiliate clicks

## Deployment Checklist

- [ ] Schema updated with new fields
- [ ] Migration applied to development
- [ ] API endpoints tested locally
- [ ] Components integrated into blog
- [ ] Migration applied to staging
- [ ] Full testing in staging environment
- [ ] Migration applied to production
- [ ] Monitor for any issues
- [ ] Enable statistics tracking in admin

---

For more info, see [AFFILIATE_SYSTEM.md](./AFFILIATE_SYSTEM.md)
