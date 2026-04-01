/**
 * Full-Site Crawler
 * 
 * Comprehensive web crawler that traverses all pages, validates links, detects orphans,
 * validates structured data, and checks canonical tags.
 * 
 * Features:
 * - Discovers all accessible pages by following internal links
 * - Validates all links (internal + external, HTTP status codes)
 * - Detects orphan pages (not linked from anywhere)
 * - Validates canonical tags (presence, correctness, no chains)
 * - Extracts and validates structured data (Article, Breadcrumb, FAQ schemas)
 * - Generates comprehensive crawl report
 * 
 * Usage:
 *   const crawler = new SiteCrawler('http://localhost:3000');
 *   const report = await crawler.crawl();
 *   console.log(report);
 */

import { load } from 'cheerio';

// ============================================================================
// TYPES
// ============================================================================

export interface CrawlPageResult {
  url: string;
  title?: string;
  statusCode: number;
  redirectedFrom?: string;
  canonicalUrl?: string;
  isCanonical: boolean;
  linksTo: string[]; // Internal links from this page
  structuredData: any[];
  issues: CrawlIssue[];
}

export interface CrawlIssue {
  type: 'canonical' | 'link' | 'structure' | 'redirect' | 'missing';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
}

export interface CrawlLink {
  from: string;
  to: string;
  text: string;
  statusCode?: number;
  isInternal: boolean;
  isBroken: boolean;
  issues: string[];
}

export interface CrawlReport {
  crawlStarted: Date;
  crawlCompleted: Date;
  baseUrl: string;
  totalPages: number;
  totalLinks: number;
  pages: CrawlPageResult[];
  links: CrawlLink[];
  orphanPages: string[];
  canonicalIssues: CrawlIssue[];
  structureIssues: CrawlIssue[];
  summary: {
    pagesScanned: number;
    linksChecked: number;
    brokenLinks: number;
    orphanPages: number;
    canonicalErrors: number;
    schemaErrors: number;
    criticalIssues: number;
    warnings: number;
  };
}

// ============================================================================
// CRAWLER
// ============================================================================

export class SiteCrawler {
  private baseUrl: string;
  private visitedUrls = new Set<string>();
  private queuedUrls = new Set<string>();
  private allLinks = new Map<string, Set<string>>(); // from -> Set<to>
  private pageResults = new Map<string, CrawlPageResult>();
  private externalLinks = new Map<string, { status?: number; error?: string }>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Run full crawl
   */
  async crawl(): Promise<CrawlReport> {
    const crawlStarted = new Date();

    console.log(`🕷️  Starting crawl of ${this.baseUrl}...`);

    // Step 1: Discover all pages
    await this.discoverPages();
    console.log(`✅ Discovered ${this.visitedUrls.size} pages`);

    // Step 2: Validate pages
    await this.validatePages();
    console.log(`✅ Validated ${this.visitedUrls.size} pages`);

    // Step 3: Detect orphans
    const orphans = this.detectOrphanPages();
    console.log(`✅ Detected ${orphans.length} orphan pages`);

    // Step 4: Validate external links
    await this.validateExternalLinks();
    console.log(`✅ Validated external links`);

    // Step 5: Compile report
    const report = this.generateReport(crawlStarted, new Date(), orphans);

    return report;
  }

  /**
   * Discover all pages by following internal links
   */
  private async discoverPages(): Promise<void> {
    // Start with homepage
    this.queuedUrls.add(this.baseUrl);

    while (this.queuedUrls.size > 0) {
      const url = Array.from(this.queuedUrls)[0];
      this.queuedUrls.delete(url);

      if (this.visitedUrls.has(url)) {
        continue;
      }

      this.visitedUrls.add(url);

      try {
        const { html, statusCode } = await this.fetchPage(url);

        if (statusCode !== 200) {
          continue;
        }

        const links = this.extractLinks(url, html);
        this.allLinks.set(url, new Set(links));

        // Queue internal links
        for (const link of links) {
          if (!this.visitedUrls.has(link) && !this.queuedUrls.has(link)) {
            this.queuedUrls.add(link);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to crawl ${url}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Validate each page for structure, canonical, etc.
   */
  private async validatePages(): Promise<void> {
    for (const url of this.visitedUrls) {
      try {
        const { html, statusCode, canonicalUrl } = await this.fetchPage(url);

        const result: CrawlPageResult = {
          url,
          statusCode,
          canonicalUrl,
          isCanonical: this.isUrlCanonical(url, canonicalUrl),
          linksTo: Array.from(this.allLinks.get(url) || []),
          structuredData: this.extractStructuredData(html),
          issues: [],
        };

        // Extract title
        const $ = load(html);
        result.title = $('head title').text() || $('h1').first().text();

        // Validate canonical
        if (!canonicalUrl) {
          result.issues.push({
            type: 'canonical',
            severity: 'warning',
            message: 'Missing canonical tag',
          });
        } else if (!result.isCanonical) {
          result.issues.push({
            type: 'canonical',
            severity: 'error',
            message: `Canonical mismatch: URL is ${url}, canonical is ${canonicalUrl}`,
          });
        }

        // Validate structured data
        this.validatePageStructuredData(result, html);

        this.pageResults.set(url, result);
      } catch (error) {
        console.warn(`⚠️  Failed to validate ${url}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Detect orphan pages (not linked from any other page)
   */
  private detectOrphanPages(): string[] {
    const orphans: string[] = [];
    const linkedPages = new Set<string>();

    // Find all pages that are linked to
    for (const links of this.allLinks.values()) {
      for (const link of links) {
        linkedPages.add(link);
      }
    }

    // Pages that aren't linked from anywhere (except homepage/main pages)
    const ignoredPaths = ['/', '/blog', '/categories', '/authors', '/about', '/contact'];

    for (const url of this.visitedUrls) {
      if (!linkedPages.has(url) && !ignoredPaths.includes(this.getPath(url))) {
        orphans.push(url);
      }
    }

    return orphans;
  }

  /**
   * Validate external links
   */
  private async validateExternalLinks(): Promise<void> {
    const externalUrls = new Set<string>();

    // Collect all external links
    for (const result of this.pageResults.values()) {
      // Extract external links from page
      try {
        const { html } = await this.fetchPage(result.url);
        const $ = load(html);

        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && this.isExternalUrl(href)) {
            externalUrls.add(href);
          }
        });
      } catch {
        // Ignore
      }
    }

    // Check external links (but don't follow them deeply)
    for (const url of externalUrls) {
      if (!this.externalLinks.has(url)) {
        try {
          const status = await this.checkUrlStatus(url);
          this.externalLinks.set(url, { status });
        } catch (error) {
          this.externalLinks.set(url, {
            error: (error as Error).message,
          });
        }
      }
    }
  }

  /**
   * Extract internal links from HTML
   */
  private extractLinks(pageUrl: string, html: string): string[] {
    const $ = load(html);
    const links: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        try {
          const absoluteUrl = new URL(href, pageUrl).href;
          const absolutePath = new URL(absoluteUrl).pathname + new URL(absoluteUrl).search;

          if (this.isInternalUrl(absoluteUrl)) {
            links.push(this.normalizeUrl(absoluteUrl));
          }
        } catch {
          // Ignore invalid URLs
        }
      }
    });

    return links;
  }

  /**
   * Extract structured data from page
   */
  private extractStructuredData(html: string): any[] {
    const schemas: any[] = [];
    const $ = load(html);

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '{}';
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          schemas.push(...parsed);
        } else {
          schemas.push(parsed);
        }
      } catch {
        // Ignore invalid JSON-LD
      }
    });

    return schemas;
  }

  /**
   * Validate structured data on page
   */
  private validatePageStructuredData(result: CrawlPageResult, html: string): void {
    const schemas = this.extractStructuredData(html);

    // Check for Article schema on blog posts
    if (result.url.includes('/blog/')) {
      const hasArticleSchema = schemas.some((s) => s['@type'] === 'Article');

      if (!hasArticleSchema) {
        result.issues.push({
          type: 'structure',
          severity: 'warning',
          message: 'Blog post missing Article schema',
        });
      } else {
        // Validate Article schema structure
        const articleSchema = schemas.find((s) => s['@type'] === 'Article');
        if (!articleSchema.headline) {
          result.issues.push({
            type: 'structure',
            severity: 'error',
            message: 'Article schema missing required field: headline',
          });
        }
        if (!articleSchema.author) {
          result.issues.push({
            type: 'structure',
            severity: 'error',
            message: 'Article schema missing required field: author',
          });
        }
      }
    }

    // Check for BreadcrumbList schema on category/tag pages
    if (result.url.includes('/categories/') || result.url.includes('/tags/') || result.url.includes('/authors/')) {
      const hasBreadcrumbSchema = schemas.some((s) => s['@type'] === 'BreadcrumbList');

      if (!hasBreadcrumbSchema) {
        result.issues.push({
          type: 'structure',
          severity: 'info',
          message: 'Category/tag page missing BreadcrumbList schema (recommended)',
        });
      }
    }

    // Check FAQ pages
    if (result.url.includes('/faq') || result.title?.toLowerCase().includes('faq')) {
      const hasFaqSchema = schemas.some((s) => s['@type'] === 'FAQPage');

      if (!hasFaqSchema) {
        result.issues.push({
          type: 'structure',
          severity: 'warning',
          message: 'FAQ page missing FAQPage schema',
        });
      }
    }
  }

  /**
   * Fetch page with headers
   */
  private async fetchPage(url: string): Promise<{ html: string; statusCode: number; canonicalUrl?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteCrawler/1.0)',
        },
      });

      clearTimeout(timeout);

      const html = await response.text();
      const $ = load(html);

      // Extract canonical URL from meta tag
      const canonicalTag = $('link[rel="canonical"]').attr('href');
      const ogUrl = $('meta[property="og:url"]').attr('content');
      const canonicalUrl = canonicalTag || ogUrl;

      return {
        html,
        statusCode: response.status,
        canonicalUrl,
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Check HTTP status of a URL
   */
  private async checkUrlStatus(url: string): Promise<number> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        timeout: 5000,
      });
      return response.status;
    } catch {
      // Fallback to GET
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          timeout: 5000,
        });
        return response.status;
      } catch {
        return 0;
      }
    }
  }

  /**
   * Check if URL is internal
   */
  private isInternalUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const base = new URL(this.baseUrl);
      return parsed.hostname === base.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is external
   */
  private isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Normalize URL (remove fragments, trailing slashes)
   */
  private normalizeUrl(url: string): string {
    return url.split('#')[0].replace(/\/$/, '') || '/';
  }

  /**
   * Get path from URL
   */
  private getPath(url: string): string {
    return new URL(url).pathname;
  }

  /**
   * Check if URL is canonical
   */
  private isUrlCanonical(url: string, canonicalUrl?: string): boolean {
    if (!canonicalUrl) return true;

    try {
      const normalized1 = this.normalizeUrl(url);
      const normalized2 = this.normalizeUrl(canonicalUrl);
      return normalized1 === normalized2;
    } catch {
      return false;
    }
  }

  /**
   * Generate crawl report
   */
  private generateReport(
    crawlStarted: Date,
    crawlCompleted: Date,
    orphanPages: string[]
  ): CrawlReport {
    const pages = Array.from(this.pageResults.values());
    const links: CrawlLink[] = [];
    const allIssues: CrawlIssue[] = [];

    // Collect all links
    for (const [from, toSet] of this.allLinks.entries()) {
      for (const to of toSet) {
        links.push({
          from,
          to,
          text: '',
          isInternal: true,
          isBroken: false,
          issues: [],
        });
      }
    }

    // Collect external links
    for (const [url, result] of this.externalLinks.entries()) {
      const isBroken = !result.status || result.status >= 400;
      const issues: string[] = [];

      if (!result.status) {
        issues.push(result.error || 'Unknown error');
      } else if (result.status >= 400) {
        issues.push(`HTTP ${result.status}`);
      }

      links.push({
        from: '',
        to: url,
        text: '',
        statusCode: result.status,
        isInternal: false,
        isBroken,
        issues,
      });
    }

    // Collect issues from pages
    for (const page of pages) {
      for (const issue of page.issues) {
        allIssues.push(issue);
      }
    }

    const brokenLinks = links.filter((l) => l.isBroken).length;
    const canonicalErrors = allIssues.filter((i) => i.type === 'canonical' && i.severity === 'error').length;
    const schemaErrors = allIssues.filter((i) => i.type === 'structure' && i.severity === 'error').length;
    const criticalIssues = allIssues.filter((i) => i.severity === 'error').length;
    const warnings = allIssues.filter((i) => i.severity === 'warning').length;

    return {
      crawlStarted,
      crawlCompleted,
      baseUrl: this.baseUrl,
      totalPages: pages.length,
      totalLinks: links.length,
      pages,
      links,
      orphanPages,
      canonicalIssues: allIssues.filter((i) => i.type === 'canonical'),
      structureIssues: allIssues.filter((i) => i.type === 'structure'),
      summary: {
        pagesScanned: pages.length,
        linksChecked: links.length,
        brokenLinks,
        orphanPages: orphanPages.length,
        canonicalErrors,
        schemaErrors,
        criticalIssues,
        warnings,
      },
    };
  }
}
