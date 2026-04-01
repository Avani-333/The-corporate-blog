-- AlterTable: Add soft delete and audit fields to User
ALTER TABLE "users" 
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

-- Add indexes for soft delete queries
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- AlterTable: Add soft delete and publishing audit fields to Post
ALTER TABLE "posts"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "publishedBy" TEXT,
ADD COLUMN "editedBy" TEXT,
ADD COLUMN "publishedAt_audit" TIMESTAMP(3);

-- Validate title length
ALTER TABLE "posts"
ADD CONSTRAINT "posts_title_length" CHECK (length("title") > 0 AND length("title") <= 255),
ADD CONSTRAINT "posts_slug_length" CHECK (length("slug") > 0),
ADD CONSTRAINT "posts_seoTitle_length" CHECK ("seoTitle" IS NULL OR length("seoTitle") <= 60),
ADD CONSTRAINT "posts_metaDescription_length" CHECK ("metaDescription" IS NULL OR length("metaDescription") <= 160);

-- Add indexes for soft delete and audit queries
CREATE INDEX "posts_deletedAt_idx" ON "posts"("deletedAt");
CREATE INDEX "posts_publishedBy_idx" ON "posts"("publishedBy");
CREATE INDEX "posts_editedBy_idx" ON "posts"("editedBy");

-- Rename and enhance audit logs table
-- First, create new enhanced audit_logs table
CREATE TABLE "audit_logs_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" VARCHAR(255) NOT NULL,
  "userId" TEXT,
  "targetUserId" TEXT,
  "publishedBy" TEXT,
  "publishDetails" JSONB,
  "editDetails" JSONB,
  "oldData" JSONB,
  "newData" JSONB,
  "changedFields" TEXT[],
  "ipAddress" VARCHAR(45),
  "userAgent" TEXT,
  "requestId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL,
  FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Copy data from old audit_logs table if it exists
INSERT INTO "audit_logs_new" ("id", "action", "entity", "entityId", "userId", "oldData", "newData", "ipAddress", "userAgent", "createdAt")
SELECT "id", "action", "entity", "entityId", "userId", "oldData", "newData", "ipAddress", "userAgent", "createdAt"
FROM "audit_logs";

-- Drop old table
DROP TABLE "audit_logs";

-- Rename new table
ALTER TABLE "audit_logs_new" RENAME TO "audit_logs";

-- Create indexes for performance
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_entity_action_createdAt_idx" ON "audit_logs"("entity", "action", "createdAt");
CREATE INDEX "audit_logs_entityId_action_idx" ON "audit_logs"("entityId", "action");
CREATE INDEX "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");

-- Add database constraints for data validation

-- User constraints
ALTER TABLE "users"
ADD CONSTRAINT "users_email_not_empty" CHECK (length(email) > 0),
ADD CONSTRAINT "users_email_valid" CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
ADD CONSTRAINT "users_username_length" CHECK ("username" IS NULL OR (length("username") > 2 AND length("username") <= 50)),
ADD CONSTRAINT "users_password_not_empty" CHECK (length(password) > 0);

-- Post content validation
ALTER TABLE "posts"
ADD CONSTRAINT "posts_publishedAt_consistency" CHECK (
  CASE 
    WHEN status = 'PUBLISHED' THEN "publishedAt" IS NOT NULL
    ELSE true
  END
);

-- Ensure deletedAt is not in future
ALTER TABLE "users"
ADD CONSTRAINT "users_deletedAt_not_future" CHECK ("deletedAt" IS NULL OR "deletedAt" <= CURRENT_TIMESTAMP);

ALTER TABLE "posts"
ADD CONSTRAINT "posts_deletedAt_not_future" CHECK ("deletedAt" IS NULL OR "deletedAt" <= CURRENT_TIMESTAMP);

-- Ensure post timestamps are consistent
ALTER TABLE "posts"
ADD CONSTRAINT "posts_timestamps_consistent" CHECK (
  CASE
    WHEN "publishedAt" IS NOT NULL AND "scheduledAt" IS NOT NULL 
    THEN "scheduledAt" <= "publishedAt"
    ELSE true
  END
);

-- Ensure positive counts
ALTER TABLE "posts"
ADD CONSTRAINT "posts_viewCount_positive" CHECK ("viewCount" >= 0),
ADD CONSTRAINT "posts_likeCount_positive" CHECK ("likeCount" >= 0),
ADD CONSTRAINT "posts_commentCount_positive" CHECK ("commentCount" >= 0),
ADD CONSTRAINT "posts_shareCount_positive" CHECK ("shareCount" >= 0),
ADD CONSTRAINT "posts_wordCount_positive" CHECK ("wordCount" IS NULL OR "wordCount" > 0),
ADD CONSTRAINT "posts_readingTime_positive" CHECK ("readingTime" IS NULL OR "readingTime" > 0);

-- Create view for active users (not deleted)
CREATE VIEW IF NOT EXISTS active_users AS
SELECT * FROM "users"
WHERE "deletedAt" IS NULL;

-- Create view for active posts (not deleted and published)
CREATE VIEW IF NOT EXISTS published_posts AS
SELECT * FROM "posts"
WHERE "deletedAt" IS NULL 
  AND status = 'PUBLISHED'
  AND "publishedAt" IS NOT NULL
  AND "publishedAt" <= CURRENT_TIMESTAMP;

-- Create view for audit trail of a specific post
CREATE VIEW IF NOT EXISTS post_audit_trail AS
SELECT 
  al."id",
  al."action",
  al."entity",
  al."entityId",
  u."username" as "performedBy",
  u."email" as "performedByEmail",
  al."publishDetails",
  al."editDetails",
  al."oldData",
  al."newData",
  al."changedFields",
  al."ipAddress",
  al."createdAt"
FROM "audit_logs" al
LEFT JOIN "users" u ON al."userId" = u."id"
WHERE al."entity" = 'POST'
ORDER BY al."createdAt" DESC;

-- Create stored procedures/functions for audit logging

-- Function to log post edits
CREATE OR REPLACE FUNCTION log_post_edit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "audit_logs" (
    "id", "action", "entity", "entityId", "userId", 
    "oldData", "newData", "changedFields", "status", "createdAt"
  ) VALUES (
    gen_random_uuid()::text,
    'UPDATE',
    'POST',
    NEW."id",
    CURRENT_USER,
    to_jsonb(OLD),
    to_jsonb(NEW),
    ARRAY(
      SELECT column_name 
      FROM (SELECT (each(to_jsonb(NEW))).* AS key, (each(to_jsonb(OLD))).* AS old_key) t 
      WHERE key.value::text IS DISTINCT FROM old_key.value::text
    ),
    'SUCCESS',
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent editing deleted records
CREATE OR REPLACE FUNCTION prevent_deleted_record_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."deletedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify a deleted record: % %', TG_TABLE_NAME, OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (optional - activate if using PostgreSQL triggers for audit)
-- CREATE TRIGGER post_edit_trigger AFTER UPDATE ON "posts"
-- FOR EACH ROW EXECUTE FUNCTION log_post_edit();

-- Comment out triggers by default as they should be handled in application code
-- This is more flexible and maintains consistency with Prisma ORM

-- Summary of constraints and validations added:
-- 1. Soft delete: deletedAt, deletedBy columns on User and Post
-- 2. Publishing audit: publishedBy, editedBy, publishedAt_audit on Post  
-- 3. data length constraints: title, seoTitle, metaDescription on Post
-- 4. Email validation: email format check on User
-- 5. Username constraints: length check on User
-- 6. Positive counts: viewCount, likeCount, etc. on Post
-- 7. Status consistency: publishedAt required when status=PUBLISHED
-- 8. Timestamp consistency: publishedAt >= scheduledAt
-- 9. Future date prevention: deletedAt cannot be in future
-- 10. Views: active_users, published_posts, post_audit_trail for easier querying
