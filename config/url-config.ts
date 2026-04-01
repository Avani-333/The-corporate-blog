/**
 * URL Configuration for The Corporate Blog
 * Centralizes all URL-related settings and constants
 */

import { UrlConfig } from '@/types';

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

export const URL_CONFIG: UrlConfig = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://thecorporateblog.com',
  blogPath: '/blog',
  categoriesPath: '/categories',
  tagsPath: '/tags',
  authorsPath: '/authors',
  dashboardPath: '/dashboard',
  apiPath: '/api/v1'
};

// ============================================================================
// SLUG CONFIGURATION
// ============================================================================

export const SLUG_CONFIG = {
  // Length constraints
  minLength: 3,
  maxLength: 60,
  optimalLength: 45,
  
  // Character rules
  allowedPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  separatorReplacement: '-',
  
  // Content-specific limits
  postSlugMax: 60,
  categorySlugMax: 30,
  tagSlugMax: 25,
  authorSlugMax: 30,
  pageSlugMax: 40,
  
  // Reserved slugs (cannot be used)
  reservedSlugs: [
    // Core system
    'admin', 'api', 'www', 'mail', 'ftp', 'cdn', 'assets',
    
    // Authentication
    'auth', 'login', 'register', 'signin', 'signup', 'logout',
    'password-reset', 'verify', 'oauth',
    
    // Application paths
    'dashboard', 'profile', 'settings', 'preferences',
    'notifications', 'account', 'billing',
    
    // Content paths
    'blog', 'post', 'posts', 'article', 'articles',
    'category', 'categories', 'tag', 'tags',
    'author', 'authors', 'user', 'users',
    
    // Static pages
    'about', 'contact', 'privacy', 'terms', 'legal',
    'sitemap', 'robots', 'feed', 'rss', 'atom',
    
    // SEO and metadata
    'search', 'archive', 'page', 'index',
    'home', 'news', 'help', 'support', 'docs',
    
    // Technical
    'public', 'static', 'uploads', 'downloads',
    'images', 'media', 'files', 'assets',
    
    // Common variations
    'app', 'application', 'site', 'website',
    'blog', 'cms', 'content', 'data'
  ]
} as const;

// ============================================================================
// SEO CONFIGURATION
// ============================================================================

export const SEO_CONFIG = {
  // Meta defaults
  defaultTitle: 'The Corporate Blog',
  titleSeparator: ' | ',
  defaultDescription: 'Production-grade, SEO-first blogging platform for modern businesses',
  
  // Open Graph
  ogSiteName: 'The Corporate Blog',
  ogType: 'website',
  
  // Twitter
  twitterSite: '@thecorporateblog',
  twitterCreator: '@thecorporateblog',
  
  // Structured data
  organization: {
    '@type': 'Organization',
    name: 'The Corporate Blog',
    url: URL_CONFIG.baseUrl,
    logo: `${URL_CONFIG.baseUrl}/logo.png`,
    sameAs: [
      'https://twitter.com/thecorporateblog',
      'https://linkedin.com/company/thecorporateblog'
    ]
  },
  
  // JSON-LD defaults
  jsonLdDefaults: {
    '@context': 'https://schema.org',
    publisher: {
      '@type': 'Organization',
      name: 'The Corporate Blog',
      logo: {
        '@type': 'ImageObject',
        url: `${URL_CONFIG.baseUrl}/logo.png`
      }
    }
  }
} as const;

// ============================================================================
// PAGINATION CONFIGURATION
// ============================================================================

export const PAGINATION_CONFIG = {
  // Default page sizes
  defaultPageSize: 10,
  maxPageSize: 100,
  
  // Page sizes by content type
  blogPostsPerPage: 12,
  categoriesPerPage: 20,
  tagsPerPage: 50,
  authorsPerPage: 24,
  commentsPerPage: 20,
  searchResultsPerPage: 15,
  
  // URL parameters
  pageParam: 'page',
  limitParam: 'limit',
  sortParam: 'sort',
  orderParam: 'order'
} as const;

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  // Base URLs
  internalApi: '/api/v1',
  externalApi: process.env.NEXT_PUBLIC_API_URL || 'https://api.thecorporateblog.com/v1',
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,         // per window per IP
  },
  
  // Timeouts
  requestTimeout: 30000,  // 30 seconds
  uploadTimeout: 300000,  // 5 minutes
  
  // Cache settings
  cacheHeaders: {
    static: 'public, max-age=31536000, immutable',      // 1 year for static assets
    dynamic: 'public, max-age=300, s-maxage=3600',      // 5 min browser, 1 hour CDN
    private: 'private, max-age=0, no-cache, no-store',  // No caching
  }
} as const;

// ============================================================================
// CDN AND MEDIA CONFIGURATION
// ============================================================================

export const MEDIA_CONFIG = {
  // CDN settings
  cdnUrl: process.env.NEXT_PUBLIC_CDN_URL || URL_CONFIG.baseUrl,
  
  // Image settings
  imageFormats: ['webp', 'avif', 'jpg', 'png'],
  imageSizes: [320, 480, 768, 1024, 1280, 1920],
  imageQuality: 85,
  
  // Upload limits
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg','image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm',
    'application/pdf',
    'text/plain'
  ],
  
  // Cloudinary integration (if used)
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
    folder: 'thecorporateblog'
  }
} as const;

// ============================================================================
// CACHING CONFIGURATION
// ============================================================================

export const CACHE_CONFIG = {
  // Redis settings
  redis: {
    url: process.env.REDIS_URL,
    ttl: {
      short: 300,      // 5 minutes
      medium: 3600,    // 1 hour
      long: 86400,     // 24 hours
      week: 604800,    // 7 days
    }
  },
  
  // Next.js ISR settings
  revalidation: {
    blogPosts: 3600,     // 1 hour
    categories: 86400,   // 24 hours
    authors: 86400,      // 24 hours
    staticPages: 604800, // 7 days
  },
  
  // Browser caching
  clientCache: {
    static: 31536000,    // 1 year
    dynamic: 300,        // 5 minutes
    api: 60,            // 1 minute
  }
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  // Content features
  enableComments: process.env.NEXT_PUBLIC_ENABLE_COMMENTS === 'true',
  enableSearch: process.env.NEXT_PUBLIC_ENABLE_SEARCH === 'true',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableNewsletter: process.env.NEXT_PUBLIC_ENABLE_NEWSLETTER === 'true',
  
  // SEO features
  enableSitemaps: true,
  enableRobotsTxt: true,
  enableStructuredData: true,
  enableOpenGraph: true,
  
  // Performance features
  enableImageOptimization: true,
  enableLazyLoading: true,
  enablePrefetching: true,
  enableCDN: process.env.NODE_ENV === 'production',
  
  // Development features
  enableDebugMode: process.env.NODE_ENV === 'development',
  enableMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',
  enableDevTools: process.env.NODE_ENV === 'development',
} as const;

// ============================================================================
// MONITORING CONFIGURATION
// ============================================================================

export const MONITORING_CONFIG = {
  // Analytics
  googleAnalyticsId: process.env.NEXT_PUBLIC_GA_ID,
  googleTagManagerId: process.env.NEXT_PUBLIC_GTM_ID,
  cloudflareWebAnalyticsToken: process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
  
  // Error tracking
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance monitoring
  webVitalsEndpoint: '/api/web-vitals',
  
  // Custom events
  trackPageViews: true,
  trackScrollDepth: true,
  trackClickEvents: true,
  trackFormSubmissions: true,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the full URL for a given path
 */
export function getFullUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${URL_CONFIG.baseUrl}${normalizedPath}`;
}

/**
 * Get the CDN URL for a media asset
 */
export function getCdnUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${MEDIA_CONFIG.cdnUrl}${normalizedPath}`;
}

/**
 * Check if a slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  return SLUG_CONFIG.reservedSlugs.includes(slug.toLowerCase());
}

/**
 * Get cache TTL by content type
 */
export function getCacheTTL(contentType: 'post' | 'category' | 'author' | 'static'): number {
  switch (contentType) {
    case 'post':
      return CACHE_CONFIG.revalidation.blogPosts;
    case 'category':
      return CACHE_CONFIG.revalidation.categories;
    case 'author':
      return CACHE_CONFIG.revalidation.authors;
    case 'static':
      return CACHE_CONFIG.revalidation.staticPages;
    default:
      return CACHE_CONFIG.redis.ttl.medium;
  }
}

/**
 * Build structured data for a blog post
 */
export function buildPostStructuredData(post: {
  title: string;
  slug: string;
  excerpt?: string;
  author: { name: string; username: string };
  publishedAt: Date;
  updatedAt: Date;
  featuredImage?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: getFullUrl(`${URL_CONFIG.authorsPath}/${post.author.username}`)
    },
    publisher: SEO_CONFIG.jsonLdDefaults.publisher,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: getFullUrl(`${URL_CONFIG.blogPath}/${post.slug}`),
    image: post.featuredImage ? getCdnUrl(post.featuredImage) : undefined,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': getFullUrl(`${URL_CONFIG.blogPath}/${post.slug}`)
    }
  };
}

// Export everything as a single config object for convenience
export const CONFIG = {
  url: URL_CONFIG,
  slug: SLUG_CONFIG,
  seo: SEO_CONFIG,
  pagination: PAGINATION_CONFIG,
  api: API_CONFIG,
  media: MEDIA_CONFIG,
  cache: CACHE_CONFIG,
  features: FEATURE_FLAGS,
  monitoring: MONITORING_CONFIG
} as const;