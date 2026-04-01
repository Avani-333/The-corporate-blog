/**
 * PostAuthorSchema
 *
 * Server Component — emits a standalone Person JSON-LD node for author
 * E-E-A-T signals and ties it to Article.author via @id.
 */

import { authorSchemaIdForSlug } from '@/lib/author-schema';

interface PostAuthorSchemaProps {
  authorName: string;
  authorSlug: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecorporateblog.com';

export function PostAuthorSchema({ authorName, authorSlug }: PostAuthorSchemaProps) {
  if (!authorName || !authorSlug) return null;

  const authorUrl = `${SITE_URL}/authors/${authorSlug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': authorSchemaIdForSlug(authorSlug),
    name: authorName,
    url: authorUrl,
    description: `${authorName} is a contributor at The Corporate Blog, covering business and technology topics.`,
    worksFor: {
      '@type': 'Organization',
      name: 'The Corporate Blog',
      url: SITE_URL,
    },
    knowsAbout: ['Business', 'Technology', 'Leadership', 'Digital Strategy'],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
