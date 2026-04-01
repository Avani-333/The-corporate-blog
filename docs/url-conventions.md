# URL Conventions & Slug Structure Standards

## Table of Contents
- [Core Principles](#core-principles)
- [Slug Generation Rules](#slug-generation-rules)
- [URL Structure Standards](#url-structure-standards)
- [API Endpoint Conventions](#api-endpoint-conventions)
- [Implementation Examples](#implementation-examples)
- [SEO Considerations](#seo-considerations)

## Core Principles

### 1. SEO-First Approach
- URLs should be human-readable and descriptive
- Include target keywords naturally
- Keep URLs under 60 characters when possible
- Use hyphens (-) as word separators, never underscores

### 2. Consistency & Predictability
- Follow established patterns across all content types
- Use lowercase letters only
- Maintain consistent depth and structure
- Avoid special characters and spaces

### 3. Future-Proof Design
- Allow for content migration and restructuring
- Support internationalization (i18n) if needed
- Consider canonical URL requirements
- Enable efficient caching strategies

## Slug Generation Rules

### Character Guidelines
```
✅ ALLOWED:
- Lowercase letters (a-z)
- Numbers (0-9)
- Hyphens (-) as word separators
- Forward slashes (/) for path separation

❌ PROHIBITED:
- Uppercase letters
- Underscores (_)
- Spaces
- Special characters (!@#$%^&*()+={}[]|\"':;?><,.)
- Unicode characters (except for i18n versions)
- Trailing/leading hyphens
```

### Length Constraints
| Content Type | Min Length | Max Length | Optimal Length |
|--------------|------------|------------|----------------|
| Blog Posts   | 10 chars   | 60 chars   | 30-45 chars    |
| Categories   | 3 chars    | 30 chars   | 8-20 chars     |
| Tags         | 2 chars    | 25 chars   | 5-15 chars     |
| Pages        | 3 chars    | 40 chars   | 8-25 chars     |
| Authors      | 3 chars    | 30 chars   | 5-20 chars     |

### Slug Generation Algorithm
```typescript
function generateSlug(title: string): string {
  return title
    .toLowerCase()                    // Convert to lowercase
    .trim()                          // Remove leading/trailing spaces
    .replace(/[^\w\s-]/g, '')        // Remove special characters
    .replace(/\s+/g, '-')            // Replace spaces with hyphens
    .replace(/-+/g, '-')             // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');          // Remove leading/trailing hyphens
}
```

## URL Structure Standards

### 1. Blog Posts
```bash
# Standard blog post
/blog/{slug}
/blog/getting-started-with-nextjs-14

# With publication date (optional, for high-volume blogs)
/blog/{year}/{slug}
/blog/2024/advanced-typescript-patterns

# With category (alternative structure)
/blog/{category}/{slug}
/blog/technology/building-scalable-react-apps
```

**Recommended**: Use simple `/blog/{slug}` for better UX and sharing.

### 2. Categories & Tags
```bash
# Categories
/categories/{slug}
/categories/web-development
/categories/artificial-intelligence

# Category RSS feeds
/categories/{slug}/feed
/categories/web-development/feed

# Tags
/tags/{slug}
/tags/react
/tags/performance-optimization

# Tag combinations (for advanced filtering)
/tags/{tag1}+{tag2}
/tags/react+typescript
```

### 3. Author Profiles
```bash
# Author profile page
/authors/{username}
/authors/john-doe
/authors/jane-smith

# Author's posts
/authors/{username}/posts
/authors/john-doe/posts

# Author RSS feed
/authors/{username}/feed
/authors/john-doe/feed
```

### 4. Static Pages
```bash
# Core pages
/about
/contact
/privacy-policy
/terms-of-service
/sitemap

# Content pages
/resources
/case-studies
/newsletter
```

### 5. Search & Archive
```bash
# Search results
/search?q={query}
/search?q=nextjs+tutorial

# Archive pages
/archive/{year}
/archive/2024

/archive/{year}/{month}
/archive/2024/03

# Archive RSS
/archive/{year}/feed
/archive/2024/feed
```

### 6. Dashboard & Admin
```bash
# User dashboard
/dashboard
/dashboard/profile
/dashboard/posts
/dashboard/analytics

# Admin sections (role-based)
/dashboard/admin
/dashboard/admin/users
/dashboard/admin/content
/dashboard/admin/settings

# Content management
/dashboard/posts/new
/dashboard/posts/{post-id}/edit
/dashboard/posts/drafts
```

### 7. Authentication
```bash
# Auth pages
/auth/signin
/auth/signup
/auth/forgot-password
/auth/reset-password
/auth/verify-email

# OAuth callbacks
/auth/callback/google
/auth/callback/github
```

## API Endpoint Conventions

### REST API Structure
```bash
# Base API path
/api/v1/{resource}

# Blog posts
GET    /api/v1/posts                    # List posts
GET    /api/v1/posts/{id}               # Get post by ID
GET    /api/v1/posts/slug/{slug}        # Get post by slug
POST   /api/v1/posts                    # Create post
PUT    /api/v1/posts/{id}               # Update post
DELETE /api/v1/posts/{id}               # Delete post

# Categories
GET    /api/v1/categories               # List categories
GET    /api/v1/categories/{slug}/posts  # Posts in category

# Search
GET    /api/v1/search?q={query}         # Search content
GET    /api/v1/search/suggestions?q={query} # Search suggestions

# Analytics
GET    /api/v1/analytics/posts/{id}     # Post analytics
GET    /api/v1/analytics/overview       # Dashboard overview
```

### GraphQL Endpoints
```bash
# GraphQL endpoint
/api/graphql

# GraphQL playground (development only)
/api/graphql/playground
```

## Implementation Examples

### 1. Blog Post URL Generation
```typescript
// Example post titles and their generated slugs
const examples = [
  {
    title: "Getting Started with Next.js 14: A Complete Guide",
    slug: "getting-started-with-nextjs-14-complete-guide",
    url: "/blog/getting-started-with-nextjs-14-complete-guide"
  },
  {
    title: "Why TypeScript is Essential for Modern Web Development",
    slug: "why-typescript-essential-modern-web-development", 
    url: "/blog/why-typescript-essential-modern-web-development"
  },
  {
    title: "10 React Performance Optimization Techniques",
    slug: "10-react-performance-optimization-techniques",
    url: "/blog/10-react-performance-optimization-techniques"
  }
];
```

### 2. Category Structure
```typescript
const categoryExamples = [
  {
    name: "Web Development",
    slug: "web-development",
    url: "/categories/web-development"
  },
  {
    name: "Artificial Intelligence", 
    slug: "artificial-intelligence",
    url: "/categories/artificial-intelligence"
  },
  {
    name: "DevOps & Cloud",
    slug: "devops-cloud",
    url: "/categories/devops-cloud"
  }
];
```

### 3. Duplicate Slug Handling
```typescript
// Handle duplicate slugs with incremental suffixes
function ensureUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

// Examples:
// "react-tutorial" -> "react-tutorial"
// "react-tutorial" (duplicate) -> "react-tutorial-2" 
// "react-tutorial" (duplicate) -> "react-tutorial-3"
```

## SEO Considerations

### 1. URL Structure Benefits
- **Keyword Inclusion**: URLs contain relevant keywords for better ranking
- **User Experience**: Readable URLs improve click-through rates
- **Social Sharing**: Descriptive URLs perform better on social media
- **Crawlability**: Simple structure helps search engine indexing

### 2. Canonical URLs
```html
<!-- Always specify canonical URL to prevent duplicate content issues -->
<link rel="canonical" href="https://thecorporateblog.com/blog/react-performance-tips" />
```

### 3. URL Parameters for SEO
```bash
# SEO-friendly pagination
/blog?page=2&category=web-development

# SEO-friendly filtering  
/categories/react?sort=popular&year=2024

# Avoid session IDs and tracking parameters in canonical URLs
```

### 4. Redirect Strategy
```typescript
// Handle old URL formats with 301 redirects
const redirectMap = {
  // Old format -> New format
  "/post/123/react-tutorial": "/blog/react-tutorial",
  "/category/web-dev": "/categories/web-development",
  "/author/john": "/authors/john-doe"
};
```

### 5. Structured Data Integration
```typescript
// URL structure should support structured data
const structuredData = {
  "@context": "https://schema.org",
  "@type": "BlogPosting", 
  "url": `https://thecorporateblog.com/blog/${post.slug}`,
  "author": {
    "@type": "Person",
    "url": `https://thecorporateblog.com/authors/${author.username}`
  }
};
```

## Migration & Maintenance

### 1. URL Change Process
1. **Plan**: Document all URL changes and create redirect mapping
2. **Implement**: Update internal links and navigation
3. **Redirect**: Set up 301 redirects for old URLs
4. **Monitor**: Track 404 errors and fix broken links
5. **Update**: Notify search engines via sitemaps

### 2. Slug Validation
```typescript
// Validation rules for slugs
const slugValidation = {
  minLength: 3,
  maxLength: 60,
  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  blacklist: ['admin', 'api', 'www', 'mail', 'ftp', 'dashboard']
};
```

### 3. Performance Monitoring
- Monitor page load speeds for different URL patterns
- Track bounce rates by URL structure
- Analyze click-through rates from search results
- Monitor crawl errors in search console

---

**Last Updated**: March 2026  
**Version**: 1.0  
**Maintainer**: The Corporate Blog Development Team