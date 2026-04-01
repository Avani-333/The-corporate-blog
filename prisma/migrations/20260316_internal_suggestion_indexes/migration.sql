-- Internal suggestions query optimization
-- Supports:
-- 1) Published post filtering
-- 2) Shared category/tag overlap joins
-- 3) Basic tsvector keyword overlap ranking

-- Fast filtering for published candidates ordered by recency.
CREATE INDEX IF NOT EXISTS idx_posts_status_publishedat
  ON posts (status, "publishedAt" DESC);

-- Fast category overlap joins for suggestion candidates.
CREATE INDEX IF NOT EXISTS idx_post_categories_category_post
  ON post_categories ("categoryId", "postId");

CREATE INDEX IF NOT EXISTS idx_post_categories_post_category
  ON post_categories ("postId", "categoryId");

-- Fast tag overlap joins for suggestion candidates.
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_post
  ON post_tags ("tagId", "postId");

CREATE INDEX IF NOT EXISTS idx_post_tags_post_tag
  ON post_tags ("postId", "tagId");

-- Full-text index for basic keyword overlap ranking (title + excerpt + metaDescription).
CREATE INDEX IF NOT EXISTS idx_posts_internal_suggestions_tsv
  ON posts
  USING GIN (
    to_tsvector(
      'english',
      COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE("metaDescription", '')
    )
  );
