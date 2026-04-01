#!/usr/bin/env node

/**
 * Full-Site Crawl Validator
 * 
 * Comprehensive SEO crawl with:
 * - Link validation (broken links)
 * - Orphan page detection
 * - Canonical correctness
 * - Structured data validation (Article, Breadcrumb, FAQ)
 * - Full HTML reports
 * 
 * Usage:
 *   npm run crawl -- [OPTIONS]
 *   npm run crawl -- --url http://localhost:3000
 *   npm run crawl -- --url https://example.com --report html
 *   npm run crawl -- --sitemapUrl ~/sitemap.xml
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { SiteCrawler, CrawlReport } from '../lib/crawl/crawler.js';
import { LinkValidator, CanonicalValidator, StructuredDataValidator } from '../lib/crawl/validators.js';

const program = new Command();

program
  .name('crawl')
  .description('Full-site SEO crawl and validation')
  .version('1.0.0');

program
  .option('-u, --url <url>', 'Base URL to crawl', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  .option('-r, --report <type>', 'Report format: text, json, html', 'text')
  .option('-o, --output <path>', 'Output directory for reports', './crawl-reports')
  .option('--max-pages <number>', 'Maximum pages to crawl', '1000')
  .option('--validate-external', 'Validate external links', false)
  .action(async (options) => {
    await runCrawl(options);
  });

program.parse(process.argv);

// ============================================================================
// CRAWL EXECUTION
// ============================================================================

async function runCrawl(options: any) {
  const baseUrl = options.url;
  const reportFormat = options.report;
  const outputDir = options.output;
  const validateExternal = options.validateExternal;

  console.log('\n' + chalk.blue.bold('🕷️  Site Crawl & SEO Validation\n'));
  console.log(chalk.gray(`Base URL: ${baseUrl}`));
  console.log(chalk.gray(`Report format: ${reportFormat}`));
  console.log(chalk.gray(`Output: ${outputDir}\n`));

  let spinner = ora('Initializing crawl...').start();

  try {
    // Create crawler
    const crawler = new SiteCrawler(baseUrl);

    // Run crawl
    spinner.text = 'Discovering pages...';
    const report = await crawler.crawl();
    spinner.succeed(`Discovered ${report.totalPages} pages`);

    // Validate canonicals
    spinner = ora('Validating canonical tags...').start();
    const canonicalValidator = new CanonicalValidator();
    for (const page of report.pages) {
      const validation = canonicalValidator.validateCanonical(page.url, page.canonicalUrl, page.title);
      if (!validation.isValid) {
        page.issues.push(...validation.issues.map((issue) => ({
          type: 'canonical' as const,
          severity: 'error' as const,
          message: issue,
        })));
      }
    }
    spinner.succeed('Canonical tags validated');

    // Validate structured data
    spinner = ora('Validating structured data...').start();
    const schemaValidator = new StructuredDataValidator();
    for (const page of report.pages) {
      const validation = schemaValidator.validatePageStructuredData(page.url, page.structuredData);
      page.issues.push(...validation.issues);
    }
    spinner.succeed('Structured data validated');

    // Validate external links
    if (validateExternal) {
      spinner = ora('Validating external links...').start();
      const linkValidator = new LinkValidator();
      const externalLinks = report.links.filter((l) => !l.isInternal).map((l) => l.to);
      const uniqueLinks = Array.from(new Set(externalLinks));
      const validations = await linkValidator.validateLinks(uniqueLinks);

      for (const result of validations) {
        const link = report.links.find((l) => l.to === result.url);
        if (link) {
          link.statusCode = result.statusCode;
          link.isBroken = result.isBroken;
          link.issues = result.issues;
        }
      }

      spinner.succeed('External links validated');
    }

    // Generate reports
    await fs.mkdir(outputDir, { recursive: true });

    if (reportFormat === 'text' || reportFormat === 'all') {
      spinner = ora('Generating text report...').start();
      const textReport = generateTextReport(report);
      const textPath = path.join(outputDir, 'crawl-report.txt');
      await fs.writeFile(textPath, textReport);
      spinner.succeed(`Text report: ${textPath}`);
    }

    if (reportFormat === 'json' || reportFormat === 'all') {
      spinner = ora('Generating JSON report...').start();
      const jsonPath = path.join(outputDir, 'crawl-report.json');
      await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
      spinner.succeed(`JSON report: ${jsonPath}`);
    }

    if (reportFormat === 'html' || reportFormat === 'all') {
      spinner = ora('Generating HTML report...').start();
      const htmlReport = generateHtmlReport(report);
      const htmlPath = path.join(outputDir, 'crawl-report.html');
      await fs.writeFile(htmlPath, htmlReport);
      spinner.succeed(`HTML report: ${htmlPath}`);
    }

    // Print summary
    printSummary(report);
  } catch (error) {
    spinner.fail('Crawl failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

// ============================================================================
// TEXT REPORT
// ============================================================================

function generateTextReport(report: CrawlReport): string {
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push('SEO CRAWL REPORT');
  lines.push('═'.repeat(80));
  lines.push('');

  // Summary
  lines.push(`Crawl Date: ${report.crawlStarted.toLocaleString()}`);
  lines.push(`Duration: ${Math.round((report.crawlCompleted.getTime() - report.crawlStarted.getTime()) / 1000)}s`);
  lines.push(`Base URL: ${report.baseUrl}`);
  lines.push('');

  lines.push('SUMMARY');
  lines.push('─'.repeat(80));
  lines.push(`Pages Scanned: ${report.summary.pagesScanned}`);
  lines.push(`Links Checked: ${report.summary.linksChecked}`);
  lines.push(`Broken Links: ${report.summary.brokenLinks}`);
  lines.push(`Orphan Pages: ${report.summary.orphanPages}`);
  lines.push(`Canonical Errors: ${report.summary.canonicalErrors}`);
  lines.push(`Schema Errors: ${report.summary.schemaErrors}`);
  lines.push(`Critical Issues: ${report.summary.criticalIssues}`);
  lines.push(`Warnings: ${report.summary.warnings}`);
  lines.push('');

  // Broken Links
  if (report.summary.brokenLinks > 0) {
    lines.push('BROKEN LINKS');
    lines.push('─'.repeat(80));
    const brokenLinks = report.links.filter((l) => l.isBroken);
    for (const link of brokenLinks.slice(0, 20)) {
      lines.push(`${link.to} (${link.statusCode})`);
      if (link.issues.length > 0) {
        lines.push(`  Issues: ${link.issues.join(', ')}`);
      }
    }
    if (brokenLinks.length > 20) {
      lines.push(`... and ${brokenLinks.length - 20} more`);
    }
    lines.push('');
  }

  // Orphan Pages
  if (report.orphanPages.length > 0) {
    lines.push('ORPHAN PAGES');
    lines.push('─'.repeat(80));
    for (const page of report.orphanPages.slice(0, 20)) {
      lines.push(`${page}`);
    }
    if (report.orphanPages.length > 20) {
      lines.push(`... and ${report.orphanPages.length - 20} more`);
    }
    lines.push('');
  }

  // Canonical Issues
  const canonicalIssues = report.canonicalIssues.filter((i) => i.severity === 'error');
  if (canonicalIssues.length > 0) {
    lines.push('CANONICAL ISSUES');
    lines.push('─'.repeat(80));
    for (const issue of canonicalIssues.slice(0, 20)) {
      lines.push(`${issue.message}`);
    }
    if (canonicalIssues.length > 20) {
      lines.push(`... and ${canonicalIssues.length - 20} more`);
    }
    lines.push('');
  }

  // Schema Issues
  const schemaIssues = report.structureIssues.filter((i) => i.severity === 'error');
  if (schemaIssues.length > 0) {
    lines.push('SCHEMA/STRUCTURE ISSUES');
    lines.push('─'.repeat(80));
    for (const issue of schemaIssues.slice(0, 20)) {
      lines.push(`${issue.message}`);
    }
    if (schemaIssues.length > 20) {
      lines.push(`... and ${schemaIssues.length - 20} more`);
    }
    lines.push('');
  }

  // Pages with issues
  const pagesWithIssues = report.pages.filter((p) => p.issues.length > 0);
  if (pagesWithIssues.length > 0) {
    lines.push('PAGES WITH ISSUES');
    lines.push('─'.repeat(80));
    for (const page of pagesWithIssues.slice(0, 20)) {
      lines.push(`${page.url}`);
      for (const issue of page.issues) {
        lines.push(`  [${issue.severity.toUpperCase()}] ${issue.message}`);
      }
    }
    if (pagesWithIssues.length > 20) {
      lines.push(`... and ${pagesWithIssues.length - 20} more pages`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// HTML REPORT
// ============================================================================

function generateHtmlReport(report: CrawlReport): string {
  const brokenLinks = report.links.filter((l) => l.isBroken);
  const canonicalErrors = report.canonicalIssues.filter((i) => i.severity === 'error');
  const schemaErrors = report.structureIssues.filter((i) => i.severity === 'error');
  const pagesWithErrors = report.pages.filter((p) => p.issues.some((i) => i.severity === 'error'));

  const statusColor = (severity: number) => {
    if (severity === 0) return '#4caf50'; // green
    if (severity < 5) return '#ff9800'; // orange
    return '#f44336'; // red
  };

  const getStatusIcon = (severity: number) => {
    if (severity === 0) return '✅';
    if (severity < 5) return '⚠️';
    return '❌';
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Crawl Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      background: white;
      padding: 30px;
      boundary-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #1a73e8;
    }
    
    .metadata {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
      font-size: 14px;
      color: #666;
    }
    
    .metric {
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 4px solid #1a73e8;
    }
    
    .metric-label {
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .metric-value {
      font-size: 20px;
      font-weight: bold;
      color: #1a73e8;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    
    .summary-card {
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    }
    
    .summary-card.pass {
      background: #e8f5e9;
      border: 1px solid #4caf50;
    }
    
    .summary-card.warning {
      background: #fff3e0;
      border: 1px solid #ff9800;
    }
    
    .summary-card.error {
      background: #ffebee;
      border: 1px solid #f44336;
    }
    
    .summary-card-label {
      font-size: 12px;
      color: #666;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .summary-card-value {
      font-size: 24px;
      font-weight: bold;
    }
    
    .section {
      background: white;
      padding: 25px;
      margin-bottom: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      border-bottom: 2px solid #1a73e8;
      padding-bottom: 10px;
    }
    
    .issue-list {
      list-style: none;
    }
    
    .issue-item {
      padding: 12px;
      margin-bottom: 10px;
      border-left: 4px solid #ff9800;
      background: #fffbf0;
      border-radius: 4px;
    }
    
    .issue-item.error {
      border-left-color: #f44336;
      background: #ffebee;
    }
    
    .issue-item.info {
      border-left-color: #2196f3;
      background: #e3f2fd;
    }
    
    .issue-item-label {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 5px;
    }
    
    .issue-item-message {
      font-size: 13px;
      color: #666;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    
    th {
      background: #f5f5f5;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #ddd;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #eee;
    }
    
    tr:hover {
      background: #f9f9f9;
    }
    
    .url {
      color: #1a73e8;
      word-break: break-all;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    
    .status-ok { color: #4caf50; }
    .status-warning { color: #ff9800; }
    .status-error { color: #f44336; }
    
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge.error { background: #ffcdd2; color: #c62828; }
    .badge.warning { background: #ffe0b2; color: #e65100; }
    .badge.info { background: #bbdefb; color: #1565c0; }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    
    footer {
      text-align: center;
      padding: 20px;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🕷️ SEO Crawl Report</h1>
      <p>${report.baseUrl}</p>
      
      <div class="summary-grid">
        <div class="summary-card ${report.summary.brokenLinks === 0 ? 'pass' : 'error'}">
          <div class="summary-card-label">Broken Links</div>
          <div class="summary-card-value">${report.summary.brokenLinks}</div>
        </div>
        <div class="summary-card ${report.summary.orphanPages === 0 ? 'pass' : 'warning'}">
          <div class="summary-card-label">Orphan Pages</div>
          <div class="summary-card-value">${report.summary.orphanPages}</div>
        </div>
        <div class="summary-card ${report.summary.canonicalErrors === 0 ? 'pass' : 'error'}">
          <div class="summary-card-label">Canonical Errors</div>
          <div class="summary-card-value">${report.summary.canonicalErrors}</div>
        </div>
        <div class="summary-card ${report.summary.schemaErrors === 0 ? 'pass' : 'warning'}">
          <div class="summary-card-label">Schema Errors</div>
          <div class="summary-card-value">${report.summary.schemaErrors}</div>
        </div>
      </div>
      
      <div class="metadata">
        <div class="metric">
          <div class="metric-label">Pages Scanned</div>
          <div class="metric-value">${report.summary.pagesScanned}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Links Checked</div>
          <div class="metric-value">${report.summary.linksChecked}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Crawl Status</div>
          <div class="metric-value" style="color: ${statusColor(report.summary.criticalIssues)}">
            ${getStatusIcon(report.summary.criticalIssues)} ${report.summary.criticalIssues === 0 ? 'PASS' : 'NEEDS FIXES'}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Scan Date</div>
          <div style="color: #666">${report.crawlStarted.toLocaleString()}</div>
        </div>
      </div>
    </header>
    
    ${
      brokenLinks.length > 0
        ? `
    <div class="section">
      <h2>🔗 Broken Links (${brokenLinks.length})</h2>
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>Status</th>
            <th>Issue</th>
          </tr>
        </thead>
        <tbody>
          ${brokenLinks
            .slice(0, 50)
            .map(
              (link) => `
          <tr>
            <td class="url">${escapeHtml(link.to)}</td>
            <td><span class="badge error">${link.statusCode || 'Error'}</span></td>
            <td>${escapeHtml(link.issues.join(', '))}</td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      ${brokenLinks.length > 50 ? `<p style="margin-top: 15px; color: #999;">... and ${brokenLinks.length - 50} more</p>` : ''}
    </div>
    `
        : ''
    }
    
    ${
      report.orphanPages.length > 0
        ? `
    <div class="section">
      <h2>👻 Orphan Pages (${report.orphanPages.length})</h2>
      <p style="margin-bottom: 15px; color: #666;">Pages not linked from any other page:</p>
      <ul class="issue-list">
        ${report.orphanPages
          .slice(0, 20)
          .map((url) => `<li class="issue-item"><span class="url">${escapeHtml(url)}</span></li>`)
          .join('')}
      </ul>
      ${report.orphanPages.length > 20 ? `<p style="margin-top: 15px; color: #999;">... and ${report.orphanPages.length - 20} more</p>` : ''}
    </div>
    `
        : ''
    }
    
    ${
      canonicalErrors.length > 0
        ? `
    <div class="section">
      <h2>📍 Canonical Issues (${canonicalErrors.length})</h2>
      <ul class="issue-list">
        ${canonicalErrors
          .slice(0, 20)
          .map((issue) => `<li class="issue-item error"><span class="issue-item-message">${escapeHtml(issue.message)}</span></li>`)
          .join('')}
      </ul>
      ${canonicalErrors.length > 20 ? `<p style="margin-top: 15px; color: #999;">... and ${canonicalErrors.length - 20} more</p>` : ''}
    </div>
    `
        : ''
    }
    
    ${
      schemaErrors.length > 0
        ? `
    <div class="section">
      <h2>📋 Schema/Structure Issues (${schemaErrors.length})</h2>
      <ul class="issue-list">
        ${schemaErrors
          .slice(0, 20)
          .map((issue) => `<li class="issue-item error"><span class="issue-item-message">${escapeHtml(issue.message)}</span></li>`)
          .join('')}
      </ul>
      ${schemaErrors.length > 20 ? `<p style="margin-top: 15px; color: #999;">... and ${schemaErrors.length - 20} more</p>` : ''}
    </div>
    `
        : ''
    }
    
    <div class="section">
      <h2>📊 Detailed Crawl Results</h2>
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>Status</th>
            <th>Title</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          ${report.pages
            .slice(0, 100)
            .map(
              (page) => `
          <tr>
            <td class="url">${escapeHtml(page.url)}</td>
            <td><span class="badge ${page.statusCode === 200 ? '' : 'error'}">${page.statusCode}</span></td>
            <td>${escapeHtml(page.title || '-')}</td>
            <td>
              ${
                page.issues.length > 0
                  ? `<span class="badge error">${page.issues.length} issues</span>`
                  : '<span class="badge" style="background: #e8f5e9; color: #2e7d32;">OK</span>'
              }
            </td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      ${report.pages.length > 100 ? `<p style="margin-top: 15px; color: #999;">... and ${report.pages.length - 100} more pages</p>` : ''}
    </div>
    
    <footer>
      Generated: ${new Date().toLocaleString()} | Base URL: ${report.baseUrl}
    </footer>
  </div>
</body>
</html>
  `;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================================================
// SUMMARY PRINT
// ============================================================================

function printSummary(report: CrawlReport) {
  console.log('\n' + chalk.green.bold('✅ CRAWL COMPLETE\n'));

  const statusCircle = (count: number) => {
    if (count === 0) return chalk.green('●');
    if (count < 5) return chalk.yellow('●');
    return chalk.red('●');
  };

  console.log(chalk.bold('Summary\n'));
  console.log(`${statusCircle(report.summary.brokenLinks)} Broken Links: ${report.summary.brokenLinks}`);
  console.log(`${statusCircle(report.summary.orphanPages)} Orphan Pages: ${report.summary.orphanPages}`);
  console.log(`${statusCircle(report.summary.canonicalErrors)} Canonical Errors: ${report.summary.canonicalErrors}`);
  console.log(`${statusCircle(report.summary.schemaErrors)} Schema Errors: ${report.summary.schemaErrors}`);
  console.log(`\nPages Scanned: ${report.summary.pagesScanned}`);
  console.log(`Links Checked: ${report.summary.linksChecked}`);

  if (report.summary.criticalIssues === 0) {
    console.log('\n' + chalk.green.bold('🎉 All critical checks passed!'));
  } else {
    console.log('\n' + chalk.yellow.bold(`⚠️  ${report.summary.criticalIssues} critical issues found`));
  }

  console.log('');
}
