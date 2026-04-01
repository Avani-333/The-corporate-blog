const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecorporateblog.com';

export function authorSchemaIdForSlug(authorSlug: string): string {
  return `${SITE_URL}/authors/${authorSlug}#person`;
}
