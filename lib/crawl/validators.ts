/**
 * Crawl Validators
 * 
 * Specialized validation functions for crawl results:
 * - Link validation (broken links, redirect chains)
 * - Canonical validation (correctness, chains, duplicates)
 * - Structured data validation (Article, Breadcrumb, FAQ schemas)
 */

// ============================================================================
// LINK VALIDATION
// ============================================================================

export interface LinkValidationResult {
  url: string;
  statusCode: number;
  isValid: boolean;
  isBroken: boolean;
  isRedirect: boolean;
  redirectChain?: string[];
  issues: string[];
  lastModified?: string;
  contentType?: string;
}

export class LinkValidator {
  private cache = new Map<string, LinkValidationResult>();

  async validateLink(url: string): Promise<LinkValidationResult> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    const result: LinkValidationResult = {
      url,
      statusCode: 0,
      isValid: true,
      isBroken: false,
      isRedirect: false,
      issues: [],
    };

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (SiteCrawler)',
        },
        signal: AbortSignal.timeout(10000),
      });

      result.statusCode = response.status;
      result.isBroken = response.status >= 400;
      result.isValid = response.status < 400;
      result.lastModified = response.headers.get('last-modified') || undefined;
      result.contentType = response.headers.get('content-type') || undefined;

      // Check for redirect chains (more than 2 hops is suspicious)
      if (response.redirected) {
        result.isRedirect = true;
        // Note: Fetch API doesn't expose redirect chain details
        // This would need to be tracked at crawl time
        result.issues.push('Link redirects (check for long redirect chains)');
      }

      if (result.statusCode === 404) {
        result.issues.push('Link returns 404 Not Found');
      } else if (result.statusCode === 410) {
        result.issues.push('Link returns 410 Gone');
      } else if (result.statusCode >= 500) {
        result.issues.push(`Server error: HTTP ${result.statusCode}`);
      } else if (result.statusCode >= 400) {
        result.issues.push(`HTTP ${result.statusCode}`);
      }
    } catch (error) {
      result.statusCode = 0;
      result.isBroken = true;
      result.isValid = false;
      result.issues.push((error as Error).message);
    }

    this.cache.set(url, result);
    return result;
  }

  async validateLinks(urls: string[]): Promise<LinkValidationResult[]> {
    // Validate in parallel with rate limiting
    const results: LinkValidationResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((url) => this.validateLink(url)));
      results.push(...batchResults);
    }

    return results;
  }
}

// ============================================================================
// CANONICAL VALIDATION
// ============================================================================

export interface CanonicalValidationResult {
  url: string;
  declaredCanonical?: string;
  suggestedCanonical?: string;
  isValid: boolean;
  issues: string[];
}

export class CanonicalValidator {
  /**
   * Validate canonical tag on a page
   */
  validateCanonical(
    pageUrl: string,
    declaredCanonical?: string,
    htmlTitle?: string
  ): CanonicalValidationResult {
    const result: CanonicalValidationResult = {
      url: pageUrl,
      declaredCanonical,
      isValid: true,
      issues: [],
    };

    if (!declaredCanonical) {
      result.issues.push('Missing canonical tag');
      result.suggestedCanonical = this.normalizeSuggestedCanonical(pageUrl);
      return result;
    }

    const normalizedUrl = this.normalizeForComparison(pageUrl);
    const normalizedCanonical = this.normalizeForComparison(declaredCanonical);

    // Check self-referential
    if (normalizedUrl === normalizedCanonical) {
      // This is correct (self-referential canonical is valid)
      return result;
    }

    // Check for canonical to different domain
    try {
      const urlDomain = new URL(pageUrl).hostname;
      const canonicalDomain = new URL(declaredCanonical).hostname;

      if (urlDomain !== canonicalDomain) {
        result.issues.push(`Canonical points to different domain: ${canonicalDomain}`);
        result.isValid = false;
      }
    } catch {
      result.issues.push('Invalid canonical URL format');
      result.isValid = false;
    }

    // Check for common mistakes
    if (declaredCanonical.includes('?')) {
      result.issues.push('Canonical includes query parameters (usually avoid)');
    }

    if (declaredCanonical.includes('#')) {
      result.issues.push('Canonical includes fragment (always avoid)');
      result.isValid = false;
    }

    // Check for http/https mismatch
    const pageProtocol = new URL(pageUrl).protocol;
    const canonicalProtocol = new URL(declaredCanonical).protocol;

    if (pageProtocol !== canonicalProtocol) {
      result.issues.push(`Protocol mismatch: page is ${pageProtocol}, canonical is ${canonicalProtocol}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Detect canonical chains (A -> B -> C)
   */
  detectCanonicalChains(
    pages: Array<{ url: string; canonicalUrl?: string }>
  ): Array<{ chain: string[]; issues: string[] }> {
    const chains: Array<{ chain: string[]; issues: string[] }> = [];
    const visited = new Set<string>();

    for (const page of pages) {
      if (!page.canonicalUrl || visited.has(page.url)) {
        continue;
      }

      const chain = [page.url];
      let current = page.canonicalUrl;
      const maxDepth = 10;

      for (let i = 0; i < maxDepth; i++) {
        if (chain.includes(current)) {
          // Circular reference
          chains.push({
            chain,
            issues: ['Circular canonical reference detected'],
          });
          break;
        }

        chain.push(current);

        // Find what current canonical points to
        const nextPage = pages.find((p) => p.url === current);
        if (!nextPage?.canonicalUrl || nextPage.canonicalUrl === current) {
          // End of chain
          break;
        }

        current = nextPage.canonicalUrl;
      }

      // Flag chains longer than 1 hop (A -> B is ok if B is self-referential, A -> B -> C is bad)
      if (chain.length > 2) {
        chains.push({
          chain,
          issues: [`Canonical chain detected: ${chain.join(' -> ')}`],
        });
      }

      visited.add(page.url);
    }

    return chains;
  }

  /**
   * Check for duplicate content via canonical
   */
  detectDuplicateContentViaCanonical(
    pages: Array<{ url: string; title?: string; canonicalUrl?: string }>
  ): Array<{ canonical: string; pages: string[]; count: number }> {
    const groupedByCanonical = new Map<string, string[]>();

    for (const page of pages) {
      const canonical = page.canonicalUrl || page.url;
      const group = groupedByCanonical.get(canonical) || [];
      group.push(page.url);
      groupedByCanonical.set(canonical, group);
    }

    // Find canonicals with multiple pages pointing to them
    const duplicates: Array<{ canonical: string; pages: string[]; count: number }> = [];

    for (const [canonical, pageUrls] of groupedByCanonical.entries()) {
      if (pageUrls.length > 1) {
        duplicates.push({
          canonical,
          pages: pageUrls,
          count: pageUrls.length,
        });
      }
    }

    return duplicates;
  }

  private normalizeForComparison(url: string): string {
    try {
      const u = new URL(url);
      // Remove trailing slash, trailing index.html, and fragments
      let path = u.pathname.replace(/\/index\.(html|php)$/, '').replace(/\/$/, '');
      if (path === '' || path === '/') path = '/';
      return `${u.protocol}//${u.hostname}${path}${u.search}`;
    } catch {
      return url;
    }
  }

  private normalizeSuggestedCanonical(url: string): string {
    try {
      const u = new URL(url);
      // Remove trailing slash and fragments
      let path = u.pathname.replace(/\/$/, '');
      if (path === '') path = '/';
      return `${u.protocol}//${u.hostname}${path}${u.search ? u.search : ''}`;
    } catch {
      return url;
    }
  }
}

// ============================================================================
// STRUCTURED DATA VALIDATION
// ============================================================================

export interface SchemaValidationIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface StructuredDataValidationResult {
  url: string;
  schemas: any[];
  hasArticleSchema: boolean;
  hasBreadcrumbSchema: boolean;
  hasFaqSchema: boolean;
  hasOrganizationSchema: boolean;
  issues: SchemaValidationIssue[];
}

export class StructuredDataValidator {
  /**
   * Validate all structured data on a page
   */
  validatePageStructuredData(
    url: string,
    schemas: any[] = []
  ): StructuredDataValidationResult {
    const result: StructuredDataValidationResult = {
      url,
      schemas,
      hasArticleSchema: false,
      hasBreadcrumbSchema: false,
      hasFaqSchema: false,
      hasOrganizationSchema: false,
      issues: [],
    };

    // Check schema types
    const types = new Set(schemas.map((s) => s['@type']).filter(Boolean));

    result.hasArticleSchema = types.has('Article') || types.has('BlogPosting');
    result.hasBreadcrumbSchema = types.has('BreadcrumbList');
    result.hasFaqSchema = types.has('FAQPage');
    result.hasOrganizationSchema = types.has('Organization') || types.has('LocalBusiness');

    // Validate Article schema
    if (result.hasArticleSchema) {
      const articleSchema = schemas.find((s) => s['@type'] === 'Article' || s['@type'] === 'BlogPosting');
      if (articleSchema) {
        this.validateArticleSchema(articleSchema, result);
      }
    }

    // Validate BreadcrumbList schema
    if (result.hasBreadcrumbSchema) {
      const breadcrumbSchema = schemas.find((s) => s['@type'] === 'BreadcrumbList');
      if (breadcrumbSchema) {
        this.validateBreadcrumbSchema(breadcrumbSchema, result);
      }
    }

    // Validate FAQPage schema
    if (result.hasFaqSchema) {
      const faqSchema = schemas.find((s) => s['@type'] === 'FAQPage');
      if (faqSchema) {
        this.validateFaqSchema(faqSchema, result);
      }
    }

    return result;
  }

  private validateArticleSchema(schema: any, result: StructuredDataValidationResult): void {
    // Required fields
    const requiredFields = ['headline', '@context', '@type'];
    for (const field of requiredFields) {
      if (!schema[field]) {
        result.issues.push({
          type: 'Article',
          severity: 'error',
          message: `Missing required field: ${field}`,
        });
      }
    }

    // Recommended fields
    const recommendedFields = ['author', 'datePublished', 'dateModified', 'image', 'description'];
    for (const field of recommendedFields) {
      if (!schema[field]) {
        result.issues.push({
          type: 'Article',
          severity: 'warning',
          message: `Missing recommended field: ${field}`,
        });
      }
    }

    // Validate author
    if (schema.author) {
      if (Array.isArray(schema.author)) {
        for (const author of schema.author) {
          if (author['@type'] !== 'Person' && author['@type'] !== 'Organization') {
            result.issues.push({
              type: 'Article',
              severity: 'warning',
              message: `Author should have @type of Person or Organization`,
            });
          }
          if (!author.name) {
            result.issues.push({
              type: 'Article',
              severity: 'error',
              message: `Author missing name`,
            });
          }
        }
      } else if (typeof schema.author === 'object') {
        if (!schema.author.name) {
          result.issues.push({
            type: 'Article',
            severity: 'error',
            message: `Author missing name`,
          });
        }
      }
    }

    // Validate dates
    if (schema.datePublished && !this.isValidISODate(schema.datePublished)) {
      result.issues.push({
        type: 'Article',
        severity: 'error',
        message: `Invalid datePublished format: ${schema.datePublished}`,
      });
    }

    if (schema.dateModified && !this.isValidISODate(schema.dateModified)) {
      result.issues.push({
        type: 'Article',
        severity: 'error',
        message: `Invalid dateModified format: ${schema.dateModified}`,
      });
    }
  }

  private validateBreadcrumbSchema(schema: any, result: StructuredDataValidationResult): void {
    if (!schema.itemListElement || !Array.isArray(schema.itemListElement)) {
      result.issues.push({
        type: 'BreadcrumbList',
        severity: 'error',
        message: 'Missing or invalid itemListElement array',
      });
      return;
    }

    if (schema.itemListElement.length < 2) {
      result.issues.push({
        type: 'BreadcrumbList',
        severity: 'warning',
        message: 'BreadcrumbList should contain at least 2 items',
      });
    }

    for (let i = 0; i < schema.itemListElement.length; i++) {
      const item = schema.itemListElement[i];

      if (item.position !== i + 1) {
        result.issues.push({
          type: 'BreadcrumbList',
          severity: 'error',
          message: `Item at index ${i} has incorrect position (expected ${i + 1}, got ${item.position})`,
        });
      }

      if (!item.name) {
        result.issues.push({
          type: 'BreadcrumbList',
          severity: 'error',
          message: `Breadcrumb item ${i + 1} missing name`,
        });
      }

      if (!item.item) {
        result.issues.push({
          type: 'BreadcrumbList',
          severity: 'error',
          message: `Breadcrumb item ${i + 1} missing item URL`,
        });
      }
    }
  }

  private validateFaqSchema(schema: any, result: StructuredDataValidationResult): void {
    if (!schema.mainEntity || !Array.isArray(schema.mainEntity)) {
      result.issues.push({
        type: 'FAQPage',
        severity: 'error',
        message: 'Missing or invalid mainEntity array',
      });
      return;
    }

    if (schema.mainEntity.length === 0) {
      result.issues.push({
        type: 'FAQPage',
        severity: 'error',
        message: 'FAQPage mainEntity array is empty',
      });
    }

    if (schema.mainEntity.length > 50) {
      result.issues.push({
        type: 'FAQPage',
        severity: 'warning',
        message: `FAQPage contains ${schema.mainEntity.length} items (max 50 recommended)`,
      });
    }

    for (let i = 0; i < schema.mainEntity.length; i++) {
      const item = schema.mainEntity[i];

      if (item['@type'] !== 'Question') {
        result.issues.push({
          type: 'FAQPage',
          severity: 'error',
          message: `FAQ item ${i + 1} has @type ${item['@type']}, expected Question`,
        });
      }

      if (!item.name) {
        result.issues.push({
          type: 'FAQPage',
          severity: 'error',
          message: `FAQ question ${i + 1} missing name`,
        });
      }

      if (!item.acceptedAnswer || !item.acceptedAnswer.text) {
        result.issues.push({
          type: 'FAQPage',
          severity: 'error',
          message: `FAQ answer ${i + 1} missing acceptedAnswer.text`,
        });
      }
    }
  }

  private isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  }
}
