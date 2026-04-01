#!/usr/bin/env node
/**
 * Crawl Error Validation Script
 * Validates robots.txt and sitemap for SEO crawler accessibility
 * 
 * Usage:
 *   node scripts/validate-crawl-errors.js
 *   
 * Environment variables:
 *   SITE_URL - Base URL to test against (default: http://localhost:3000)
 */

const http = require('http');
const https = require('https');
const url = require('url');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

interface CrawlValidation {
  test: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const validations: CrawlValidation[] = [];

/**
 * Fetch content from URL
 */
async function fetchUrl(testUrl: string): Promise<{ status: number; content: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new url.URL(testUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const options = {
      method: 'GET',
      timeout: 5000,
    };

    const req = client.request(testUrl, options, (res) => {
      let content = '';

      res.on('data', (chunk) => {
        content += chunk;
      });

      res.on('end', () => {
        resolve({ status: res.statusCode || 200, content });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Validate robots.txt
 */
async function validateRobotsTxt() {
  console.log(`\n🤖 Validating robots.txt...`);

  try {
    const { status, content } = await fetchUrl(`${SITE_URL}/robots.txt`);

    if (status === 200) {
      validations.push({
        test: 'robots.txt accessible',
        passed: true,
        message: 'robots.txt is accessible (HTTP 200)',
        severity: 'info',
      });

      // Check for common patterns
      const hasUserAgent = /User-agent/i.test(content);
      const hasDisallow = /Disallow/i.test(content);
      const hasSitemap = /Sitemap/i.test(content);
      const hasAllowBots = /User-agent:\s*\*/i.test(content);

      validations.push({
        test: 'robots.txt has User-agent directive',
        passed: hasUserAgent,
        message: hasUserAgent ? 'Found User-agent directive(s)' : 'No User-agent directive found',
        severity: 'error',
      });

      validations.push({
        test: 'robots.txt has Disallow rules',
        passed: hasDisallow,
        message: hasDisallow ? 'Found Disallow rules' : 'No Disallow rules found',
        severity: 'warning',
      });

      validations.push({
        test: 'robots.txt references sitemap',
        passed: hasSitemap,
        message: hasSitemap ? 'Sitemap reference found' : 'No Sitemap reference - crawlers may miss content',
        severity: 'warning',
      });

      validations.push({
        test: 'robots.txt allows general crawling',
        passed: hasAllowBots,
        message: hasAllowBots ? 'Allows crawlers via User-agent: *' : 'May not allow general crawling',
        severity: 'warning',
      });

      // Check for admin/api disallow
      const disallowsAdmin = /Disallow:.*\/admin/im.test(content);
      const disallowsApi = /Disallow:.*\/api/im.test(content);
      const disallowsDashboard = /Disallow:.*\/dashboard/im.test(content);

      validations.push({
        test: 'robots.txt blocks /admin from crawlers',
        passed: disallowsAdmin,
        message: disallowsAdmin ? '/admin is disallowed' : '/admin is not explicitly disallowed',
        severity: 'warning',
      });

      validations.push({
        test: 'robots.txt blocks /api from crawlers',
        passed: disallowsApi,
        message: disallowsApi ? '/api is disallowed' : '/api is not explicitly disallowed',
        severity: 'warning',
      });

      validations.push({
        test: 'robots.txt blocks /dashboard from crawlers',
        passed: disallowsDashboard,
        message: disallowsDashboard ? '/dashboard is disallowed' : '/dashboard is not explicitly disallowed',
        severity: 'warning',
      });
    } else {
      validations.push({
        test: 'robots.txt accessible',
        passed: false,
        message: `robots.txt returned HTTP ${status}`,
        severity: 'error',
      });
    }
  } catch (error) {
    validations.push({
      test: 'robots.txt accessible',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
    });
  }
}

/**
 * Validate sitemap.xml
 */
async function validateSitemap() {
  console.log(`🗺️  Validating sitemap...`);

  try {
    const { status, content } = await fetchUrl(`${SITE_URL}/sitemap.xml`);

    if (status === 200) {
      validations.push({
        test: 'sitemap.xml accessible',
        passed: true,
        message: 'sitemap.xml is accessible (HTTP 200)',
        severity: 'info',
      });

      // Count URLs in sitemap
      const urlMatches = content.match(/<url>/g);
      const urlCount = urlMatches ? urlMatches.length : 0;

      validations.push({
        test: 'sitemap.xml contains URLs',
        passed: urlCount > 0,
        message: `Found ${urlCount} URLs in sitemap`,
        severity: urlCount === 0 ? 'error' : 'info',
      });

      // Check for required elements
      const hasLocTag = /<loc>/i.test(content);
      const hasLastmodTag = /<lastmod>/i.test(content);
      const hasChangefreqTag = /<changefreq>/i.test(content);
      const hasPriorityTag = /<priority>/i.test(content);

      validations.push({
        test: 'sitemap.xml has <loc> tags',
        passed: hasLocTag,
        message: hasLocTag ? '<loc> tags found' : '<loc> tags missing',
        severity: 'error',
      });

      validations.push({
        test: 'sitemap.xml has <lastmod> tags',
        passed: hasLastmodTag,
        message: hasLastmodTag ? '<lastmod> tags found' : '<lastmod> tags missing',
        severity: 'warning',
      });

      validations.push({
        test: 'sitemap.xml has <changefreq> tags',
        passed: hasChangefreqTag,
        message: hasChangefreqTag ? '<changefreq> tags found' : '<changefreq> tags missing',
        severity: 'warning',
      });

      validations.push({
        test: 'sitemap.xml has <priority> tags',
        passed: hasPriorityTag,
        message: hasPriorityTag ? '<priority> tags found' : '<priority> tags missing',
        severity: 'warning',
      });

      // Check for valid XML structure
      const isValidXml = /<\?xml|<urlset/i.test(content) && content.includes('</urlset>');

      validations.push({
        test: 'sitemap.xml has valid XML structure',
        passed: isValidXml,
        message: isValidXml ? 'Valid XML structure detected' : 'Invalid XML structure',
        severity: 'error',
      });

      // Check for common public pages
      const hasHomepage = content.includes('</loc>') && content.split('</loc>').length > 0;
      const hasBlog = /\/blog(["\']|<)/i.test(content);
      const hasCategories = /\/categories(["\']|<)/i.test(content);

      validations.push({
        test: 'sitemap.xml includes blog pages',
        passed: hasBlog,
        message: hasBlog ? 'Blog pages included' : 'Blog pages missing',
        severity: 'warning',
      });

      validations.push({
        test: 'sitemap.xml includes category pages',
        passed: hasCategories,
        message: hasCategories ? 'Category pages included' : 'Category pages missing',
        severity: 'warning',
      });
    } else {
      validations.push({
        test: 'sitemap.xml accessible',
        passed: false,
        message: `sitemap.xml returned HTTP ${status}`,
        severity: 'error',
      });
    }
  } catch (error) {
    validations.push({
      test: 'sitemap.xml accessible',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
    });
  }
}

/**
 * Check for crawl errors in middleware
 */
async function checkMiddlewareErrors() {
  console.log(`⚙️  Checking middleware configuration...`);

  try {
    // Test that regular pages don't return 5xx errors
    const publicPages = ['/', '/blog', '/about'];

    for (const page of publicPages) {
      try {
        const { status } = await fetchUrl(`${SITE_URL}${page}`);

        const isFiveHundred = status >= 500;

        validations.push({
          test: `${page} does not return 5xx`,
          passed: !isFiveHundred,
          message: `${page} returned HTTP ${status}`,
          severity: isFiveHundred ? 'error' : 'info',
        });
      } catch (error) {
        validations.push({
          test: `${page} accessible`,
          passed: false,
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
        });
      }
    }
  } catch (error) {
    validations.push({
      test: 'middleware check',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
    });
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log(`\n🔍 Crawl Error Validation Script`);
  console.log(`================================\n`);
  console.log(`Testing: ${SITE_URL}\n`);

  await validateRobotsTxt();
  await validateSitemap();
  await checkMiddlewareErrors();

  // Summary
  const errors = validations.filter((v) => v.severity === 'error' && !v.passed);
  const warnings = validations.filter((v) => v.severity === 'warning' && !v.passed);
  const infos = validations.filter((v) => v.severity === 'info');

  console.log(`\n================================`);
  console.log(`📊 Results`);
  console.log(`================================\n`);

  validations.forEach((v) => {
    const icon = v.passed ? '✓' : '✗';
    const severity = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
    console.log(`${icon} ${severity} ${v.test}: ${v.message}`);
  });

  console.log(`\n================================`);
  console.log(`📈 Summary`);
  console.log(`================================`);
  console.log(`Total: ${validations.length}`);
  console.log(`✓ Passed: ${validations.filter((v) => v.passed).length}`);
  console.log(`🔴 Errors: ${errors.length}`);
  console.log(`🟡 Warnings: ${warnings.length}`);
  console.log(`🔵 Info: ${infos.length}\n`);

  if (errors.length > 0) {
    console.log(`❌ Critical Issues (must fix):`);
    errors.forEach((e) => {
      console.log(`  - ${e.test}: ${e.message}`);
    });
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (recommended to fix):`);
    warnings.forEach((w) => {
      console.log(`  - ${w.test}: ${w.message}`);
    });
    console.log();
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
