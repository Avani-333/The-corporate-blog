import { NextSeoProps } from 'next-seo';
import { type Post, type Category, type User } from '@prisma/client';

// ============================================================================
// SEO METADATA TYPES & INTERFACES
// ============================================================================

export interface SEOMetadata {
  // Basic Meta Tags
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  
  // Open Graph
  openGraph: {
    title: string;
    description: string;
    type: 'website' | 'article' | 'profile' | 'book';
    url: string;
    siteName: string;
    images: OpenGraphImage[];
    locale?: string;
    alternateLocales?: string[];
  };
  
  // Twitter Cards
  twitter: {
    card: 'summary' | 'summary_large_image' | 'app' | 'player';
    site?: string;
    creator?: string;
    title?: string;
    description?: string;
    image?: string;
    imageAlt?: string;
  };
  
  // Article-specific (for blog posts)
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    expirationTime?: string;
    authors?: string[];
    section?: string;
    tags?: string[];
  };
  
  // Additional Meta
  robots?: string;
  viewport?: string;
  themeColor?: string;
  favicon?: string;
  appleTouchIcon?: string;
  
  // Structured Data
  structuredData?: StructuredDataSchema[];
}

export interface OpenGraphImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
}

export interface StructuredDataSchema {
  '@context': string;
  '@type': string;
  [key: string]: any;
}

export interface BreadcrumbItem {
  name: string;
  item: string;
  position: number;
}

export interface ArticleSchema {
  headline: string;
  description: string;
  image: string[];
  author: {
    '@type': 'Person';
    name: string;
    url?: string;
  };
  publisher: {
    '@type': 'Organization';
    name: string;
    logo: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  datePublished: string;
  dateModified: string;
  mainEntityOfPage: string;
  wordCount?: number;
  articleSection?: string;
  keywords?: string[];
}

// ============================================================================
// SEO CONFIGURATION
// ============================================================================

export const DEFAULT_SEO_CONFIG = {
  title: 'The Corporate Blog',
  description: 'Production-grade, SEO-first, serverless blogging platform built to scale to 1M+ Daily Active Users.',
  canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://thecorporateblog.com',
  siteName: 'The Corporate Blog',
  locale: 'en_US',
  twitterHandle: '@thecorporateblog',
  organizationName: 'The Corporate Blog',
  organizationLogo: '/logo-512.png',
  defaultImage: '/og-default.jpg',
  favicon: '/favicon.ico',
  appleTouchIcon: '/apple-touch-icon.png',
  themeColor: '#0070f3',
  keywords: [
    'blog platform',
    'cms',
    'next.js',
    'seo optimized',
    'serverless',
    'corporate blogging',
    'content management',
    'typescript',
    'vercel',
    'prisma'
  ]
} as const;

// ============================================================================
// SEO UTILITY FUNCTIONS
// ============================================================================

export function generatePageTitle(pageTitle?: string, includeDefault = true): string {
  if (!pageTitle) return DEFAULT_SEO_CONFIG.title;
  
  if (includeDefault) {
    return `${pageTitle} | ${DEFAULT_SEO_CONFIG.title}`;
  }
  
  return pageTitle;
}

export function truncateDescription(description: string, maxLength = 160): string {
  if (description.length <= maxLength) return description;
  
  return description.substring(0, maxLength - 3).trim() + '...';
}

export function generateKeywords(baseKeywords: string[], additionalKeywords: string[] = []): string[] {
  const combined = [...DEFAULT_SEO_CONFIG.keywords, ...baseKeywords, ...additionalKeywords];
  return [...new Set(combined)]; // Remove duplicates
}

export function generateCanonicalUrl(path: string): string {
  const baseUrl = DEFAULT_SEO_CONFIG.canonical;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

// ============================================================================
// STRUCTURED DATA GENERATORS
// ============================================================================

export function generateOrganizationSchema(): StructuredDataSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: DEFAULT_SEO_CONFIG.organizationName,
    url: DEFAULT_SEO_CONFIG.canonical,
    logo: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.organizationLogo}`,
    sameAs: [
      'https://twitter.com/thecorporateblog',
      'https://linkedin.com/company/thecorporateblog',
      'https://github.com/thecorporateblog'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-555-123-4567',
      contactType: 'Customer Service',
      availableLanguage: ['English']
    }
  };
}

export function generateWebsiteSchema(): StructuredDataSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEFAULT_SEO_CONFIG.title,
    alternateName: DEFAULT_SEO_CONFIG.siteName,
    url: DEFAULT_SEO_CONFIG.canonical,
    description: DEFAULT_SEO_CONFIG.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${DEFAULT_SEO_CONFIG.canonical}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    },
    publisher: {
      '@type': 'Organization',
      name: DEFAULT_SEO_CONFIG.organizationName,
      logo: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.organizationLogo}`
    }
  };
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): StructuredDataSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item
    }))
  };
}

export function generateArticleSchema(post: Post & { author: User; category?: Category }): StructuredDataSchema {
  const images = [];
  
  if (post.featuredImage) {
    images.push(post.featuredImage);
  }
  
  // Add default image if no featured image
  if (images.length === 0) {
    images.push(`${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`);
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || truncateDescription(post.metaDescription || '', 160),
    image: images,
    author: {
      '@type': 'Person',
      name: post.author.name || post.author.username || 'Anonymous',
      url: `${DEFAULT_SEO_CONFIG.canonical}/authors/${post.author.username || post.author.id}`
    },
    publisher: {
      '@type': 'Organization',
      name: DEFAULT_SEO_CONFIG.organizationName,
      logo: {
        '@type': 'ImageObject',
        url: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.organizationLogo}`
      }
    },
    datePublished: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: generateCanonicalUrl(`/blog/${post.slug}`),
    wordCount: post.wordCount || undefined,
    articleSection: post.category?.name || 'Blog',
    keywords: post.tags ? (post.tags as any) : undefined,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    about: post.category ? {
      '@type': 'Thing',
      name: post.category.name,
      description: post.category.description || undefined
    } : undefined
  };
}

export function generateAuthorSchema(author: User): StructuredDataSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name || author.username || 'Anonymous',
    description: author.bio || undefined,
    image: author.avatar || undefined,
    url: generateCanonicalUrl(`/authors/${author.username || author.id}`),
    sameAs: [
      author.website,
      author.twitter ? `https://twitter.com/${author.twitter}` : undefined,
      author.linkedin ? `https://linkedin.com/in/${author.linkedin}` : undefined,
      author.github ? `https://github.com/${author.github}` : undefined
    ].filter(Boolean),
    knowsAbout: ['Blogging', 'Content Creation', 'SEO', 'Web Development'],
    alumniOf: author.bio ? undefined : 'The Corporate Blog',
    worksFor: {
      '@type': 'Organization',
      name: DEFAULT_SEO_CONFIG.organizationName,
      url: DEFAULT_SEO_CONFIG.canonical
    }
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]): StructuredDataSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

// ============================================================================
// PAGE-SPECIFIC SEO GENERATORS
// ============================================================================

export function generateHomepageSEO(): SEOMetadata {
  return {
    title: DEFAULT_SEO_CONFIG.title,
    description: DEFAULT_SEO_CONFIG.description,
    keywords: DEFAULT_SEO_CONFIG.keywords,
    canonical: DEFAULT_SEO_CONFIG.canonical,
    openGraph: {
      title: DEFAULT_SEO_CONFIG.title,
      description: DEFAULT_SEO_CONFIG.description,
      type: 'website',
      url: DEFAULT_SEO_CONFIG.canonical,
      siteName: DEFAULT_SEO_CONFIG.siteName,
      images: [{
        url: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
        width: 1200,
        height: 630,
        alt: DEFAULT_SEO_CONFIG.title
      }],
      locale: DEFAULT_SEO_CONFIG.locale
    },
    twitter: {
      card: 'summary_large_image',
      site: DEFAULT_SEO_CONFIG.twitterHandle,
      title: DEFAULT_SEO_CONFIG.title,
      description: DEFAULT_SEO_CONFIG.description,
      image: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
      imageAlt: DEFAULT_SEO_CONFIG.title
    },
    robots: 'index,follow',
    structuredData: [
      generateOrganizationSchema(),
      generateWebsiteSchema()
    ]
  };
}

export function generatePostSEO(post: Post & { author: User; category?: Category }): SEOMetadata {
  const title = post.seoTitle || post.title;
  const description = truncateDescription(post.metaDescription || post.excerpt || '', 160);
  const url = generateCanonicalUrl(`/blog/${post.slug}`);
  const image = post.featuredImage || `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`;
  
  // Generate breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', item: DEFAULT_SEO_CONFIG.canonical, position: 1 },
    { name: 'Blog', item: generateCanonicalUrl('/blog'), position: 2 }
  ];
  
  if (post.category) {
    breadcrumbs.push({
      name: post.category.name,
      item: generateCanonicalUrl(`/blog/category/${post.category.slug}`),
      position: 3
    });
    breadcrumbs.push({
      name: post.title,
      item: url,
      position: 4
    });
  } else {
    breadcrumbs.push({
      name: post.title,
      item: url,
      position: 3
    });
  }

  return {
    title: generatePageTitle(title),
    description,
    keywords: generateKeywords(
      post.category ? [post.category.name] : [],
      Array.isArray(post.tags) ? post.tags : []
    ),
    canonical: url,
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      siteName: DEFAULT_SEO_CONFIG.siteName,
      images: [{
        url: image,
        width: 1200,
        height: 630,
        alt: post.featuredImageAlt || post.title
      }],
      locale: DEFAULT_SEO_CONFIG.locale
    },
    twitter: {
      card: 'summary_large_image',
      site: DEFAULT_SEO_CONFIG.twitterHandle,
      creator: post.author.twitter ? `@${post.author.twitter}` : DEFAULT_SEO_CONFIG.twitterHandle,
      title,
      description,
      image,
      imageAlt: post.featuredImageAlt || post.title
    },
    article: {
      publishedTime: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author.name || post.author.username || 'Anonymous'],
      section: post.category?.name || 'Blog',
      tags: Array.isArray(post.tags) ? post.tags : undefined
    },
    robots: post.status === 'PUBLISHED' ? 'index,follow' : 'noindex,nofollow',
    structuredData: [
      generateArticleSchema(post),
      generateBreadcrumbSchema(breadcrumbs),
      generateAuthorSchema(post.author)
    ]
  };
}

export function generateCategorySEO(category: Category, posts?: Post[]): SEOMetadata {
  const title = category.seoTitle || `${category.name} Articles`;
  const description = truncateDescription(
    category.metaDescription || 
    category.description || 
    `Explore ${category.name} articles and insights on ${DEFAULT_SEO_CONFIG.title}`,
    160
  );
  const url = generateCanonicalUrl(`/blog/category/${category.slug}`);
  
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', item: DEFAULT_SEO_CONFIG.canonical, position: 1 },
    { name: 'Blog', item: generateCanonicalUrl('/blog'), position: 2 },
    { name: category.name, item: url, position: 3 }
  ];

  return {
    title: generatePageTitle(title),
    description,
    keywords: generateKeywords([category.name, 'articles', 'insights']),
    canonical: url,
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      siteName: DEFAULT_SEO_CONFIG.siteName,
      images: [{
        url: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
        width: 1200,
        height: 630,
        alt: `${category.name} Articles`
      }],
      locale: DEFAULT_SEO_CONFIG.locale
    },
    twitter: {
      card: 'summary_large_image',
      site: DEFAULT_SEO_CONFIG.twitterHandle,
      title,
      description,
      image: `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
      imageAlt: `${category.name} Articles`
    },
    robots: category.isVisible ? 'index,follow' : 'noindex,follow',
    structuredData: [
      generateBreadcrumbSchema(breadcrumbs),
      generateOrganizationSchema()
    ]
  };
}

export function generateAuthorSEO(author: User, posts?: Post[]): SEOMetadata {
  const name = author.name || author.username || 'Author';
  const title = `${name} - Author`;
  const description = truncateDescription(
    author.bio || 
    `Read articles by ${name} on ${DEFAULT_SEO_CONFIG.title}`,
    160
  );
  const url = generateCanonicalUrl(`/authors/${author.username || author.id}`);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', item: DEFAULT_SEO_CONFIG.canonical, position: 1 },
    { name: 'Authors', item: generateCanonicalUrl('/authors'), position: 2 },
    { name, item: url, position: 3 }
  ];

  return {
    title: generatePageTitle(title),
    description,
    keywords: generateKeywords([name, 'author', 'articles', 'posts']),
    canonical: url,
    openGraph: {
      title,
      description,
      type: 'profile',
      url,
      siteName: DEFAULT_SEO_CONFIG.siteName,
      images: [{
        url: author.avatar || `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
        width: 1200,
        height: 630,
        alt: name
      }],
      locale: DEFAULT_SEO_CONFIG.locale
    },
    twitter: {
      card: 'summary_large_image',
      site: DEFAULT_SEO_CONFIG.twitterHandle,
      creator: author.twitter ? `@${author.twitter}` : DEFAULT_SEO_CONFIG.twitterHandle,
      title,
      description,
      image: author.avatar || `${DEFAULT_SEO_CONFIG.canonical}${DEFAULT_SEO_CONFIG.defaultImage}`,
      imageAlt: name
    },
    robots: 'index,follow',
    structuredData: [
      generateAuthorSchema(author),
      generateBreadcrumbSchema(breadcrumbs)
    ]
  };
}

// ============================================================================
// SEO VALIDATION
// ============================================================================

export function validateSEO(metadata: SEOMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Title validation
  if (!metadata.title) {
    errors.push('Title is required');
  } else if (metadata.title.length > 60) {
    errors.push('Title should be 60 characters or less');
  }
  
  // Description validation
  if (!metadata.description) {
    errors.push('Description is required');
  } else if (metadata.description.length > 160) {
    errors.push('Description should be 160 characters or less');
  }
  
  // Open Graph validation
  if (!metadata.openGraph.title) {
    errors.push('Open Graph title is required');
  }
  
  if (!metadata.openGraph.description) {
    errors.push('Open Graph description is required');
  }
  
  if (!metadata.openGraph.images || metadata.openGraph.images.length === 0) {
    errors.push('At least one Open Graph image is required');
  }
  
  // URL validation
  if (!metadata.canonical) {
    errors.push('Canonical URL is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}