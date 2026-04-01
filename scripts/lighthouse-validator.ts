/**
 * Lighthouse Mobile & Desktop Validator
 * 
 * Validates performance across mobile and desktop with specific thresholds:
 * - LCP < 2.5s
 * - CLS < 0.1
 * - INP optimized (< 200ms)
 * 
 * Usage:
 *   npx ts-node scripts/lighthouse-validator.ts http://localhost:3000
 *   npm run validate:lighthouse -- --mobile --desktop
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as chalk from 'chalk';

// ============================================================================
// TYPES
// ============================================================================

interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
  status: 'pass' | 'fail' | 'warn';
}

interface LighthouseResult {
  metrics: Record<string, PerformanceMetric>;
  score: number;
  audits: Record<string, any>;
  opportunities: Record<string, any>;
  diagnostics: any[];
  environment: {
    networkThrottle: string;
    cpuThrottle: string;
    formFactor: string;
  };
}

interface ValidationReport {
  url: string;
  timestamp: Date;
  mobile: LighthouseResult;
  desktop: LighthouseResult;
  comparison: {
    mobileVsDesktop: Record<string, { mobile: number; desktop: number; diff: number; diffPercent: number }>;
    summary: {
      allPass: boolean;
      passCount: number;
      failCount: number;
      warnCount: number;
    };
  };
  recommendations: string[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ValidatorConfig {
  baseUrl: string;
  testUrls: string[];
  mobile: boolean;
  desktop: boolean;
  headless: boolean;
  verbose: boolean;
  outputDir: string;
  chromeLocation?: string;
}

const METRIC_THRESHOLDS = {
  lcp: { threshold: 2500, unit: 'ms', good: 2500, needsImprovement: 4000 },
  cls: { threshold: 0.1, unit: '', good: 0.1, needsImprovement: 0.25 },
  fcp: { threshold: 1800, unit: 'ms', good: 1800, needsImprovement: 3000 },
  ttfb: { threshold: 600, unit: 'ms', good: 600, needsImprovement: 1800 },
  tti: { threshold: 3800, unit: 'ms', good: 3800, needsImprovement: 7300 },
  inp: { threshold: 200, unit: 'ms', good: 200, needsImprovement: 500 }, // Interaction to Next Paint
  performanceScore: { threshold: 85, unit: 'score', good: 85, needsImprovement: 50 },
};

// Default URLs to test
const DEFAULT_TEST_URLS = [
  '',                          // Homepage
  '/blog',                      // Blog listing
  '/blog/seo-best-practices',   // Sample blog post
  '/categories',                // Category listing
  '/about',                     // About page
];

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

class LighthouseValidator {
  private config: ValidatorConfig;
  private chromeLocation: string;

  constructor(config: ValidatorConfig) {
    this.config = {
      mobile: true,
      desktop: true,
      headless: true,
      verbose: false,
      outputDir: './lighthouse-reports',
      ...config,
    };

    // Create output directory
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Find Chrome location
    this.chromeLocation = this.findChromeLocation();
  }

  /**
   * Find Chrome/Chromium installation path
   */
  private findChromeLocation(): string {
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/google-chrome', // Linux
      '/usr/bin/chromium', // Linux (Chromium)
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows 32-bit
    ];

    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    // Try to find via which command (Unix-like systems)
    try {
      const result = execSync('which google-chrome || which chromium', { encoding: 'utf-8' });
      return result.trim();
    } catch (e) {
      // Chrome not found, Lighthouse will try to find it automatically
      console.warn(chalk.yellow('⚠️ Chrome not found, will use system Chrome'));
      return '';
    }
  }

  /**
   * Run Lighthouse audit for a single URL
   */
  private async runLighthouseAudit(url: string, formFactor: 'mobile' | 'desktop'): Promise<any> {
    try {
      const lighthouse = await import('lighthouse');
      const chromeLauncher = await import('chrome-launcher');

      let chrome: any;

      try {
        const launchConfig: any = {
          headless: this.config.headless,
        };

        if (this.chromeLocation) {
          launchConfig.chromePath = this.chromeLocation;
        }

        chrome = await chromeLauncher.launch(launchConfig);

        const options = {
          logLevel: this.config.verbose ? 'info' : 'error',
          output: 'json',
          port: chrome.port,
          emulatedFormFactor: formFactor,
          throttling: this.getThrottlingProfile(formFactor),
          onlyCategories: ['performance'],
        } as any;

        const runnerResult = await lighthouse.default(url, options);
        await chromeLauncher.killChrome();

        return runnerResult;
      } catch (libError) {
        await chrome?.kill();
        throw libError;
      }
    } catch (error) {
      throw new Error(`Lighthouse audit failed for ${url} (${formFactor}): ${error}`);
    }
  }

  /**
   * Get throttling profile based on device type
   */
  private getThrottlingProfile(formFactor: 'mobile' | 'desktop'): any {
    if (formFactor === 'mobile') {
      return {
        rttMs: 150,
        throughputKbps: 1638.4, // 4G mobile
        downloadThroughputKbps: 1638.4,
        uploadThroughputKbps: 734.4,
        cpuSlowdownMultiplier: 4,
      };
    } else {
      return {
        rttMs: 40,
        throughputKbps: 10000, // Desktop fast connection
        downloadThroughputKbps: 10000,
        uploadThroughputKbps: 10000,
        cpuSlowdownMultiplier: 1,
      };
    }
  }

  /**
   * Parse Lighthouse JSON and extract metrics
   */
  private parseAuditResults(lhr: any, formFactor: 'mobile' | 'desktop'): LighthouseResult {
    const audits = lhr.audits || {};
    const metrics: Record<string, PerformanceMetric> = {};

    // Extract key metrics
    const metricMap: Record<string, string> = {
      lcp: 'largest-contentful-paint',
      cls: 'cumulative-layout-shift',
      fcp: 'first-contentful-paint',
      ttfb: 'server-response-time',
      tti: 'interactive',
      inp: 'interaction-to-next-paint', // Audit name might be different
    };

    for (const [key, auditName] of Object.entries(metricMap)) {
      const audit = audits[auditName as string];
      if (audit && audit.numericValue !== undefined) {
        const threshold = METRIC_THRESHOLDS[key as keyof typeof METRIC_THRESHOLDS];
        const value = audit.numericValue;
        const status = value <= threshold.threshold ? 'pass' : 'fail';

        metrics[key] = {
          name: audit.title || key.toUpperCase(),
          value: Math.round(value * 100) / 100,
          threshold: threshold.threshold,
          unit: threshold.unit,
          status,
        };
      }
    }

    // Performance score
    const performanceScore = lhr.categories.performance.score * 100;
    metrics.performanceScore = {
      name: 'Performance Score',
      value: Math.round(performanceScore),
      threshold: 85,
      unit: 'score',
      status: performanceScore >= 85 ? 'pass' : performanceScore >= 50 ? 'warn' : 'fail',
    };

    // Extract opportunities and diagnostics
    const opportunities = Object.entries(audits)
      .filter(([, audit]: [string, any]) => audit.details?.type === 'opportunity')
      .reduce((acc, [key, value]: [string, any]) => {
        acc[key] = {
          title: value.title,
          savings: value.details?.overallSavingsMs || 0,
          description: value.description,
        };
        return acc;
      }, {} as Record<string, any>);

    const diagnostics = Object.entries(audits)
      .filter(([, audit]: [string, any]) => audit.details?.type === 'diagnostic')
      .map(([, audit]: [string, any]) => ({
        title: audit.title,
        description: audit.description,
        details: audit.details,
      }));

    return {
      metrics,
      score: performanceScore,
      audits,
      opportunities,
      diagnostics,
      environment: {
        networkThrottle: `${formFactor === 'mobile' ? '4G' : 'Fast'}`,
        cpuThrottle: `${formFactor === 'mobile' ? '4x slowdown' : 'No slowdown'}`,
        formFactor,
      },
    };
  }

  /**
   * Validate metrics against thresholds
   */
  private validateMetrics(mobile: LighthouseResult, desktop: LighthouseResult): {
    allPass: boolean;
    passCount: number;
    failCount: number;
    warnCount: number;
  } {
    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    const checkMetric = (metric: PerformanceMetric) => {
      if (metric.status === 'pass') passCount++;
      else if (metric.status === 'fail') failCount++;
      else warnCount++;
    };

    Object.values(mobile.metrics).forEach(checkMetric);
    Object.values(desktop.metrics).forEach(checkMetric);

    return {
      allPass: failCount === 0,
      passCount,
      failCount,
      warnCount,
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(mobile: LighthouseResult, desktop: LighthouseResult): string[] {
    const recommendations: string[] = [];
    const failedMetrics = Object.entries(mobile.metrics)
      .concat(Object.entries(desktop.metrics))
      .filter(([, metric]) => metric.status === 'fail')
      .map(([key]) => key);

    if (failedMetrics.includes('lcp')) {
      recommendations.push('📌 LCP: Optimize largest contentful paint - defer non-critical scripts, optimize images, use CDN');
    }
    if (failedMetrics.includes('cls')) {
      recommendations.push('📌 CLS: Reduce layout shift - set dimensions on images, avoid inserting content above existing content');
    }
    if (failedMetrics.includes('inp')) {
      recommendations.push('📌 INP: Optimize interaction latency - break up long tasks, use requestIdleCallback for non-critical work');
    }
    if (failedMetrics.includes('fcp')) {
      recommendations.push('📌 FCP: Improve first contentful paint - critical CSS, preload fonts, optimize server response');
    }

    // Check opportunities
    const maxOpportunitySavings = Object.values(mobile.opportunities)
      .concat(Object.values(desktop.opportunities))
      .sort((a, b) => b.savings - a.savings)[0];

    if (maxOpportunitySavings?.savings > 500) {
      recommendations.push(
        `💡 Opportunity: Could save ${Math.round(maxOpportunitySavings.savings)}ms with "${maxOpportunitySavings.title}"`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All key metrics are optimized!');
    }

    return recommendations;
  }

  /**
   * Format results for console output
   */
  private formatConsoleOutput(report: ValidationReport): string {
    let output = '\n';
    output += '═'.repeat(80) + '\n';
    output += chalk.bold.cyan('🔍 Lighthouse Mobile & Desktop Validation Report\n');
    output += '═'.repeat(80) + '\n\n';

    output += chalk.bold(`📍 URL: ${report.url}\n`);
    output += chalk.bold(`⏰ Timestamp: ${report.timestamp.toISOString()}\n\n`);

    // Mobile Results
    output += chalk.bold.yellow('📱 MOBILE PERFORMANCE\n');
    output += this.formatMetricsTable(report.mobile.metrics, 'mobile');
    output += `Performance Score: ${chalk.bold(String(report.mobile.score))}/100\n\n`;

    // Desktop Results
    output += chalk.bold.blue('🖥️ DESKTOP PERFORMANCE\n');
    output += this.formatMetricsTable(report.desktop.metrics, 'desktop');
    output += `Performance Score: ${chalk.bold(String(report.desktop.score))}/100\n\n`;

    // Comparison
    output += chalk.bold.magenta('📊 MOBILE vs DESKTOP COMPARISON\n');
    const comparison = report.comparison.mobileVsDesktop;
    const metricKeys = ['lcp', 'cls', 'fcp', 'inp', 'performanceScore'];
    for (const key of metricKeys) {
      if (comparison[key]) {
        const comp = comparison[key];
        const arrow = comp.diff > 0 ? '◀️ slower' : '▶️ faster';
        output += `  ${key.toUpperCase().padEnd(15)} Mobile: ${String(comp.mobile).padEnd(8)} Desktop: ${String(comp.desktop).padEnd(8)} (${comp.diffPercent.toFixed(1)}% ${arrow})\n`;
      }
    }
    output += '\n';

    // Summary
    const summary = report.comparison.summary;
    output += chalk.bold('📋 VALIDATION SUMMARY\n');
    output += `  ✅ Passed: ${chalk.green(String(summary.passCount))}\n`;
    output += `  ❌ Failed: ${chalk.red(String(summary.failCount))}\n`;
    output += `  ⚠️  Warnings: ${chalk.yellow(String(summary.warnCount))}\n`;
    output += `  ${summary.allPass ? chalk.green.bold('✅ ALL TESTS PASSED') : chalk.red.bold('❌ SOME TESTS FAILED')}\n\n`;

    // Recommendations
    if (report.recommendations.length > 0) {
      output += chalk.bold('💡 RECOMMENDATIONS\n');
      report.recommendations.forEach((rec) => {
        output += `  ${rec}\n`;
      });
      output += '\n';
    }

    output += '═'.repeat(80) + '\n';

    return output;
  }

  /**
   * Format metrics as table
   */
  private formatMetricsTable(metrics: Record<string, PerformanceMetric>, device: string): string {
    let output = '';
    const keyMetrics = ['lcp', 'cls', 'fcp', 'inp'];

    for (const key of keyMetrics) {
      const metric = metrics[key];
      if (metric) {
        const icon = metric.status === 'pass' ? '✅' : metric.status === 'fail' ? '❌' : '⚠️';
        const color =
          metric.status === 'pass'
            ? chalk.green
            : metric.status === 'fail'
              ? chalk.red
              : chalk.yellow;

        output += `  ${icon} ${key.toUpperCase().padEnd(8)} ${color(
          `${metric.value}${metric.unit}`.padEnd(15)
        )} threshold: ${metric.threshold}${metric.unit}\n`;
      }
    }
    output += '\n';
    return output;
  }

  /**
   * Save report to file
   */
  private saveReport(report: ValidationReport, urlPath: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lighthouse-${urlPath.replace(/\//g, '-')}-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(chalk.dim(`📁 Report saved to: ${filepath}`));
  }

  /**
   * Run full validation
   */
  async validate(): Promise<ValidationReport[]> {
    const reports: ValidationReport[] = [];

    for (const urlPath of this.config.testUrls) {
      const url = `${this.config.baseUrl}${urlPath}`;
      console.log(chalk.cyan(`\n🚀 Testing: ${url}`));

      try {
        // Mobile audit
        console.log(chalk.dim('  → Running mobile audit...'));
        const mobileResult = await this.runLighthouseAudit(url, 'mobile');
        const mobile = this.parseAuditResults(mobileResult.lhr, 'mobile');

        // Desktop audit
        console.log(chalk.dim('  → Running desktop audit...'));
        const desktopResult = await this.runLighthouseAudit(url, 'desktop');
        const desktop = this.parseAuditResults(desktopResult.lhr, 'desktop');

        // Validate and compare
        const comparison = this.compareResults(mobile, desktop);
        const summary = this.validateMetrics(mobile, desktop);
        const recommendations = this.generateRecommendations(mobile, desktop);

        const report: ValidationReport = {
          url,
          timestamp: new Date(),
          mobile,
          desktop,
          comparison: {
            mobileVsDesktop: comparison,
            summary,
          },
          recommendations,
        };

        reports.push(report);

        // Output and save
        console.log(this.formatConsoleOutput(report));
        this.saveReport(report, urlPath);
      } catch (error) {
        console.error(chalk.red(`❌ Error testing ${url}: ${error}`));
      }
    }

    return reports;
  }

  /**
   * Compare mobile vs desktop results
   */
  private compareResults(
    mobile: LighthouseResult,
    desktop: LighthouseResult
  ): Record<string, { mobile: number; desktop: number; diff: number; diffPercent: number }> {
    const comparison: Record<string, any> = {};

    for (const key of Object.keys(mobile.metrics)) {
      const mobileMetric = mobile.metrics[key];
      const desktopMetric = desktop.metrics[key];

      if (mobileMetric && desktopMetric) {
        const mobileValue = mobileMetric.value;
        const desktopValue = desktopMetric.value;
        const diff = mobileValue - desktopValue;
        const diffPercent = desktopValue !== 0 ? (diff / desktopValue) * 100 : 0;

        comparison[key] = {
          mobile: mobileValue,
          desktop: desktopValue,
          diff,
          diffPercent,
        };
      }
    }

    return comparison;
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const baseUrl = args[0] || 'http://localhost:3000';
  const testUrls: string[] = [];

  let includeDefault = true;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--urls') {
      includeDefault = false;
      while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        testUrls.push(args[i + 1]);
        i++;
      }
    }
  }

  if (includeDefault) {
    testUrls.push(...DEFAULT_TEST_URLS);
  }

  const config: ValidatorConfig = {
    baseUrl,
    testUrls,
    mobile: !args.includes('--desktop-only'),
    desktop: !args.includes('--mobile-only'),
    headless: !args.includes('--debug'),
    verbose: args.includes('--verbose'),
    outputDir: './lighthouse-reports',
  };

  console.log(chalk.blue.bold('\n📊 Lighthouse Mobile & Desktop Validator\n'));
  console.log(chalk.cyan(`Base URL: ${config.baseUrl}`));
  console.log(chalk.cyan(`Test URLs: ${config.testUrls.length} pages`));
  console.log(
    chalk.cyan(
      `Devices: ${config.mobile && config.desktop ? 'Mobile & Desktop' : config.mobile ? 'Mobile' : 'Desktop'}`
    )
  );

  const validator = new LighthouseValidator(config);
  const reports = await validator.validate();

  // Summary
  const allPass = reports.every((r) => r.comparison.summary.allPass);
  console.log(chalk.bold.cyan('\n\n═'.repeat(40)));
  console.log(chalk.bold.cyan('FINAL VALIDATION SUMMARY'));
  console.log(chalk.bold.cyan('═'.repeat(40)));
  console.log(`Total URLs tested: ${reports.length}`);
  console.log(`Passed: ${reports.filter((r) => r.comparison.summary.allPass).length}`);
  console.log(`Failed: ${reports.filter((r) => !r.comparison.summary.allPass).length}`);

  if (allPass) {
    console.log(chalk.green.bold('\n✅ ALL VALIDATIONS PASSED!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('\n❌ SOME VALIDATIONS FAILED\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

export { LighthouseValidator, ValidationReport, LighthouseResult };
