#!/usr/bin/env node

/**
 * Lighthouse Report Analyzer
 * 
 * Analyzes collected Lighthouse reports to:
 * - Track performance trends over time
 * - Compare mobile vs desktop metrics
 * - Identify regressions
 * - Show improvement in key metrics
 * 
 * Usage:
 *   node scripts/analyze-lighthouse-reports.js
 *   node scripts/analyze-lighthouse-reports.js --latest 5
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// ============================================================================
// TYPES & CONFIG
// ============================================================================

const REPORT_DIR = './lighthouse-reports';
const KEY_METRICS = ['lcp', 'cls', 'fcp', 'inp', 'performanceScore'];
const THRESHOLD_CHANGE = 5; // % change threshold for warning

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Read all Lighthouse reports
 */
function getReports(limit = null) {
  if (!fs.existsSync(REPORT_DIR)) {
    console.log(chalk.yellow('No reports directory found. Run validator first.'));
    return [];
  }

  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit || undefined);

  return files.map(file => {
    const filepath = path.join(REPORT_DIR, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    return {
      file,
      timestamp: new Date(file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)[1].replace(/-/g, ':')),
      data: JSON.parse(content),
    };
  });
}

/**
 * Compare two reports for regression/improvement
 */
function compareMetrics(before, after) {
  const comparison = {};

  for (const metric of KEY_METRICS) {
    const beforeMobile = before.mobile.metrics[metric];
    const beforeDesktop = before.desktop.metrics[metric];
    const afterMobile = after.mobile.metrics[metric];
    const afterDesktop = after.desktop.metrics[metric];

    if (beforeMobile && afterMobile) {
      const mobileDiff = afterMobile.value - beforeMobile.value;
      const mobilePercent = (mobileDiff / beforeMobile.value) * 100;

      comparison[metric] = {
        mobile: {
          before: beforeMobile.value,
          after: afterMobile.value,
          diff: mobileDiff,
          percent: mobilePercent,
          status: getMetricStatus(metric, afterMobile.value),
        },
        desktop: {
          before: beforeDesktop.value,
          after: afterDesktop.value,
          diff: afterDesktop.value - beforeDesktop.value,
          percent: ((afterDesktop.value - beforeDesktop.value) / beforeDesktop.value) * 100,
          status: getMetricStatus(metric, afterDesktop.value),
        },
      };
    }
  }

  return comparison;
}

/**
 * Get metric status
 */
function getMetricStatus(metric, value) {
  const thresholds = {
    lcp: { pass: 2500, warn: 4000 },
    cls: { pass: 0.1, warn: 0.25 },
    fcp: { pass: 1800, warn: 3000 },
    inp: { pass: 200, warn: 500 },
    performanceScore: { pass: 85, warn: 50 },
  };

  const threshold = thresholds[metric];
  if (!threshold) return 'unknown';

  return value <= threshold.pass ? 'pass' : value <= threshold.warn ? 'warn' : 'fail';
}

/**
 * Format metric change for display
 */
function formatChange(value, percent, metric) {
  const isWorseMetric = ['lcp', 'cls', 'fcp', 'inp'].includes(metric);
  const isImprovement = isWorseMetric ? value < 0 : value > 0;
  const symbol = isImprovement ? '📈' : '📉';
  const color = isImprovement 
    ? value > THRESHOLD_CHANGE ? chalk.green : chalk.gray
    : Math.abs(percent) > THRESHOLD_CHANGE ? chalk.red : chalk.gray;

  return `${symbol} ${color(`${value > 0 ? '+' : ''}${value.toFixed(0)}${metric === 'performanceScore' ? '' : '%'}`)}`
}

/**
 * Generate trend analysis
 */
function analyzeTrends(reports) {
  if (reports.length < 2) {
    console.log(chalk.yellow('Need at least 2 reports for trend analysis'));
    return;
  }

  console.log(chalk.bold.cyan('\n📊 TREND ANALYSIS\n'));

  // Get latest and previous
  const latest = reports[0].data;
  const previous = reports[1].data;

  const comparison = compareMetrics(previous, latest);

  // Mobile trends
  console.log(chalk.bold.yellow('📱 MOBILE TRENDS\n'));
  for (const metric of KEY_METRICS) {
    const comp = comparison[metric]?.mobile;
    if (comp) {
      console.log(`  ${metric.padEnd(18)} ${String(comp.before).padEnd(10)} → ${String(comp.after).padEnd(10)} ${formatChange(comp.diff, comp.percent, metric)}`);
    }
  }

  // Desktop trends
  console.log(chalk.bold.blue('\n🖥️  DESKTOP TRENDS\n'));
  for (const metric of KEY_METRICS) {
    const comp = comparison[metric]?.desktop;
    if (comp) {
      console.log(`  ${metric.padEnd(18)} ${String(comp.before).padEnd(10)} → ${String(comp.after).padEnd(10)} ${formatChange(comp.diff, comp.percent, metric)}`);
    }
  }
}

/**
 * Show report summary
 */
function showReportSummary(report) {
  const data = report.data;
  console.log(chalk.bold.cyan(`\n📄 Report: ${report.file}`));
  console.log(chalk.dim(`   Created: ${report.timestamp.toLocaleString()}`));

  // Get passing vs failing
  let mobilePass = 0, desktopPass = 0;
  KEY_METRICS.forEach(metric => {
    if (data.mobile.metrics[metric]?.status === 'pass') mobilePass++;
    if (data.desktop.metrics[metric]?.status === 'pass') desktopPass++;
  });

  console.log(`   📱 Mobile:   ${mobilePass}/${KEY_METRICS.length} metrics pass`);
  console.log(`   🖥️  Desktop:  ${desktopPass}/${KEY_METRICS.length} metrics pass`);
}

/**
 * Compare multiple reports
 */
function compareReports(reports, limit = 5) {
  if (reports.length < 2) {
    console.log(chalk.yellow('Need at least 2 reports for comparison'));
    return;
  }

  console.log(chalk.bold.cyan('\n📈 HISTORICAL COMPARISON\n'));
  console.log(chalk.gray('Latest 5 runs:\n'));

  const reportsToShow = reports.slice(0, limit);
  const metrics = {};

  // Initialize metrics
  KEY_METRICS.forEach(m => {
    metrics[m] = {
      mobile: [],
      desktop: [],
    };
  });

  // Collect data
  reportsToShow.reverse().forEach(report => {
    const data = report.data;
    KEY_METRICS.forEach(metric => {
      metrics[metric].mobile.push(data.mobile.metrics[metric]?.value || 0);
      metrics[metric].desktop.push(data.desktop.metrics[metric]?.value || 0);
    });
  });

  // Calculate averages and trends
  for (const metric of KEY_METRICS) {
    const mobileValues = metrics[metric].mobile;
    const desktopValues = metrics[metric].desktop;

    if (mobileValues.length === 0) continue;

    const mobileAvg = mobileValues.reduce((a, b) => a + b, 0) / mobileValues.length;
    const desktopAvg = desktopValues.reduce((a, b) => a + b, 0) / desktopValues.length;

    const mobileFirst = mobileValues[0];
    const mobileLast = mobileValues[mobileValues.length - 1];
    const desktopFirst = desktopValues[0];
    const desktopLast = desktopValues[desktopValues.length - 1];

    const mobileChange = ((mobileLast - mobileFirst) / mobileFirst) * 100;
    const desktopChange = ((desktopLast - desktopFirst) / desktopFirst) * 100;

    const mobileColor = mobileChange < 0 ? chalk.green : chalk.red;
    const desktopColor = desktopChange < 0 ? chalk.green : chalk.red;

    console.log(chalk.bold(`${metric.toUpperCase()}`));
    console.log(`  📱 Mobile:   avg=${mobileAvg.toFixed(0)}  trend=${mobileColor(`${mobileChange > 0 ? '+' : ''}${mobileChange.toFixed(1)}%`)}`);
    console.log(`  🖥️  Desktop:  avg=${desktopAvg.toFixed(0)}  trend=${desktopColor(`${desktopChange > 0 ? '+' : ''}${desktopChange.toFixed(1)}%`)}`);
    console.log();
  }
}

/**
 * Main analysis
 */
function main() {
  const args = process.argv.slice(2);
  let limit = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--latest' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
  }

  console.log(chalk.bold.cyan('\n🔬 Lighthouse Report Analysis\n'));

  const reports = getReports(limit);

  if (reports.length === 0) {
    console.log(chalk.red('❌ No reports found. Run validator first: npm run validate:lighthouse'));
    process.exit(1);
  }

  console.log(chalk.cyan(`Found ${reports.length} reports`));

  // Show latest report
  if (reports.length > 0) {
    showReportSummary(reports[0]);
  }

  // Show all reports summary
  if (reports.length > 1) {
    console.log(chalk.bold.cyan('\nAll Reports:'));
    reports.forEach(report => {
      const data = report.data;
      const mobilePass = KEY_METRICS.filter(m => data.mobile.metrics[m]?.status === 'pass').length;
      const desktopPass = KEY_METRICS.filter(m => data.desktop.metrics[m]?.status === 'pass').length;
      console.log(`  ${report.file.padEnd(60)} Mobile: ${mobilePass}/5  Desktop: ${desktopPass}/5`);
    });
  }

  // Trend analysis
  if (reports.length > 1) {
    analyzeTrends(reports);
  }

  // Historical comparison
  if (reports.length > 1) {
    compareReports(reports);
  }

  console.log(chalk.bold.cyan('\n' + '═'.repeat(80)));
  console.log(chalk.dim('Reports stored in: ./lighthouse-reports/'));
  console.log(chalk.dim('Run "npm run validate:lighthouse" to generate new report\n'));
}

main();
