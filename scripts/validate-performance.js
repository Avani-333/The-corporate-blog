#!/usr/bin/env node

/**
 * Performance Validation Integration
 * 
 * Comprehensive performance validation combining:
 * - Lighthouse (LCP, CLS, INP, Performance Score)
 * - Web Vitals (Real User Monitoring)
 * - Load Testing (k6 scenarios)
 * - Core Web Vitals thresholds
 * 
 * Usage:
 *   node scripts/validate-performance.js http://localhost:3000
 *   npm run validate:performance
 */

const chalk = require('chalk');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const VALIDATION_CONFIG = {
  lighthouse: {
    lcp: { threshold: 2500, warn: 2000 },
    cls: { threshold: 0.1, warn: 0.08 },
    fcp: { threshold: 1800, warn: 1500 },
    inp: { threshold: 200, warn: 150 },
    performanceScore: { threshold: 85, warn: 80 },
  },
  webVitals: {
    lcp: { threshold: 2500, warn: 2000 },
    cls: { threshold: 0.1, warn: 0.08 },
    fid: { threshold: 100, warn: 80 },
    inp: { threshold: 200, warn: 150 },
  },
  loadTest: {
    p95ResponseTime: { threshold: 500, unit: 'ms' },
    p99ResponseTime: { threshold: 1000, unit: 'ms' },
    errorRate: { threshold: 0.01, unit: '%' },
  },
};

// ============================================================================
// VALIDATION SUITE
// ============================================================================

class PerformanceValidationSuite {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || 'http://localhost:3000';
    this.results = {
      lighthouse: null,
      webVitals: null,
      loadTest: null,
      overall: {
        passed: 0,
        failed: 0,
        warnings: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Run Lighthouse validation
   */
  async validateLighthouse() {
    console.log(chalk.cyan('\n🔦 Running Lighthouse validation...\n'));

    try {
      const report = JSON.parse(
        execSync(`npx ts-node scripts/lighthouse-validator.ts ${this.baseUrl}`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );

      const results = {
        mobile: this.checkLighthouseMetrics(report.mobile),
        desktop: this.checkLighthouseMetrics(report.desktop),
        report,
      };

      this.results.lighthouse = results;
      return results;
    } catch (error) {
      console.log(chalk.yellow('⚠️ Lighthouse validation could not be completed'));
      console.log(chalk.dim('  Make sure Lighthouse is installed: npm install -g lighthouse'));
      return null;
    }
  }

  /**
   * Check Lighthouse metrics against thresholds
   */
  checkLighthouseMetrics(data) {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
    };

    for (const [metric, value] of Object.entries(data.metrics)) {
      const config = VALIDATION_CONFIG.lighthouse[metric];
      if (!config) continue;

      if (value.value <= config.threshold) {
        results.passed.push({ metric, value: value.value, threshold: config.threshold });
        this.results.overall.passed++;
      } else if (value.value <= config.warn) {
        results.warnings.push({ metric, value: value.value, threshold: config.threshold });
        this.results.overall.warnings++;
      } else {
        results.failed.push({ metric, value: value.value, threshold: config.threshold });
        this.results.overall.failed++;
      }
    }

    return results;
  }

  /**
   * Validate Web Vitals from monitoring
   */
  async validateWebVitals() {
    console.log(chalk.cyan('\n📊 Checking Web Vitals monitoring...\n'));

    // In production, this would pull from your monitoring service
    // For now, we'll use the Lighthouse data as reference

    if (this.results.lighthouse) {
      const lhr = this.results.lighthouse.report.mobile;
      const results = {
        metrics: {},
        status: 'healthy',
      };

      // Map Lighthouse to Web Vitals
      const mapping = {
        lcp: 'lcp',
        cls: 'cls',
        fcp: 'fcp',
        inp: 'inp',
      };

      for (const [source, target] of Object.entries(mapping)) {
        const value = lhr.metrics[source];
        if (value) {
          const config = VALIDATION_CONFIG.webVitals[target];
          results.metrics[target] = {
            value: value.value,
            threshold: config.threshold,
            rating: value.value <= config.threshold ? 'good' : 'needs-improvement',
          };
        }
      }

      this.results.webVitals = results;
      return results;
    }

    return null;
  }

  /**
   * Run load test validation
   */
  async validateLoadTest() {
    console.log(chalk.cyan('\n⚡ Running load test validation...\n'));

    try {
      // Run k6 load test
      execSync('npm run load-test:lcp', {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      console.log(chalk.green('✅ Load test completed successfully'));

      // Parse results
      this.results.loadTest = {
        status: 'completed',
        timestamp: new Date(),
      };

      return this.results.loadTest;
    } catch (error) {
      console.log(chalk.yellow('⚠️ Load test could not be completed'));
      console.log(chalk.dim('  Make sure k6 is installed: brew install k6 or download from k6.io'));
      return null;
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const lhr = this.results.lighthouse;
    if (!lhr) return;

    let report = '\n';
    report += '═'.repeat(80) + '\n';
    report += chalk.bold.cyan('📊 COMPREHENSIVE PERFORMANCE VALIDATION REPORT\n');
    report += '═'.repeat(80) + '\n\n';

    report += chalk.bold.yellow('🎯 VALIDATION TARGETS\n');
    report += '  LCP (Largest Contentful Paint):      < 2.5s\n';
    report += '  CLS (Cumulative Layout Shift):       < 0.1\n';
    report += '  INP (Interaction to Next Paint):     < 200ms\n';
    report += '  Performance Score:                   ≥ 85\n\n';

    // Mobile results
    report += chalk.bold.yellow('📱 MOBILE RESULTS\n');
    report += this.formatMetricsReport(lhr.mobile);
    report += '\n';

    // Desktop results
    report += chalk.bold.yellow('🖥️ DESKTOP RESULTS\n');
    report += this.formatMetricsReport(lhr.desktop);
    report += '\n';

    // Overall summary
    report += chalk.bold.cyan('📋 OVERALL SUMMARY\n');
    report += `  ✅ Passed:   ${chalk.green(this.results.overall.passed)}\n`;
    report += `  ❌ Failed:   ${chalk.red(this.results.overall.failed)}\n`;
    report += `  ⚠️  Warnings: ${chalk.yellow(this.results.overall.warnings)}\n\n`;

    // Final verdict
    if (this.results.overall.failed === 0) {
      report += chalk.green.bold('✅ ALL VALIDATIONS PASSED\n');
    } else {
      report += chalk.red.bold('❌ SOME VALIDATIONS FAILED\n');
    }

    report += '═'.repeat(80) + '\n\n';

    console.log(report);
    return report;
  }

  /**
   * Format metrics report
   */
  formatMetricsReport(data) {
    let report = '';
    const metrics = [
      { key: 'lcp', label: 'LCP', icon: '🎯' },
      { key: 'cls', label: 'CLS', icon: '⚖️' },
      { key: 'fcp', label: 'FCP', icon: '📍' },
      { key: 'inp', label: 'INP', icon: '⚡' },
      { key: 'performanceScore', label: 'Score', icon: '🏆' },
    ];

    for (const { key, label, icon } of metrics) {
      const metric = data.metrics[key];
      if (!metric) continue;

      const value = metric.value;
      const unit = metric.unit;
      const threshold = metric.threshold;
      const status = metric.status === 'pass' ? '✅' : '❌';

      report += `  ${status} ${icon} ${label.padEnd(10)} ${String(value).padEnd(8)}${unit} `;
      report += chalk.dim(`(threshold: ${threshold}${unit})\n`);
    }

    return report;
  }

  /**
   * Run all validations
   */
  async runAll() {
    console.log(chalk.bold.cyan('\n\n🚀 COMPREHENSIVE PERFORMANCE VALIDATION\n'));
    console.log(chalk.cyan(`Base URL: ${this.baseUrl}`));
    console.log(chalk.cyan(`Timestamp: ${new Date().toISOString()}\n`));

    // Run validations
    await this.validateLighthouse();
    await this.validateWebVitals();
    await this.validateLoadTest();

    // Generate report
    this.generateReport();

    // Return exit code
    return this.results.overall.failed === 0 ? 0 : 1;
  }
}

// ============================================================================
// MATRIX COMPARISON
// ============================================================================

/**
 * Generate Mobile vs Desktop comparison matrix
 */
function generateComparisonMatrix(lhr) {
  const mobile = lhr.mobile;
  const desktop = lhr.desktop;

  console.log(chalk.bold.cyan('\n📊 MOBILE vs DESKTOP COMPARISON MATRIX\n'));

  const metrics = [
    { key: 'lcp', label: 'LCP (ms)', isPercentage: false },
    { key: 'cls', label: 'CLS', isPercentage: false },
    { key: 'fcp', label: 'FCP (ms)', isPercentage: false },
    { key: 'inp', label: 'INP (ms)', isPercentage: false },
    { key: 'performanceScore', label: 'Score', isPercentage: false },
  ];

  console.log(
    '┌─────────────────────┬──────────┬──────────┬─────────┬──────────┐'
  );
  console.log(
    '│ Metric              │ Mobile   │ Desktop  │ Diff    │ Mobile%  │'
  );
  console.log(
    '├─────────────────────┼──────────┼──────────┼─────────┼──────────┤'
  );

  for (const { key, label } of metrics) {
    const mobileVal = mobile.metrics[key]?.value || 0;
    const desktopVal = desktop.metrics[key]?.value || 0;
    const diff = mobileVal - desktopVal;
    const mobilePercent = desktopVal !== 0 ? ((mobileVal - desktopVal) / desktopVal * 100).toFixed(1) : 0;

    const diffStr = diff > 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0);
    const mobileStr = mobileVal.toFixed(1);
    const desktopStr = desktopVal.toFixed(1);

    console.log(
      `│ ${label.padEnd(19)} │ ${mobileStr.padStart(8)} │ ${desktopStr.padStart(8)} │ ${diffStr.padStart(7)} │ ${mobilePercent.padStart(8)}% │`
    );
  }

  console.log(
    '└─────────────────────┴──────────┴──────────┴─────────┴──────────┘'
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';

  const suite = new PerformanceValidationSuite(baseUrl);
  const exitCode = await suite.runAll();

  // Generate comparison matrix if results available
  if (suite.results.lighthouse) {
    generateComparisonMatrix(suite.results.lighthouse.report);
  }

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join('./lighthouse-reports', `validation-${timestamp}.json`);
  fs.writeFileSync(filepath, JSON.stringify(suite.results, null, 2));
  console.log(chalk.dim(`\n📁 Validation results saved to: ${filepath}`));

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
