import { MetadataRoute } from 'next';

export const revalidate = 3600;

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Admin & CMS routes
          '/admin/',
          '/dashboard/',

          // Authentication routes
          '/auth/',

          // API endpoints
          '/api/',

          // User private pages
          '/profile/',
          '/settings/',

          // Internal / dev
          '/private/',
          '/_next/',
          '/drafts/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}