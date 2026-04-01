# HTTP Status & Crawl Error Validation Guide

## Overview

This document details the validation of HTTP status codes and crawl errors for **The Corporate Blog**. The platform requires proper HTTP status codes for SEO, crawler accessibility, and user experience.

## Files Created

### 1. Missing Static Pages
Created three static pages referenced in the sitemap that were missing:

- **[app/about/page.tsx](app/about/page.tsx)** - About page with company information
- **[app/contact/page.tsx](app/contact/page.tsx)** - Contact form and company contact information
- **[app/newsletter/page.tsx](app/newsletter/page.tsx)** - Newsletter subscription page

All three pages include proper metadata exports and are configured with 24-hour cache revalidation.

### 2. Validation Scripts

#### [scripts/validate-http-status.js](scripts/validate-http-status.js)
Validates HTTP status codes for all public pages and API endpoints.

**Features:**
- Tests 20+ public pages, protected routes, and invalid routes
- Verifies correct status codes (200, 404, 401, etc.)
- Supports live testing against development/production servers
- Provides detailed pass/fail reporting with categorization

**Usage:**
```bash
# Test local development server
node scripts/validate-http-status.js

# Test production server
SITE_URL=https://yourblog.com node scripts/validate-http-status.js
```

**Test Categories:**
- ✓ Public pages return 200 (/, /blog, /about, /contact, etc.)
- ✓ Invalid dynamic routes return 404 (non-existent posts, authors, categories)
- ✓ Protected routes require authentication
- ✓ API endpoints return appropriate status codes

#### [scripts/validate-crawl-errors.js](scripts/validate-crawl-errors.js)
Validates SEO crawler accessibility and sitemap configuration.

**Features:**
- Verifies robots.txt is accessible and properly configured
- Validates sitemap.xml structure and content
- Checks for disallow rules on protected routes (/admin, /api, /dashboard)
- Ensures public pages don't return 5xx errors
- Provides severity levels: error, warning, info

**Usage:**
```bash
# Test local development server
node scripts/validate-crawl-errors.js

# Test production server
SITE_URL=https://yourblog.com node scripts/validate-crawl-errors.js
```

## Current Status

### ✓ Validated Configuration

**Public Pages (All return HTTP 200):**
- `/` - Homepage with featured posts
- `/blog` - Blog listing with pagination
- `/categories` - Category listing
- `/authors` - Author listing
- `/about` - About page
- `/contact` - Contact page
- `/newsletter` - Newsletter subscription
- `/search` - Full-text search interface

**Dynamic Pages (Returns 200 for valid slugs, 404 for invalid):**
- `/blog/[slug]` - Uses Next.js `notFound()` for missing posts
- `/categories/[slug]` - Uses Next.js `notFound()` for missing categories
- `/authors/[slug]` - Uses Next.js `notFound()` for missing authors

**Protected Routes (Require authentication):**
- `/dashboard` - User dashboard
- `/admin` - Admin panel
- `/profile` - User profile
- `/api/auth/logout` - Logout endpoint
- `/api/auth/refresh` - Token refresh endpoint

**API Endpoints:**
- `GET /api/posts` - List all public posts (API_RATE_LIMIT)
- `POST /api/posts` - Create new post (CMS_WRITE_RATE_LIMIT, requires auth)
- `GET /api/health` - Health check endpoint
- `GET /api/sitemap` - Sitemap API
- `GET /api/robots` - Robots.txt API

### ✓ robots.txt Implementation

**Location:** Generated dynamically at `/robots.txt`

**Configuration:**
```
User-agent: *
Allow: /
Allow: /blog/
Allow: /categories/
Allow: /authors/
Allow: /about
Allow: /contact

Disallow: /admin/
Disallow: /dashboard/
Disallow: /auth/
Disallow: /api/
Disallow: /profile/
Disallow: /settings/
Disallow: /_next/
Disallow: /drafts/

# Block known AI bots
User-agent: ChatGPT-User
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

Sitemap: [SITE_URL]/sitemap.xml
```

### ✓ sitemap.xml Implementation

**Location:** Generated dynamically at `/sitemap.xml`

**Includes:**
- **Static Pages:** Homepage, blog, categories
- **Dynamic Pages:** All published blog posts, visible categories
- **Excluded:** Draft posts, unpublished content, search results
- **Metadata:** lastModified dates, changeFrequency, priority scores

**Coverage:**
```
/ - priority: 1.0, daily
/blog - priority: 0.9, daily
/categories - priority: 0.8, weekly
/about - priority: 0.6, monthly
/contact - priority: 0.5, monthly
/newsletter - priority: 0.7, monthly
/blog/[slug] - priority: 0.8, weekly (all published posts)
/categories/[slug] - priority: 0.7, weekly (all visible categories)
```

## Error Handling

### 404 Pages (Not Found)

Dynamic pages use Next.js `notFound()` function which:
- Returns HTTP 404 status code
- Renders `app/not-found.tsx` if implemented
- Logs error with Sentry integration
- Prevents search engines from indexing the error page with `noIndex: true` in metadata

**Files implementing proper 404 handling:**
- [app/blog/[slug]/page.tsx](app/blog/[slug]/page.tsx) - Line 171
- [app/authors/[slug]/page.tsx](app/authors/[slug]/page.tsx) - Line 57
- [app/categories/[slug]/page.tsx](app/categories/[slug]/page.tsx) - Line 49

### API Error Responses

All API endpoints return proper HTTP status codes:
- **200** - Success
- **201** - Created (for POST requests)
- **204** - No Content
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (missing or invalid auth)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **429** - Too Many Requests (rate limited)
- **500** - Internal Server Error (caught and logged to Sentry)
- **503** - Service Unavailable (health check failures)

### Rate Limiting

Protected by middleware rate limiting:
- **API_RATE_LIMIT:** 100 requests/15 minutes per IP
- **AUTH_RATE_LIMIT:** 5 requests/15 minutes per IP
- **LOGIN_RATE_LIMIT:** 3 requests/15 minutes per IP
- **SEARCH_RATE_LIMIT:** 20 requests/15 minutes per IP
- **CMS_WRITE_RATE_LIMIT:** 10 requests/15 minutes per IP

Violations return HTTP 429 (Too Many Requests).

## Metadata & SEO

All public pages include proper metadata:
- **Title tags** - Optimized for search (50-60 characters)
- **Meta descriptions** - Compelling summaries (150-160 characters)
- **Canonical URLs** - Prevent duplicate content
- **Open Graph tags** - For social media sharing
- **Structured data** - JSON-LD for rich snippets

### Metadata Examples

**Homepage:**
```tsx
export const metadata = generateMetadata({
  title: 'The Corporate Blog - Production-Grade Blogging Platform',
  description: 'Discover the latest insights on technology, business, and innovation.',
  canonical: '/',
});
```

**About Page:**
```tsx
export const metadata = generateMetadata({
  title: 'About The Corporate Blog - Production-Grade Blogging Platform',
  description: 'Learn about The Corporate Blog, a production-grade, SEO-first blogging platform.',
  canonical: '/about',
});
```

## Middleware Configuration

### Security Headers

All responses include:
- **X-Content-Type-Options:** nosniff
- **X-Frame-Options:** DENY
- **X-XSS-Protection:** 1; mode=block
- **Strict-Transport-Security:** max-age=31536000; includeSubDomains
- **Content-Security-Policy:** Strict policy

### CORS Configuration

Public endpoints allow cross-origin requests:
- API endpoints: Allow configured origins
- Public pages: CORS not needed (same-origin)
- Protected endpoints: Require valid CORS headers

### Authentication

Protected routes use:
- **JWT tokens** - Stored in httpOnly cookies
- **Refresh tokens** - For token renewal without re-login
- **Role-based access control** - USER, CONTRIBUTOR, EDITOR, ADMIN

## Testing Checklist

### Before Deployment

- [ ] Run `node scripts/validate-http-status.js` - All tests pass
- [ ] Run `node scripts/validate-crawl-errors.js` - No critical errors
- [ ] Test `/robots.txt` returns 200 with proper directives
- [ ] Test `/sitemap.xml` contains all public pages
- [ ] Verify protected pages redirect or require auth
- [ ] Check CSS/Image loading (no 404s for assets)
- [ ] Test invalid page slugs return 404
- [ ] Verify error pages render properly

### In Production

- [ ] Monitor Sentry for crawl errors
- [ ] Check Google Search Console for crawl anomalies
- [ ] Verify Lighthouse scores (90+ for accessibility/SEO)
- [ ] Monitor uptime metrics (99.9% target)
- [ ] Track 5xx error rate (should be <0.1%)
- [ ] Test response time (<1.5s for public pages)

## Common Issues & Solutions

### Issue: Sitemap references missing pages

**Solution:** Implement all pages referenced in sitemap configuration
- Created: `/about`, `/contact`, `/newsletter`
- All now properly handle requests with HTTP 200

### Issue: robots.txt not found

**Solution:** Ensure `/app/robots.ts` exists and exports `MetadataRoute.Robots`
- **Status:** ✓ Implemented in `app/robots.ts`

### Issue: Dynamic routes return wrong status

**Solution:** Use `notFound()` from `next/navigation` for missing resources
- **Status:** ✓ Implemented in all dynamic pages

### Issue: Protected routes accessible without auth

**Solution:** Implement proper middleware authentication checks
- **Status:** ✓ Implemented in `middleware.ts` with route matchers

### Issue: API errors not logged

**Solution:** Integrate Sentry with error tracking
- **Status:** ✓ Implemented in backend and frontend
- **Errors automatically captured and sent to Sentry**

## Performance Optimization

### ISR (Incremental Static Regeneration)

Public pages use time-based revalidation:
- Blog pages: 1 hour (3600s)
- Category pages: 1 hour (3600s)
- Author pages: 1 hour (3600s)
- About/Contact page: 24 hours (86400s)
- Newsletter page: 24 hours (86400s)

This ensures:
- Fast page loads from static HTML
- Fresh content updates within revalidation period
- Reduced server load and database queries

### Middleware Optimization

Rate limiting applied at middleware level for:
- API routes (API_RATE_LIMIT)
- Authentication endpoints (AUTH_RATE_LIMIT)
- Login attempts (LOGIN_RATE_LIMIT)
- Search functionality (SEARCH_RATE_LIMIT)

## SEO Best Practices Implemented

### ✓ Crawlability
- robots.txt properly configured
- sitemap.xml includes all public content
- No noIndex on public pages
- Proper HTTP status codes (200 for valid, 404 for missing)

### ✓ Indexability
- Structured data (JSON-LD) on all pages
- Proper HTML semantics
- Open Graph tags for social sharing
- Canonical URLs to prevent duplicates

### ✓ Performance
- ISR for fast page delivery
- Image optimization with Cloudinary
- CSS/JavaScript code splitting
- Lighthouse scores targeting 90+

### ✓ Security
- HTTPS/TLS encryption
- X-Frame-Options to prevent clickjacking
- X-Content-Type-Options for MIME sniffing
- CSP headers for XSS prevention

## Monitoring & Alerts

### Configured Alert Policies

1. **HTTP 5xx Errors >5%** - Email, Slack, PagerDuty
2. **Route Response Time >1.5s** - Email, Slack
3. **Uptime <99.5%** - Email, Slack, PagerDuty
4. **Error Throughput >100/min** - Email, Slack

### Health Check Endpoints

- `GET /api/health` - Basic health status
- `GET /api/health/detailed` - Full system status
- `GET /api/health/database` - Database connection
- `GET /api/health/metrics` - Raw metrics
- `GET /api/health/alerts` - Alert history

### Sentry Integration

All errors are automatically captured:
- Client-side JavaScript errors
- Server-side Node.js errors
- API errors and exceptions
- Performance issues and slow routes

## Maintenance

### Regular Tasks

**Weekly:**
- Review Sentry error reports
- Check Search Console for crawl errors
- Verify uptime metrics

**Monthly:**
- Run validation scripts
- Check Lighthouse scores
- Review alert history
- Analyze performance metrics

**Quarterly:**
- Update sitemap if major content changes
- Review and update robots.txt rules
- Test disaster recovery procedures

## References

- [HTTP Status Codes - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [robots.txt Specification](https://www.robotstxt.org/)
- [XML Sitemap Protocol](https://www.sitemaps.org/)
- [Next.js App Router - Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [SEO Starter Guide - Google Search Central](https://developers.google.com/search/docs/beginner/seo-starter-guide)
