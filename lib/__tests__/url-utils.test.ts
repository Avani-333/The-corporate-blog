/**
 * Test suite for URL and Slug utilities
 * Run with: npm test lib/url-utils.test.ts
 */

import {
  generateSlug,
  validateSlug,
  ensureUniqueSlug,
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
} from './url-utils';

// ============================================================================
// SLUG GENERATION TESTS
// ============================================================================

describe('generateSlug', () => {
  test('should generate basic slug from title', () => {
    expect(generateSlug('Getting Started with Next.js')).toBe('getting-started-with-nextjs');
    expect(generateSlug('Advanced TypeScript Patterns')).toBe('advanced-typescript-patterns');
    expect(generateSlug('10 React Performance Tips')).toBe('10-react-performance-tips');
  });

  test('should handle special characters', () => {
    expect(generateSlug('React & TypeScript: Best Practices!')).toBe('react-typescript-best-practices');
    expect(generateSlug('Node.js + Express.js Tutorial')).toBe('nodejs-expressjs-tutorial');
    expect(generateSlug('What is AI? A Complete Guide')).toBe('what-is-ai-a-complete-guide');
  });

  test('should handle multiple spaces and hyphens', () => {
    expect(generateSlug('Multiple   Spaces  Between   Words')).toBe('multiple-spaces-between-words');
    expect(generateSlug('Already-Has--Hyphens---Here')).toBe('already-has-hyphens-here');
  });

  test('should respect length limits', () => {
    const longTitle = 'This is a very long title that should be truncated at word boundaries to maintain readability and SEO best practices';
    const slug = generateSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(URL_CONSTANTS.SLUG_MAX_LENGTH);
    expect(slug).not.toMatch(/-$/); // Should not end with hyphen
  });

  test('should handle prefix and suffix options', () => {
    expect(generateSlug('React Tutorial', { prefix: 'blog' })).toBe('blog-react-tutorial');
    expect(generateSlug('User Guide', { suffix: '2024' })).toBe('user-guide-2024');
  });

  test('should throw error for empty input', () => {
    expect(() => generateSlug('')).toThrow();
    expect(() => generateSlug('  ')).toThrow();
  });
});

// ============================================================================
// SLUG VALIDATION TESTS
// ============================================================================

describe('validateSlug', () => {
  test('should validate correct slugs', () => {
    expect(validateSlug('valid-slug-example').isValid).toBe(true);
    expect(validateSlug('react-tutorial-2024').isValid).toBe(true);
    expect(validateSlug('nextjs-guide').isValid).toBe(true);
  });

  test('should reject invalid formats', () => {
    expect(validateSlug('Invalid_Slug').isValid).toBe(false);
    expect(validateSlug('invalid slug with spaces').isValid).toBe(false);
    expect(validateSlug('UPPERCASE-SLUG').isValid).toBe(false);
    expect(validateSlug('-leading-hyphen').isValid).toBe(false);
    expect(validateSlug('trailing-hyphen-').isValid).toBe(false);
    expect(validateSlug('double--hyphen').isValid).toBe(false);
  });

  test('should reject reserved slugs', () => {
    expect(validateSlug('admin').isValid).toBe(false);
    expect(validateSlug('api').isValid).toBe(false);
    expect(validateSlug('dashboard').isValid).toBe(false);
  });

  test('should validate length constraints', () => {
    expect(validateSlug('ab').isValid).toBe(false); // Too short
    expect(validateSlug('a'.repeat(65)).isValid).toBe(false); // Too long
  });
});

// ============================================================================
// UNIQUE SLUG TESTS
// ============================================================================

describe('ensureUniqueSlug', () => {
  test('should return original slug if unique', () => {
    expect(ensureUniqueSlug('unique-slug', ['other-slug', 'another-slug'])).toBe('unique-slug');
  });

  test('should add suffix for duplicates', () => {
    const existingSlugs = ['react-tutorial', 'react-tutorial-2'];
    expect(ensureUniqueSlug('react-tutorial', existingSlugs)).toBe('react-tutorial-3');
  });

  test('should handle multiple duplicates', () => {
    const existingSlugs = ['test-slug', 'test-slug-2', 'test-slug-3', 'test-slug-5'];
    expect(ensureUniqueSlug('test-slug', existingSlugs)).toBe('test-slug-4');
  });
});

// ============================================================================
// URL BUILDING TESTS
// ============================================================================

describe('buildPostUrl', () => {
  test('should build standard blog post URLs', () => {
    expect(buildPostUrl('react-tutorial')).toBe('/blog/react-tutorial');
    expect(buildPostUrl('nextjs-guide')).toBe('/blog/nextjs-guide');
  });

  test('should build category-based URLs', () => {
    expect(buildPostUrl('react-tutorial', { 
      useCategory: true, 
      category: 'web-development' 
    })).toBe('/blog/web-development/react-tutorial');
  });

  test('should build full URLs with host', () => {
    expect(buildPostUrl('react-tutorial', { 
      includeHost: true 
    })).toBe('https://thecorporateblog.com/blog/react-tutorial');
  });
});

describe('buildCategoryUrl', () => {
  test('should build category URLs', () => {
    expect(buildCategoryUrl('web-development')).toBe('/categories/web-development');
    expect(buildCategoryUrl('ai-machine-learning')).toBe('/categories/ai-machine-learning');
  });
});

describe('buildAuthorUrl', () => {
  test('should build author profile URLs', () => {
    expect(buildAuthorUrl('john-doe')).toBe('/authors/john-doe');
    expect(buildAuthorUrl('jane-smith', 'posts')).toBe('/authors/jane-smith/posts');
  });
});

describe('buildDashboardUrl', () => {
  test('should build dashboard URLs', () => {
    expect(buildDashboardUrl()).toBe('/dashboard');
    expect(buildDashboardUrl('posts')).toBe('/dashboard/posts');
    expect(buildDashboardUrl('admin/users')).toBe('/dashboard/admin/users');
  });
});

describe('buildApiUrl', () => {
  test('should build API URLs', () => {
    expect(buildApiUrl('posts')).toBe('/api/v1/posts');
    expect(buildApiUrl('/posts/123')).toBe('/api/v1/posts/123');
    expect(buildApiUrl('search')).toBe('/api/v1/search');
  });
});

// ============================================================================
// URL PARSING TESTS
// ============================================================================

describe('parsePostUrl', () => {
  test('should parse standard blog URLs', () => {
    const result = parsePostUrl('https://example.com/blog/react-tutorial');
    expect(result.isValid).toBe(true);
    expect(result.slug).toBe('react-tutorial');
    expect(result.category).toBeUndefined();
  });

  test('should parse category-based URLs', () => {
    const result = parsePostUrl('https://example.com/blog/web-development/react-tutorial');
    expect(result.isValid).toBe(true);
    expect(result.slug).toBe('react-tutorial');
    expect(result.category).toBe('web-development');
  });

  test('should handle invalid URLs', () => {
    expect(parsePostUrl('/invalid/url/structure').isValid).toBe(false);
    expect(parsePostUrl('not-a-url').isValid).toBe(false);
  });
});

describe('extractSlugFromPath', () => {
  test('should extract slug from various paths', () => {
    expect(extractSlugFromPath('/blog/react-tutorial')).toBe('react-tutorial');
    expect(extractSlugFromPath('/categories/web-development')).toBe('web-development');
    expect(extractSlugFromPath('/authors/john-doe/posts')).toBe('posts');
  });

  test('should handle edge cases', () => {
    expect(extractSlugFromPath('/single')).toBe('single');
    expect(extractSlugFromPath('/')).toBeNull();
    expect(extractSlugFromPath('')).toBeNull();
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('generateSlugSuggestions', () => {
  test('should generate multiple slug variations', () => {
    const suggestions = generateSlugSuggestions('Getting Started with React and TypeScript', 3);
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toBe('getting-started-with-react-and-typescript');
    expect(suggestions.every(slug => validateSlug(slug).isValid)).toBe(true);
  });

  test('should handle short titles', () => {
    const suggestions = generateSlugSuggestions('React Guide');
    expect(suggestions).toContain('react-guide');
  });
});

describe('isStandardUrl', () => {
  test('should validate standard URL patterns', () => {
    expect(isStandardUrl('https://example.com/blog/react-tutorial')).toBe(true);
    expect(isStandardUrl('https://example.com/categories/web-development')).toBe(true);
    expect(isStandardUrl('https://example.com/authors/john-doe')).toBe(true);
    expect(isStandardUrl('https://example.com/dashboard/admin')).toBe(true);
  });

  test('should reject non-standard URLs', () => {
    expect(isStandardUrl('https://example.com/blog/INVALID_SLUG')).toBe(false);
    expect(isStandardUrl('https://example.com/random/path/structure')).toBe(false);
  });
});

describe('migrateUrl', () => {
  test('should migrate legacy URL formats', () => {
    expect(migrateUrl('/post/react-tutorial')).toBe('/blog/react-tutorial');
    expect(migrateUrl('/category/web-dev')).toBe('/categories/web-dev');
    expect(migrateUrl('/author/john-doe')).toBe('/authors/john-doe');
  });

  test('should return null for non-migratable URLs', () => {
    expect(migrateUrl('/already/standard/url')).toBeNull();
    expect(migrateUrl('/blog/already-correct')).toBeNull();
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration: Real-world scenarios', () => {
  test('should handle complete blog post creation workflow', () => {
    const title = 'Getting Started with Next.js 14: A Complete Guide for Developers';
    
    // Generate slug
    const baseSlug = generateSlug(title);
    expect(baseSlug).toBe('getting-started-with-nextjs-14-complete-guide-developers');
    
    // Validate slug
    const validation = validateSlug(baseSlug);
    expect(validation.isValid).toBe(true);
    
    // Ensure uniqueness
    const existingSlugs = ['getting-started-nextjs', 'nextjs-tutorial'];
    const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs);
    expect(uniqueSlug).toBe(baseSlug); // Should be unique
    
    // Build URLs
    const postUrl = buildPostUrl(uniqueSlug);
    expect(postUrl).toBe('/blog/getting-started-with-nextjs-14-complete-guide-developers');
    
    // Parse URL back
    const parsed = parsePostUrl(`https://example.com${postUrl}`);
    expect(parsed.slug).toBe(uniqueSlug);
  });

  test('should handle category workflow', () => {
    const categoryName = 'Web Development & Design';
    const slug = generateSlug(categoryName, { maxLength: 30 });
    
    expect(validateSlug(slug).isValid).toBe(true);
    expect(buildCategoryUrl(slug)).toBe('/categories/web-development-design');
  });

  test('should handle author profile workflow', () => {
    const authorName = 'John Doe Jr.';
    const username = generateSlug(authorName, { maxLength: 20 });
    
    expect(username).toBe('john-doe-jr');
    expect(buildAuthorUrl(username)).toBe('/authors/john-doe-jr');
    expect(buildAuthorUrl(username, 'posts')).toBe('/authors/john-doe-jr/posts');
  });
});