import { Metadata } from 'next';
import { authorSchemaIdForSlug } from '@/lib/author-schema';

interface MetadataParams {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;
  structuredData?: Record<string, any>;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
}

const siteConfig = {
  name: 'The Corporate Blog',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  description: 'Production-grade, SEO-first blogging platform delivering insights on technology, business, and innovation.',
  author: 'The Corporate Blog Team',
  twitter: '@thecorporateblog',
  locale: 'en_US',
  type: 'website',
};

export function generateMetadata(params: MetadataParams): Metadata {
  const {
    title,
    description,
    canonical,
    ogImage,
    keywords = [],
    noIndex = false,
    publishedTime,
    modifiedTime,
    authors = [siteConfig.author],
    section,
    tags = [],
  } = params;

  const url = canonical ? `${siteConfig.url}${canonical}` : siteConfig.url;
  const image = ogImage || `${siteConfig.url}/og-default.jpg`;

  // Enhanced keywords with default SEO terms
  const allKeywords = [
    ...keywords,
    'blog',
    'articles',
    'technology',
    'business',
    'innovation',
    'corporate',
    'insights',
    'industry analysis',
    'professional development',
  ];

  return {
    title: {
      default: title,
      template: `%s | ${siteConfig.name}`,
    },
    description,
    keywords: allKeywords,
    authors: authors.map(name => ({ name })),
    creator: siteConfig.author,
    publisher: siteConfig.name,
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: url,
      types: {
        'application/rss+xml': [
          { url: '/feed.xml', title: `${siteConfig.name} RSS Feed` },
        ],
      },
    },
    openGraph: {
      type: publishedTime ? 'article' : 'website',
      url,
      title,
      description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
          type: 'image/jpeg',
        },
      ],
      ...(publishedTime && {
        publishedTime,
        modifiedTime: modifiedTime || publishedTime,
        authors: authors,
        section,
        tags,
      }),
    },
    twitter: {
      card: 'summary_large_image',
      site: siteConfig.twitter,
      creator: siteConfig.twitter,
      title,
      description,
      images: [
        {
          url: image,
          alt: title,
        },
      ],
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
      yahoo: process.env.NEXT_PUBLIC_YAHOO_VERIFICATION,
    },
    category: section || 'technology',
    classification: 'Business Blog',
    referrer: 'origin-when-cross-origin',
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      ],
      shortcut: [{ url: '/favicon.ico' }],
      apple: [
        { url: '/apple-icon-180.png', sizes: '180x180', type: 'image/png' },
      ],
      other: [
        {
          rel: 'apple-touch-icon-precomposed',
          url: '/apple-touch-icon-precomposed.png',
        },
      ],
    },
    appleWebApp: {
      title: siteConfig.name,
      statusBarStyle: 'default',
      capable: true,
    },
    formatDetection: {
      telephone: false,
    },
    other: {
      'msapplication-TileColor': '#0ea5e9',
      'msapplication-config': '/browserconfig.xml',
    },
  };
}

export function generateStructuredData(type: string, data: any) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Article':
      return {
        ...baseData,
        headline: data.title,
        description: data.description || data.excerpt,
        image: data.featuredImage ? [data.featuredImage] : undefined,
        author: {
          '@type': 'Person',
          '@id': data.author?.slug ? authorSchemaIdForSlug(data.author.slug) : undefined,
          name: data.author.name,
          url: data.author.url || `${siteConfig.url}/authors/${data.author.slug}`,
        },
        publisher: {
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
          logo: {
            '@type': 'ImageObject',
            url: `${siteConfig.url}/logo.png`,
            width: 512,
            height: 512,
          },
        },
        datePublished: data.publishedAt,
        dateModified: data.updatedAt || data.publishedAt,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${siteConfig.url}/blog/${data.slug}`,
        },
        articleSection: data.category?.name,
        keywords: data.tags?.join(', '),
        wordCount: data.wordCount,
        timeRequired: `PT${data.readingTime}M`,
        inLanguage: 'en-US',
      };

    case 'BreadcrumbList':
      return {
        ...baseData,
        itemListElement: data.items.map((item: any, index: number) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: `${siteConfig.url}${item.url}`,
        })),
      };

    case 'Organization':
      return {
        ...baseData,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/logo.png`,
        description: siteConfig.description,
        sameAs: [
          `https://twitter.com/${siteConfig.twitter.replace('@', '')}`,
          `${siteConfig.url}/feed.xml`,
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Editorial',
          email: 'editorial@thecorporateblog.com',
        },
        foundingDate: '2024',
        founders: [
          {
            '@type': 'Person',
            name: 'The Corporate Blog Team',
          },
        ],
      };

    case 'WebSite':
      return {
        ...baseData,
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        inLanguage: 'en-US',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
        publisher: {
          '@type': 'Organization',
          name: siteConfig.name,
          logo: `${siteConfig.url}/logo.png`,
        },
      };

    case 'FAQ':
      return {
        ...baseData,
        '@type': 'FAQPage',
        mainEntity: data.questions.map((q: any) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answer,
          },
        })),
      };

    default:
      return baseData;
  }
}

// SEO utility functions
export const seoUtils = {
  // Generate meta tags for JSON-LD
  createJsonLd: (data: any): string => {
    return JSON.stringify(data, null, 0);
  },

  // Generate canonical URL
  getCanonicalUrl: (path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${siteConfig.url}${cleanPath}`;
  },

  // Generate OpenGraph image URL
  getOgImageUrl: (title: string, category?: string): string => {
    const params = new URLSearchParams({
      title,
      ...(category && { category }),
    });
    return `${siteConfig.url}/api/og?${params.toString()}`;
  },

  // Truncate description to optimal length
  truncateDescription: (text: string, maxLength: number = 160): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3).trim() + '...';
  },

  // Generate reading time estimate
  calculateReadingTime: (content: string): number => {
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  },

  // Extract keywords from content
  extractKeywords: (content: string, limit: number = 10): string[] => {
    // Simple keyword extraction - can be enhanced with NLP libraries
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const frequency: { [key: string]: number } = {};
    
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([word]) => word);
  },
};