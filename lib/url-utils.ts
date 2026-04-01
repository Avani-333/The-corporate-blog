/**
 * URL and Slug Utilities for The Corporate Blog
 * Implements the standards defined in docs/url-conventions.md
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const URL_CONSTANTS = {
  // Base paths
  BLOG: '/blog',
  CATEGORIES: '/categories', 
  TAGS: '/tags',
  AUTHORS: '/authors',
  DASHBOARD: '/dashboard',
  API_BASE: '/api/v1',
  
  // Length constraints
  SLUG_MIN_LENGTH: 3,
  SLUG_MAX_LENGTH: 60,
  SLUG_OPTIMAL_LENGTH: 45,
  
  // Reserved slugs that cannot be used
  RESERVED_SLUGS: [
    'admin', 'api', 'www', 'mail', 'ftp', 'dashboard', 'auth', 'login',
    'register', 'signin', 'signup', 'logout', 'profile', 'settings',
    'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', 'feed',
    'rss', 'atom', 'search', 'tag', 'category', 'author', 'archive',
    'public', 'static', 'assets', 'uploads', 'downloads', 'images'
  ]
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface SlugOptions {
  maxLength?: number;
  prefix?: string;
  suffix?: string;
  allowNumbers?: boolean;
  preserveCase?: boolean;
}

export interface UrlBuildOptions {
  includeHost?: boolean;
  host?: string;
  protocol?: 'http' | 'https';
}

export type ContentType = 'post' | 'category' | 'tag' | 'author' | 'page';

// ============================================================================
// SLUG GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate a URL-safe slug from a title or text
 */
export function generateSlug(
  text: string, 
  options: SlugOptions = {}
): string {
  const {
    maxLength = URL_CONSTANTS.SLUG_MAX_LENGTH,
    prefix = '',
    suffix = '',
    allowNumbers = true,
    preserveCase = false
  } = options;

  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  let slug = text.trim();

  // Convert to lowercase unless preserveCase is true
  if (!preserveCase) {
    slug = slug.toLowerCase();
  }

  // Remove special characters and replace with spaces
  slug = slug.replace(/[^\w\s-]/g, '');

  // Remove numbers if not allowed
  if (!allowNumbers) {
    slug = slug.replace(/\d/g, '');
  }

  // Replace multiple spaces/hyphens with single hyphen
  slug = slug
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Add prefix and suffix
  if (prefix) slug = `${prefix}-${slug}`;
  if (suffix) slug = `${slug}-${suffix}`;

  // Truncate to max length while preserving word boundaries
  if (slug.length > maxLength) {
    const truncated = slug.substring(0, maxLength);
    const lastHyphen = truncated.lastIndexOf('-');
    slug = lastHyphen > maxLength * 0.7 ? truncated.substring(0, lastHyphen) : truncated;
  }

  // Ensure minimum length
  if (slug.length < URL_CONSTANTS.SLUG_MIN_LENGTH) {
    throw new Error(`Generated slug is too short (minimum ${URL_CONSTANTS.SLUG_MIN_LENGTH} characters)`);
  }

  return slug;
}

/**
 * Validate a slug against our standards
 */
export function validateSlug(slug: string, contentType?: ContentType): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic format validation
  if (!slug || typeof slug !== 'string') {
    errors.push('Slug must be a non-empty string');
    return { isValid: false, errors };
  }

  // Length validation
  if (slug.length < URL_CONSTANTS.SLUG_MIN_LENGTH) {
    errors.push(`Slug must be at least ${URL_CONSTANTS.SLUG_MIN_LENGTH} characters long`);
  }

  if (slug.length > URL_CONSTANTS.SLUG_MAX_LENGTH) {
    errors.push(`Slug must not exceed ${URL_CONSTANTS.SLUG_MAX_LENGTH} characters`);
  }

  // Format validation
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(slug)) {
    errors.push('Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)');
  }

  // Reserved slug validation
  if (URL_CONSTANTS.RESERVED_SLUGS.includes(slug)) {
    errors.push(`'${slug}' is a reserved slug and cannot be used`);
  }

  // Content-specific validation
  if (contentType === 'author' && slug.length > 30) {
    errors.push('Author slugs should not exceed 30 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Ensure slug uniqueness by adding incremental suffixes
 */
export function ensureUniqueSlug(
  baseSlug: string, 
  existingSlugs: string[]
): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  return uniqueSlug;
}

// ============================================================================
// URL BUILDING FUNCTIONS  
// ============================================================================

/**
 * Build a complete URL from components
 */
export function buildUrl(
  path: string,
  options: UrlBuildOptions = {}
): string {
  const {
    includeHost = false,
    host = 'thecorporateblog.com',
    protocol = 'https'
  } = options;

  // Ensure path starts with slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (includeHost) {
    return `${protocol}://${host}${normalizedPath}`;
  }

  return normalizedPath;
}

/**
 * Build blog post URL
 */
export function buildPostUrl(
  slug: string,
  options: UrlBuildOptions & { useCategory?: boolean; category?: string } = {}
): string {
  const { useCategory = false, category, ...urlOptions } = options;

  if (useCategory && category) {
    return buildUrl(`${URL_CONSTANTS.BLOG}/${category}/${slug}`, urlOptions);
  }

  return buildUrl(`${URL_CONSTANTS.BLOG}/${slug}`, urlOptions);
}

/**
 * Build category URL
 */
export function buildCategoryUrl(
  slug: string,
  options: UrlBuildOptions = {}
): string {
  return buildUrl(`${URL_CONSTANTS.CATEGORIES}/${slug}`, options);
}

/**
 * Build tag URL
 */
export function buildTagUrl(
  slug: string,
  options: UrlBuildOptions = {}
): string {
  return buildUrl(`${URL_CONSTANTS.TAGS}/${slug}`, options);
}

/**
 * Build author URL
 */
export function buildAuthorUrl(
  username: string,
  subPath?: string,
  options: UrlBuildOptions = {}
): string {
  const path = subPath 
    ? `${URL_CONSTANTS.AUTHORS}/${username}/${subPath}`
    : `${URL_CONSTANTS.AUTHORS}/${username}`;
  
  return buildUrl(path, options);
}

/**
 * Build dashboard URL
 */
export function buildDashboardUrl(
  subPath?: string,
  options: UrlBuildOptions = {}
): string {
  const path = subPath 
    ? `${URL_CONSTANTS.DASHBOARD}/${subPath}`
    : URL_CONSTANTS.DASHBOARD;
    
  return buildUrl(path, options);
}

/**
 * Build API endpoint URL
 */
export function buildApiUrl(
  endpoint: string,
  options: UrlBuildOptions = {}
): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return buildUrl(`${URL_CONSTANTS.API_BASE}/${normalizedEndpoint}`, options);
}

// ============================================================================
// URL PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a blog post URL to extract slug and category
 */
export function parsePostUrl(url: string): {
  slug?: string;
  category?: string;
  isValid: boolean;
} {
  try {
    const urlObj = new URL(url, 'https://example.com');
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Handle /blog/{slug} format
    if (pathParts[0] === 'blog' && pathParts.length === 2) {
      return {
        slug: pathParts[1],
        isValid: true
      };
    }

    // Handle /blog/{category}/{slug} format
    if (pathParts[0] === 'blog' && pathParts.length === 3) {
      return {
        category: pathParts[1],
        slug: pathParts[2],
        isValid: true
      };
    }

    return { isValid: false };
  } catch {
    return { isValid: false };
  }
}

/**
 * Extract slug from any URL path
 */
export function extractSlugFromPath(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate suggestions for similar slugs
 */
export function generateSlugSuggestions(
  text: string, 
  count: number = 3
): string[] {
  const baseSlug = generateSlug(text);
  const suggestions: string[] = [baseSlug];

  // Generate variations
  const words = text.toLowerCase().split(/\s+/);
  
  if (words.length > 1) {
    // Try acronym
    const acronym = words.map(word => word.charAt(0)).join('');
    if (acronym.length >= 3) {
      suggestions.push(`${acronym}-${generateSlug(words[words.length - 1])}`);
    }

    // Try shortened version
    if (baseSlug.length > 20) {
      const shortened = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      suggestions.push(generateSlug(shortened));
    }

    // Try without common words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const filteredWords = words.filter(word => !commonWords.includes(word));
    if (filteredWords.length > 0 && filteredWords.length < words.length) {
      suggestions.push(generateSlug(filteredWords.join(' ')));
    }
  }

  return [...new Set(suggestions)].slice(0, count);
}

/**
 * Check if a URL matches our standard patterns
 */
export function isStandardUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, 'https://example.com');
    const path = urlObj.pathname;

    const standardPatterns = [
      /^\/blog\/[a-z0-9-]+$/,                    // Blog posts
      /^\/blog\/[a-z0-9-]+\/[a-z0-9-]+$/,       // Blog posts with category
      /^\/categories\/[a-z0-9-]+$/,              // Categories
      /^\/tags\/[a-z0-9-]+$/,                    // Tags
      /^\/authors\/[a-z0-9-]+$/,                 // Authors
      /^\/dashboard(\/[a-z0-9-]+)*$/,            // Dashboard paths
      /^\/[a-z0-9-]+$/                           // Static pages
    ];

    return standardPatterns.some(pattern => pattern.test(path));
  } catch {
    return false;
  }
}

/**
 * Convert old URL format to new standard format
 */
export function migrateUrl(oldUrl: string): string | null {
  const migrations: Record<string, string> = {
    // Legacy patterns
    '/post/': '/blog/',
    '/category/': '/categories/',
    '/tag/': '/tags/',
    '/author/': '/authors/',
    '/user/': '/authors/',
    
    // Common variations
    '/articles/': '/blog/',
    '/posts/': '/blog/',
    '/news/': '/blog/'
  };

  for (const [oldPattern, newPattern] of Object.entries(migrations)) {
    if (oldUrl.includes(oldPattern)) {
      return oldUrl.replace(oldPattern, newPattern);
    }
  }

  return null;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  generateSlug,
  validateSlug,
  ensureUniqueSlug,
  buildUrl,
  buildPostUrl,
  buildCategoryUrl,
  buildTagUrl,
  buildAuthorUrl,
  buildDashboardUrl,
  buildApiUrl,
  parsePostUrl,
  extractSlugFromPath,
  generateSlugSuggestions,
  isStandardUrl,
  migrateUrl,
  URL_CONSTANTS
};