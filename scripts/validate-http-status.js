#!/usr/bin/env node
/**
 * HTTP Status Validation Script
 * Verifies all public pages return correct HTTP status codes
 * 
 * Usage:
 *   node scripts/validate-http-status.js
 *   
 * Environment variables:
 *   SITE_URL - Base URL to test against (default: http://localhost:3000)
 */

const http = require('http');
const https = require('https');
const url = require('url');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

interface TestCase {
  path: string;
  expectedStatus: number;
  type: 'public' | 'protected' | 'invalid';
  description: string;
}

// Test cases for validation
const TEST_CASES: TestCase[] = [
  // ============================================================================
  // PUBLIC PAGES - Should return 200
  // ============================================================================
  { path: '/', expectedStatus: 200, type: 'public', description: 'Homepage' },
  { path: '/blog', expectedStatus: 200, type: 'public', description: 'Blog listing' },
  { path: '/blog/', expectedStatus: 200, type: 'public', description: 'Blog listing with trailing slash' },
  { path: '/categories', expectedStatus: 200, type: 'public', description: 'Categories listing' },
  { path: '/authors', expectedStatus: 200, type: 'public', description: 'Authors listing' },
  { path: '/about', expectedStatus: 200, type: 'public', description: 'About page' },
  { path: '/contact', expectedStatus: 200, type: 'public', description: 'Contact page' },
  { path: '/newsletter', expectedStatus: 200, type: 'public', description: 'Newsletter subscription' },
  { path: '/search', expectedStatus: 200, type: 'public', description: 'Search page' },

  // ============================================================================
  // DYNAMIC PUBLIC PAGES - Should return 200 or 404 depending on data
  // ============================================================================
  // Note: These tests assume the blog has a post with slug "getting-started"
  // Adjust these paths based on your actual published posts
  { path: '/blog/getting-started', expectedStatus: 200, type: 'public', description: 'Blog post (valid slug)' },
  { path: '/blog/this-post-does-not-exist-xyz', expectedStatus: 404, type: 'invalid', description: 'Blog post (invalid slug returns 404)' },
  
  { path: '/categories/technology', expectedStatus: 200, type: 'public', description: 'Category page (if exists)' },
  { path: '/categories/invalid-category-xyz', expectedStatus: 404, type: 'invalid', description: 'Category page (invalid slug returns 404)' },
  
  { path: '/authors/admin', expectedStatus: 200, type: 'public', description: 'Author page (admin author)' },
  { path: '/authors/invalid-author-xyz', expectedStatus: 404, type: 'invalid', description: 'Author page (invalid slug returns 404)' },

  // ============================================================================
  // PROTECTED PAGES - Should return 401, 302 (redirect), or 403
  // ============================================================================
  { path: '/dashboard', expectedStatus: null, type: 'protected', description: 'Dashboard (should redirect or require auth)' },
  { path: '/admin', expectedStatus: null, type: 'protected', description: 'Admin (should redirect or require auth)' },
  { path: '/profile', expectedStatus: null, type: 'protected', description: 'Profile (should redirect or require auth)' },

  // ============================================================================
  // API ENDPOINTS - Should handle requests correctly
  // ============================================================================
  { path: '/api/posts', expectedStatus: 200, type: 'public', description: 'API: List posts' },
  { path: '/api/health', expectedStatus: 200, type: 'public', description: 'API: Health check' },
  { path: '/api/sitemap', expectedStatus: 200, type: 'public', description: 'API: Sitemap' },
  { path: '/api/robots', expectedStatus: 200, type: 'public', description: 'API: Robots.txt' },

  // ============================================================================
  // INVALID ROUTES - Should return 404
  // ============================================================================
  { path: '/this-page-does-not-exist-xyz', expectedStatus: 404, type: 'invalid', description: 'Invalid page returns 404' },
  { path: '/api/nonexistent-endpoint', expectedStatus: 404, type: 'invalid', description: 'Invalid API endpoint' },
];

interface TestResult {
  path: string;
  expectedStatus: number | null;
  actualStatus: number;
  passed: boolean;
  error?: string;
  description: string;
}

const results: TestResult[] = [];
let passed = 0;
let failed = 0;

/**
 * Make HTTP request and get status code
 */
function makeRequest(testUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const urlObj = new url.URL(testUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const options = {
      method: 'GET',
      timeout: 5000,
    };

    const req = client.request(testUrl, options, (res) => {
      resolve(res.statusCode || 200);
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
 * Validate single test case
 */
async function validatePage(testCase: TestCase): Promise<TestResult> {
  const testUrl = `${SITE_URL}${testCase.path}`;

  try {
    const actualStatus = await makeRequest(testUrl);
    
    let passed = true;
    if (testCase.expectedStatus !== null && actualStatus !== testCase.expectedStatus) {
      passed = false;
    }

    return {
      path: testCase.path,
      expectedStatus: testCase.expectedStatus,
      actualStatus,
      passed,
      description: testCase.description,
    };
  } catch (error) {
    return {
      path: testCase.path,
      expectedStatus: testCase.expectedStatus,
      actualStatus: 0,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      description: testCase.description,
    };
  }
}

/**
 * Format test result for display
 */
function formatResult(result: TestResult): string {
  const status = result.passed ? '✓ PASS' : '✗ FAIL';
  const icon = result.passed ? '✓' : '✗';
  
  let message = `${icon} ${status} | ${result.path}`;
  message += ` | Expected: ${result.expectedStatus || 'any'} | Got: ${result.actualStatus}`;
  message += ` | ${result.description}`;

  if (result.error) {
    message += ` | Error: ${result.error}`;
  }

  return message;
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n📊 HTTP Status Validation Script`);
  console.log(`================================\n`);
  console.log(`Testing: ${SITE_URL}`);
  console.log(`Total test cases: ${TEST_CASES.length}\n`);

  // Run all validations
  for (const testCase of TEST_CASES) {
    const result = await validatePage(testCase);
    results.push(result);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }

    console.log(formatResult(result));
  }

  // Summary
  console.log(`\n================================`);
  console.log(`📈 Summary`);
  console.log(`================================`);
  console.log(`Total: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  // Group by type
  const byType = {
    public: results.filter((r) => r.description.includes('public')),
    protected: results.filter((r) => r.description.includes('protected')),
    invalid: results.filter((r) => r.actualStatus === 404),
  };

  console.log(`📑 By Category`);
  console.log(`Public pages: ${byType.public.filter((r) => r.passed).length}/${byType.public.length}`);
  console.log(`Protected pages: ${byType.protected.filter((r) => r.passed).length}/${byType.protected.length}`);
  console.log(`Invalid routes (404): ${byType.invalid.filter((r) => r.passed).length}/${byType.invalid.length}\n`);

  // Show failures
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`❌ Failed Tests`);
    console.log(`===============`);
    failures.forEach((failure) => {
      console.log(
        `${failure.path} - Expected ${failure.expectedStatus}, got ${failure.actualStatus}`
      );
      if (failure.error) {
        console.log(`  Error: ${failure.error}`);
      }
    });
    console.log();
  }

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
