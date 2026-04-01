-- Optimize popular posts queries by indexing the post views count column.
-- Supports both camelCase and snake_case column naming to keep migration robust.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'views_count'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posts_views_count_desc ON posts (views_count DESC)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'viewCount'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posts_viewcount_desc ON posts ("viewCount" DESC)';
  END IF;
END $$;
