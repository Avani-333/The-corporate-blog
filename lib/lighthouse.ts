import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// LIGHTHOUSE CONFIGURATION
// ============================================================================

export interface LighthouseConfig {
  url: string;
  options?: {
    port?: number;
    chromeFlags?: string[];
    logLevel?: 'silent' | 'error' | 'info' | 'verbose';
    output?: 'json' | 'html' | 'csv';
    onlyCategories?: string[];
    skipAudits?: string[];
  };
}

export interface LighthouseResult {
  url: string;
  timestamp: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa?: number;
  };
  metrics: CoreWebVitals;
  audits: LighthouseAudit[];
  opportunities: LighthouseOpportunity[];
  diagnostics: LighthouseDiagnostic[];
}

export interface CoreWebVitals {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay?: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  speedIndex: number;
  totalBlockingTime: number;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  value?: number;
  displayValue?: string;
  details?: any;
}

export interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  potential?: number;
}

export interface LighthouseDiagnostic {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  details?: any;
}

export interface BenchmarkConfig {
  urls: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  thresholds: PerformanceThresholds;
  notifications: NotificationConfig;
}

export interface PerformanceThresholds {
  performance: { min: number; target: number };
  accessibility: { min: number; target: number };
  bestPractices: { min: number; target: number };
  seo: { min: number; target: number };
  fcp: { max: number }; // First Contentful Paint (ms)
  lcp: { max: number }; // Largest Contentful Paint (ms)
  fid: { max: number }; // First Input Delay (ms)  
  cls: { max: number }; // Cumulative Layout Shift
  tti: { max: number }; // Time to Interactive (ms)
}

export interface NotificationConfig {
  email?: string[];
  webhook?: string;
  slack?: string;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_LIGHTHOUSE_CONFIG: LighthouseConfig = {
  url: '',
  options: {
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
  }
};

export const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  performance: { min: 85, target: 95 },
  accessibility: { min: 90, target: 100 },
  bestPractices: { min: 90, target: 100 },
  seo: { min: 90, target: 100 },
  fcp: { max: 1500 }, // 1.5 seconds
  lcp: { max: 2500 }, // 2.5 seconds
  fid: { max: 100 },  // 100 milliseconds
  cls: { max: 0.1 },  // 0.1
  tti: { max: 3800 }  // 3.8 seconds
};

// ============================================================================
// LIGHTHOUSE RUNNER
// ============================================================================

export async function runLighthouseAudit(config: LighthouseConfig): Promise<LighthouseResult> {
  let chrome;
  
  try {
    // Launch Chrome
    chrome = await chromeLauncher.launch({
      chromeFlags: config.options?.chromeFlags || DEFAULT_LIGHTHOUSE_CONFIG.options!.chromeFlags!
    });
    
    // Run Lighthouse
    const options = {
      logLevel: config.options?.logLevel || 'info',
      output: config.options?.output || 'json',
      onlyCategories: config.options?.onlyCategories,
      skipAudits: config.options?.skipAudits,
      port: chrome.port
    };
    
    const runnerResult = await lighthouse(config.url, options);
    
    if (!runnerResult) {
      throw new Error('Lighthouse audit failed to return results');
    }
    
    const result = runnerResult.lhr;
    
    // Extract scores
    const scores = {
      performance: Math.round((result.categories.performance?.score || 0) * 100),
      accessibility: Math.round((result.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((result.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((result.categories.seo?.score || 0) * 100),
      pwa: result.categories.pwa ? Math.round(result.categories.pwa.score * 100) : undefined
    };
    
    // Extract Core Web Vitals
    const metrics: CoreWebVitals = {
      firstContentfulPaint: result.audits['first-contentful-paint']?.numericValue || 0,
      largestContentfulPaint: result.audits['largest-contentful-paint']?.numericValue || 0,
      firstInputDelay: result.audits['max-potential-fid']?.numericValue,
      cumulativeLayoutShift: result.audits['cumulative-layout-shift']?.numericValue || 0,
      timeToInteractive: result.audits['interactive']?.numericValue || 0,
      speedIndex: result.audits['speed-index']?.numericValue || 0,
      totalBlockingTime: result.audits['total-blocking-time']?.numericValue || 0
    };
    
    // Extract audits
    const audits: LighthouseAudit[] = Object.entries(result.audits).map(([id, audit]) => ({
      id,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      scoreDisplayMode: audit.scoreDisplayMode,
      value: audit.numericValue,
      displayValue: audit.displayValue,
      details: audit.details
    }));
    
    // Extract opportunities (performance improvements)
    const opportunities: LighthouseOpportunity[] = audits
      .filter(audit => audit.scoreDisplayMode === 'numeric' && audit.score !== null && audit.score < 1)
      .map(audit => ({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        numericValue: audit.value,
        displayValue: audit.displayValue,
        potential: audit.value ? Math.round(audit.value / 1000) : undefined
      }));
    
    // Extract diagnostics
    const diagnostics: LighthouseDiagnostic[] = audits
      .filter(audit => audit.scoreDisplayMode === 'informative')
      .map(audit => ({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        displayValue: audit.displayValue,
        details: audit.details
      }));
    
    return {
      url: config.url,
      timestamp: new Date().toISOString(),
      scores,
      metrics,
      audits,
      opportunities,
      diagnostics
    };
    
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

// ============================================================================
// BENCHMARK ANALYSIS
// ============================================================================

export function analyzeBenchmarkResults(
  result: LighthouseResult,
  thresholds: PerformanceThresholds = PERFORMANCE_THRESHOLDS
): {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check Lighthouse scores
  if (result.scores.performance < thresholds.performance.min) {
    issues.push(`Performance score ${result.scores.performance} below minimum ${thresholds.performance.min}`);
  } else if (result.scores.performance < thresholds.performance.target) {
    recommendations.push(`Performance score ${result.scores.performance} below target ${thresholds.performance.target}`);
  }
  
  if (result.scores.accessibility < thresholds.accessibility.min) {
    issues.push(`Accessibility score ${result.scores.accessibility} below minimum ${thresholds.accessibility.min}`);
  }
  
  if (result.scores.bestPractices < thresholds.bestPractices.min) {
    issues.push(`Best Practices score ${result.scores.bestPractices} below minimum ${thresholds.bestPractices.min}`);
  }
  
  if (result.scores.seo < thresholds.seo.min) {
    issues.push(`SEO score ${result.scores.seo} below minimum ${thresholds.seo.min}`);
  }
  
  // Check Core Web Vitals
  if (result.metrics.firstContentfulPaint > thresholds.fcp.max) {
    issues.push(`First Contentful Paint ${Math.round(result.metrics.firstContentfulPaint)}ms exceeds ${thresholds.fcp.max}ms`);
  }
  
  if (result.metrics.largestContentfulPaint > thresholds.lcp.max) {
    issues.push(`Largest Contentful Paint ${Math.round(result.metrics.largestContentfulPaint)}ms exceeds ${thresholds.lcp.max}ms`);
  }
  
  if (result.metrics.firstInputDelay && result.metrics.firstInputDelay > thresholds.fid.max) {
    issues.push(`First Input Delay ${Math.round(result.metrics.firstInputDelay)}ms exceeds ${thresholds.fid.max}ms`);
  }
  
  if (result.metrics.cumulativeLayoutShift > thresholds.cls.max) {
    issues.push(`Cumulative Layout Shift ${result.metrics.cumulativeLayoutShift.toFixed(3)} exceeds ${thresholds.cls.max}`);
  }
  
  if (result.metrics.timeToInteractive > thresholds.tti.max) {
    recommendations.push(`Time to Interactive ${Math.round(result.metrics.timeToInteractive)}ms exceeds ${thresholds.tti.max}ms`);
  }
  
  const averageScore = Math.round(
    (result.scores.performance + result.scores.accessibility + result.scores.bestPractices + result.scores.seo) / 4
  );
  
  return {
    passed: issues.length === 0,
    score: averageScore,
    issues,
    recommendations
  };
}

// ============================================================================
// BENCHMARK STORAGE & REPORTING
// ============================================================================

export async function saveBenchmarkResult(
  result: LighthouseResult,
  outputDir: string = './lighthouse-reports'
): Promise<string> {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlSafe = new URL(result.url).hostname.replace(/\./g, '_');
    const filename = `lighthouse-${urlSafe}-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    // Save result
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
    
    return filepath;
  } catch (error) {
    console.error('Error saving benchmark result:', error);
    throw error;
  }
}

export async function generateBenchmarkReport(
  results: LighthouseResult[],
  thresholds: PerformanceThresholds = PERFORMANCE_THRESHOLDS
): Promise<string> {
  if (results.length === 0) {
    return 'No benchmark results available';
  }
  
  const latest = results[results.length - 1];
  const analysis = analyzeBenchmarkResults(latest, thresholds);
  
  const report = [`
# Lighthouse Benchmark Report

**Generated:** ${new Date().toISOString()}
**URL:** ${latest.url}
**Overall Score:** ${analysis.score}/100 ${analysis.passed ? '✅' : '❌'}

## Lighthouse Scores
| Category | Score | Status |
|----------|--------|--------|
| Performance | ${latest.scores.performance}/100 | ${latest.scores.performance >= thresholds.performance.min ? '✅' : '❌'} |
| Accessibility | ${latest.scores.accessibility}/100 | ${latest.scores.accessibility >= thresholds.accessibility.min ? '✅' : '❌'} |
| Best Practices | ${latest.scores.bestPractices}/100 | ${latest.scores.bestPractices >= thresholds.bestPractices.min ? '✅' : '❌'} |
| SEO | ${latest.scores.seo}/100 | ${latest.scores.seo >= thresholds.seo.min ? '✅' : '❌'} |

## Core Web Vitals
| Metric | Value | Threshold | Status |
|--------|--------|-----------|--------|
| First Contentful Paint | ${Math.round(latest.metrics.firstContentfulPaint)}ms | <${thresholds.fcp.max}ms | ${latest.metrics.firstContentfulPaint <= thresholds.fcp.max ? '✅' : '❌'} |
| Largest Contentful Paint | ${Math.round(latest.metrics.largestContentfulPaint)}ms | <${thresholds.lcp.max}ms | ${latest.metrics.largestContentfulPaint <= thresholds.lcp.max ? '✅' : '❌'} |
| Cumulative Layout Shift | ${latest.metrics.cumulativeLayoutShift.toFixed(3)} | <${thresholds.cls.max} | ${latest.metrics.cumulativeLayoutShift <= thresholds.cls.max ? '✅' : '❌'} |
| Time to Interactive | ${Math.round(latest.metrics.timeToInteractive)}ms | <${thresholds.tti.max}ms | ${latest.metrics.timeToInteractive <= thresholds.tti.max ? '✅' : '❌'} |

`];

  if (analysis.issues.length > 0) {
    report.push('## 🚨 Critical Issues\n');
    analysis.issues.forEach(issue => {
      report.push(`- ${issue}\n`);
    });
    report.push('\n');
  }

  if (analysis.recommendations.length > 0) {
    report.push('## 💡 Recommendations\n');
    analysis.recommendations.forEach(rec => {
      report.push(`- ${rec}\n`);
    });
    report.push('\n');
  }

  // Top opportunities
  const topOpportunities = latest.opportunities
    .sort((a, b) => (b.potential || 0) - (a.potential || 0))
    .slice(0, 5);
    
  if (topOpportunities.length > 0) {
    report.push('## 🎯 Top Performance Opportunities\n');
    topOpportunities.forEach(opp => {
      const impact = opp.potential ? `${opp.potential}s` : 'N/A';
      report.push(`- **${opp.title}** (${impact} potential savings)\n`);
      report.push(`  ${opp.description}\n\n`);
    });
  }

  // Trend analysis if multiple results
  if (results.length > 1) {
    const previous = results[results.length - 2];
    report.push('## 📈 Trend Analysis\n');
    
    const perfChange = latest.scores.performance - previous.scores.performance;
    const seoChange = latest.scores.seo - previous.scores.seo;
    
    report.push(`- Performance: ${perfChange >= 0 ? '+' : ''}${perfChange} points\n`);
    report.push(`- SEO: ${seoChange >= 0 ? '+' : ''}${seoChange} points\n`);
    
    const fcpChange = latest.metrics.firstContentfulPaint - previous.metrics.firstContentfulPaint;
    const lcpChange = latest.metrics.largestContentfulPaint - previous.metrics.largestContentfulPaint;
    
    report.push(`- FCP: ${fcpChange >= 0 ? '+' : ''}${Math.round(fcpChange)}ms\n`);
    report.push(`- LCP: ${lcpChange >= 0 ? '+' : ''}${Math.round(lcpChange)}ms\n\n`);
  }

  return report.join('');
}

// ============================================================================
// CONTINUOUS MONITORING
// ============================================================================

export class LighthouseBenchmark {
  private config: BenchmarkConfig;
  private results: Map<string, LighthouseResult[]> = new Map();
  
  constructor(config: BenchmarkConfig) {
    this.config = config;
  }
  
  async runBenchmark(url?: string): Promise<LighthouseResult[]> {
    const urlsToTest = url ? [url] : this.config.urls;
    const results: LighthouseResult[] = [];
    
    for (const testUrl of urlsToTest) {
      console.log(`Running Lighthouse audit for: ${testUrl}`);
      
      try {
        const result = await runLighthouseAudit({ 
          url: testUrl, 
          options: DEFAULT_LIGHTHOUSE_CONFIG.options 
        });
        
        results.push(result);
        
        // Store result
        if (!this.results.has(testUrl)) {
          this.results.set(testUrl, []);
        }
        this.results.get(testUrl)!.push(result);
        
        // Save to file
        await saveBenchmarkResult(result);
        
        // Check thresholds and alert if needed
        const analysis = analyzeBenchmarkResults(result, this.config.thresholds);
        if (!analysis.passed) {
          await this.sendAlert(testUrl, result, analysis);
        }
        
      } catch (error) {
        console.error(`Error running Lighthouse audit for ${testUrl}:`, error);
      }
    }
    
    return results;
  }
  
  async generateReport(url?: string): Promise<string> {
    if (url) {
      const results = this.results.get(url) || [];
      return generateBenchmarkReport(results, this.config.thresholds);
    }
    
    // Generate combined report for all URLs
    const reports: string[] = [];
    
    for (const [testUrl, results] of this.results.entries()) {
      const report = await generateBenchmarkReport(results, this.config.thresholds);
      reports.push(`## ${testUrl}\n${report}`);
    }
    
    return reports.join('\n---\n\n');
  }
  
  private async sendAlert(url: string, result: LighthouseResult, analysis: any): Promise<void> {
    const message = `🚨 Performance Alert: ${url}\nScore: ${analysis.score}/100\nIssues: ${analysis.issues.join(', ')}`;
    
    console.warn(message);
    
    // TODO: Implement actual notification sending
    // - Email alerts
    // - Slack notifications  
    // - Webhook calls
  }
  
  getHistoricalData(url: string, limit?: number): LighthouseResult[] {
    const results = this.results.get(url) || [];
    return limit ? results.slice(-limit) : results;
  }
}

// ============================================================================
// CLI UTILITIES
// ============================================================================

export async function runQuickAudit(url: string): Promise<void> {
  console.log(`🔍 Running Lighthouse audit for: ${url}`);
  
  try {
    const result = await runLighthouseAudit({
      url,
      options: DEFAULT_LIGHTHOUSE_CONFIG.options
    });
    
    const analysis = analyzeBenchmarkResults(result);
    
    console.log('\n📊 Results:');
    console.log(`Overall Score: ${analysis.score}/100 ${analysis.passed ? '✅' : '❌'}`);
    console.log(`Performance: ${result.scores.performance}/100`);
    console.log(`Accessibility: ${result.scores.accessibility}/100`);
    console.log(`Best Practices: ${result.scores.bestPractices}/100`);
    console.log(`SEO: ${result.scores.seo}/100`);
    
    console.log('\n⚡ Core Web Vitals:');
    console.log(`FCP: ${Math.round(result.metrics.firstContentfulPaint)}ms`);
    console.log(`LCP: ${Math.round(result.metrics.largestContentfulPaint)}ms`);
    console.log(`CLS: ${result.metrics.cumulativeLayoutShift.toFixed(3)}`);
    console.log(`TTI: ${Math.round(result.metrics.timeToInteractive)}ms`);
    
    if (analysis.issues.length > 0) {
      console.log('\n🚨 Issues:');
      analysis.issues.forEach(issue => console.log(`- ${issue}`));
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(rec => console.log(`- ${rec}`));
    }
    
    // Save result
    const filepath = await saveBenchmarkResult(result);
    console.log(`\n💾 Results saved to: ${filepath}`);
    
  } catch (error) {
    console.error('❌ Error running audit:', error);
    process.exit(1);
  }
}