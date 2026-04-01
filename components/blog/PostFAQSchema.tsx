/**
 * PostFAQSchema
 *
 * Server Component — renders a FAQPage JSON-LD <script> when the post
 * contains at least one FAQ block with valid Q/A pairs.
 *
 * It first checks for a precomputed schema stored by the CMS service under
 * `content.metadata.structuredData.faq`, and falls back to deriving the
 * schema from raw block content at render time.
 *
 * Usage:
 *   <PostFAQSchema content={post.content} />
 *
 * Renders nothing when there are no FAQ items.
 */

import {
  extractFAQItemsFromContent,
  buildFAQStructuredData,
} from '@/lib/faq-structured-data';

interface PostFAQSchemaProps {
  /** The block-content JSON stored on the post record (`post.content`). */
  content?: any;
}

export function PostFAQSchema({ content }: PostFAQSchemaProps) {
  if (!content) return null;

  // Prefer the precomputed schema the CMS service stored during save.
  const precomputed = content?.metadata?.structuredData?.faq;
  if (
    precomputed &&
    typeof precomputed === 'object' &&
    precomputed['@type'] === 'FAQPage' &&
    Array.isArray(precomputed.mainEntity) &&
    precomputed.mainEntity.length > 0
  ) {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(precomputed) }}
      />
    );
  }

  // Fall back to deriving from raw blocks (e.g. content saved before the
  // precomputation step was added, or content that bypassed the CMS service).
  const items = extractFAQItemsFromContent(content).filter(
    (item) => item.question.trim() && item.answer.trim(),
  );
  if (items.length === 0) return null;

  const schema = buildFAQStructuredData(items);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
