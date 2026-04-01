-- Weighted full-text search index for backend /api/search
-- Priority: Title (A) > Headings (B) > Content (C)

-- Extract heading text (<h1>-<h6>) as a plain-text string.
CREATE OR REPLACE FUNCTION tcb_extract_headings_text(html text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    string_agg(regexp_replace(match[1], '<[^>]+>', ' ', 'g'), ' '),
    ''
  )
  FROM regexp_matches(COALESCE(html, ''), '<h[1-6][^>]*>(.*?)</h[1-6]>', 'gis') AS match;
$$;

-- Extract non-heading body text to avoid double-counting heading matches.
CREATE OR REPLACE FUNCTION tcb_extract_body_text(html text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        COALESCE(html, ''),
        '<h[1-6][^>]*>.*?</h[1-6]>',
        ' ',
        'gis'
      ),
      '<[^>]+>',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  );
$$;

CREATE INDEX IF NOT EXISTS idx_posts_weighted_search_tsv
  ON posts
  USING GIN (
    (
      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('english', tcb_extract_headings_text(COALESCE("contentHtml", ''))), 'B') ||
      setweight(to_tsvector('english', tcb_extract_body_text(COALESCE("contentHtml", ''))), 'C')
    )
  );

-- Complementary filter/sort index for published-window searches.
CREATE INDEX IF NOT EXISTS idx_posts_status_publishedat_search
  ON posts (status, "publishedAt" DESC);
