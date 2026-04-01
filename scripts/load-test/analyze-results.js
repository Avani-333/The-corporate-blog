#!/usr/bin/env node

/**
 * Load Test Results Analyzer
 * Analyzes k6 JSON output and generates insights
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

// ============================================================================
// ANALYSIS THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  p95Response: { warn: 500, critical: 1000 },
  p99Response: { warn: 1000, critical: 2000 },
  errorRate: { warn: 0.05, critical: 0.1 },
  avgResponse: { warn: 300, critical: 500 },
};

// ============================================================================
// UTILITIES
// ============================================================================

function colorize(status, text) {
  switch (status) {
    case 'ok':
      return `${GREEN}✓${RESET} ${text}`;
    case 'warn':
      return `${YELLOW}⚠${RESET} ${text}`;
    case 'critical':
      return `${RED}✗${RESET} ${text}`;
    default:
      return text;
  }
}

function formatMs(ms) {
  return `${ms.toFixed(2)}ms`;
}

function formatPercent(percent) {
  return `${(percent * 100).toFixed(2)}%`;
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f.includes('summary'))
    .map(f => path.join(dir, f));
}

// ============================================================================
// ANALYSIS
// ============================================================================

function analyzeMetrics(data) {
  const metrics = {};

  // Extract metrics from k6 output
  if (data.metrics) {
    for (const [name, values] of Object.entries(data.metrics)) {
      if (Array.isArray(values)) {
        metrics[name] = {
          values,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p50: percentile(values, 0.5),
          p95: percentile(values, 0.95),
          p99: percentile(values, 0.99),
        };
      }
    }
  }

  return metrics;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[idx];
}

function evaluateStatus(metric, value) {
  const threshold = THRESHOLDS[metric];
  if (!threshold) return 'ok';

  if (value > threshold.critical) return 'critical';
  if (value > threshold.warn) return 'warn';
  return 'ok';
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

class LoadTestReport {
  constructor(files) {
    this.files = files;
    this.results = {};
    this.summary = {};
  }

  analyze() {
    console.log(`${BLUE}Analyzing ${this.files.length} test result(s)...${RESET}\n`);

    for (const file of this.files) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const name = path.basename(file, '-summary.json');
        this.results[name] = this.analyzeFile(data);
      } catch (error) {
        console.error(`Error analyzing ${file}:`, error.message);
      }
    }
  }

  analyzeFile(data) {
    const result = {
      testName: data.testName || 'Unknown',
      duration: data.state?.duration || 0,
      scenarios: {},
    };

    // Analyze each scenario
    if (data.metrics) {
      for (const [metric, values] of Object.entries(data.metrics)) {
        if (metric.includes('duration')) {
          result.scenarios.duration = analyzeMetrics({ metrics: { duration: values } });
        }
      }
    }

    return result;
  }

  generateReport() {
    console.log(`${BLUE}${'='.repeat(80)}${RESET}`);
    console.log(`${BLUE}LOAD TEST ANALYSIS REPORT${RESET}`);
    console.log(`${BLUE}${'='.repeat(80)}${RESET}\n`);

    for (const [name, result] of Object.entries(this.results)) {
      this.printTestResult(name, result);
    }

    this.printSummary();
  }

  printTestResult(name, result) {
    console.log(`${BLUE}Test: ${name}${RESET}`);
    console.log(`  Duration: ${result.duration}s\n`);

    // Print metrics
    for (const [metric, data] of Object.entries(result.scenarios)) {
      if (data.duration) {
        const dur = data.duration;
        this.printMetric('Average Response Time', dur.avg, 'ms');
        this.printMetric('P95 Response Time', dur.p95, 'ms');
        this.printMetric('P99 Response Time', dur.p99, 'ms');
        this.printMetric('Min Response Time', dur.min, 'ms');
        this.printMetric('Max Response Time', dur.max, 'ms');
      }
    }

    console.log('');
  }

  printMetric(label, value, unit) {
    const status = evaluateStatus(label.replace(/ /g, '').toLowerCase(), value);
    const statusIndicator = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : '✗';
    const color = status === 'ok' ? GREEN : status === 'warn' ? YELLOW : RED;

    console.log(`  ${color}${statusIndicator}${RESET} ${label}: ${color}${value.toFixed(2)}${unit}${RESET}`);
  }

  printSummary() {
    console.log(`${BLUE}${'='.repeat(80)}${RESET}`);
    console.log(`${BLUE}SUMMARY${RESET}`);
    console.log(`${BLUE}${'='.repeat(80)}${RESET}\n`);

    const allResults = Object.values(this.results);
    if (allResults.length === 0) {
      console.log('No test results found.');
      return;
    }

    console.log(`Total Tests: ${allResults.length}`);
    console.log(`Report Generated: ${new Date().toISOString()}\n`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const resultsDir = process.argv[2] || 'load-test-results';

  const files = findJsonFiles(resultsDir);
  if (files.length === 0) {
    console.error(`No summary JSON files found in ${resultsDir}`);
    console.error('Run load tests first: npm run load-test');
    process.exit(1);
  }

  const report = new LoadTestReport(files);
  report.analyze();
  report.generateReport();
}

main();
