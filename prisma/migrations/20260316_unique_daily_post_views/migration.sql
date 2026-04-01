-- Add unique daily post view tracking based on IP + UA hash.
-- This migration assumes post_views may already exist.

ALTER TABLE post_views
  ADD COLUMN IF NOT EXISTS "ipUaHash" TEXT;

ALTER TABLE post_views
  ADD COLUMN IF NOT EXISTS "viewedOn" DATE;

-- Backfill legacy rows to satisfy new NOT NULL constraints.
UPDATE post_views
SET
  "ipUaHash" = COALESCE("ipUaHash", md5(COALESCE("ipAddress", '') || '|' || COALESCE("userAgent", ''))),
  "viewedOn" = COALESCE("viewedOn", date_trunc('day', "createdAt")::date)
WHERE "ipUaHash" IS NULL OR "viewedOn" IS NULL;

ALTER TABLE post_views
  ALTER COLUMN "ipUaHash" SET NOT NULL;

ALTER TABLE post_views
  ALTER COLUMN "viewedOn" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS post_views_post_ipuahash_viewedon_key
  ON post_views ("postId", "ipUaHash", "viewedOn");

CREATE INDEX IF NOT EXISTS idx_post_views_post_viewed_on
  ON post_views ("postId", "viewedOn");
