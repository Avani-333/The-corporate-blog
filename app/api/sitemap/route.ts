/**
 * GET /api/sitemap
 *
 * Dynamic sitemap XML endpoint.
 * Serves as an alternative to the Next.js sitemap.ts for direct XML access.
 *
 * IMPORTANT: Only PUBLISHED posts are included in the sitemap.
 * DRAFT, SCHEDULED, ARCHIVED, and PENDING_REVIEW posts are NEVER included.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPublishedPostsWhere } from '@/lib/database';

export const revalidate = 3600; // Revalidate every hour

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    // ========================================================================
    // FETCH ONLY PUBLISHED POSTS
    // getPublishedPostsWhere() ensures:
    //   - status = 'PUBLISHED'
    //   - publishedAt <= now (not scheduled for the future)
    // ========================================================================
    const posts = await prisma.post.findMany({
      where: getPublishedPostsWhere(),
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    // Fetch visible categories
    const categories = await prisma.category.findMany({
      where: { isVisible: true },
      select: { slug: true, updatedAt: true },
    });

    // Fetch tags with published posts
    const tags = await prisma.tag.findMany({
      where: {
        posts: {
          some: {
            post: getPublishedPostsWhere(),
          },
        },
      },
      select: { slug: true, updatedAt: true },
    });

    // Fetch authors with published posts
    const authors = await prisma.user.findMany({
      where: {
        posts: {
          some: getPublishedPostsWhere(),
        },
      },
      select: { username: true, updatedAt: true },
    });

    // Build XML
    const xml = generateSitemapXml(baseUrl, posts, categories, tags, authors);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);

    // Return minimal sitemap on error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

    return new NextResponse(fallbackXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}

// ============================================================================
// XML GENERATOR
// ============================================================================

interface PostEntry {
  slug: string;
  updatedAt: Date | null;
  publishedAt: Date | null;
}

interface CategoryEntry {
  slug: string;
  updatedAt: Date | null;
}

interface TagEntry {
  slug: string;
  updatedAt: Date | null;
}

interface AuthorEntry {
  username: string | null;
  updatedAt: Date | null;
}

function generateSitemapXml(
  baseUrl: string,
  posts: PostEntry[],
  categories: CategoryEntry[],
  tags: TagEntry[],
  authors: AuthorEntry[]
): string {
  const now = new Date().toISOString();

  const staticUrls = [
    { loc: baseUrl, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/blog`, changefreq: 'daily', priority: '0.9' },
    { loc: `${baseUrl}/categories`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/about`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/contact`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${baseUrl}/newsletter`, changefreq: 'monthly', priority: '0.7' },
  ];

  const urlEntries: string[] = [];

  // Static pages
  for (const page of staticUrls) {
    urlEntries.push(`
  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Published posts only
  for (const post of posts) {
    const lastmod = (post.updatedAt || post.publishedAt || new Date()).toISOString();
    urlEntries.push(`
  <url>
    <loc>${escapeXml(`${baseUrl}/blog/${post.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  // Categories
  for (const cat of categories) {
    const lastmod = (cat.updatedAt || new Date()).toISOString();
    urlEntries.push(`
  <url>
    <loc>${escapeXml(`${baseUrl}/categories/${cat.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  // Tags
  for (const tag of tags) {
    const lastmod = (tag.updatedAt || new Date()).toISOString();
    urlEntries.push(`
  <url>
    <loc>${escapeXml(`${baseUrl}/tags/${tag.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  // Authors
  for (const author of authors) {
    if (!author.username) continue;
    const lastmod = (author.updatedAt || new Date()).toISOString();
    urlEntries.push(`
  <url>
    <loc>${escapeXml(`${baseUrl}/authors/${author.username}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries.join('')}
</urlset>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
