# Performance Monitoring Guide

Complete monitoring system for script load impact and performance regression detection.

## Overview

The monitoring system tracks:
- **Script Load Impact** - Third-party scripts (ads, analytics, etc.) and their impact on Core Web Vitals
- **Performance Regression** - Detects when metrics degrade compared to baselines
- **Core Web Vitals** - FCP, LCP, CLS, TTI, TTFB tracking
- **Trend Analysis** - Identifies improving/regressing/stable patterns

## Components

### 1. Script Load Monitor (`lib/script-load-monitor.ts`)

Monitors all scripts loaded on the page and their performance impact.

**Features:**
- Automatic script discovery via PerformanceObserver
- Tracks script load time, execution time, size
- Identifies critical (render-blocking) scripts
- Calculates estimated impact on Core Web Vitals
- Support for dynamically injected scripts

**Usage:**

```typescript
import { scriptLoadMonitor, reportScriptLoadMetrics } from '@/lib/script-load-monitor';

// Initialize (happens automatically)
scriptLoadMonitor.init();

// Get all tracked scripts
const scripts = scriptLoadMonitor.getScripts();

// Get critical scripts only
const critical = scriptLoadMonitor.getCriticalScripts();

// Generate detailed report
const report = await scriptLoadMonitor.generateReport();
console.log('Total scripts:', report.summary.totalScripts);
console.log('Total load time:', report.summary.totalLoadTime, 'ms');
console.log('Estimated FCP impact:', report.summary.estimatedFCPImpact, 'ms');

// Get impact efficiency (impact per KB)
const efficiency = scriptLoadMonitor.getImpactEfficiency();

// Find high-impact scripts (>100ms load+exec time)
const expensive = scriptLoadMonitor.getHighImpactScripts(100);

// Report metrics to analytics
await reportScriptLoadMetrics();
```

**Report Structure:**

```typescript
{
  timestamp: '2026-03-20T10:30:00Z',
  pageUrl: 'https://blog.example.com/post',
  scripts: [
    {
      name: 'Google AdSense',
      url: 'https://pagead2.googlesyndication.com/...',
      loadTime: 1250,          // ms
      executionTime: 850,      // ms
      byteSize: 45230,         // bytes
      priority: 'high',        // render-blocking
      async: false,
      defer: false
    }
  ],
  summary: {
    totalScripts: 8,
    totalLoadTime: 3450,
    totalByteSize: 245000,
    estimatedFCPImpact: 230,   // ms
    estimatedLCPImpact: 520,   // ms
    criticalScripts: ['Google AdSense', 'Google Tag Manager']
  }
}
```

### 2. Performance Regression Detector (`lib/performance-regression-detector.ts`)

Detects performance regressions by comparing metrics against baselines.

**Features:**
- Stores performance baselines per page
- Detects significant regressions (>10% on timings, >5 points on score)
- Tracks trends (improving/stable/regressing)
- Historical snapshot storage
- Configurable thresholds

**Default Thresholds:**

```
FCP: 1000ms (warning) / 1500ms (critical)
LCP: 2000ms (warning) / 2500ms (critical)
CLS: 0.05 (warning) / 0.1 (critical)
TTI: 3000ms (warning) / 3800ms (critical)
TTFB: 300ms (warning) / 600ms (critical)
Performance Score: 85/100 minimum
```

**Usage:**

```typescript
import { 
  performanceRegressionDetector,
  PerformanceBaseline 
} from '@/lib/performance-regression-detector';

// Initialize
performanceRegressionDetector.init({
  fcp: { min: 1500, warning: 1000 },
  lcp: { min: 2500, warning: 2000 },
  cls: { min: 0.1, warning: 0.05 },
});

// Set baseline (after optimization)
const baseline: PerformanceBaseline = {
  fcp: 950,
  lcp: 1800,
  cls: 0.08,
  tti: 2500,
  ttfb: 200,
  performanceScore: 92
};
performanceRegressionDetector.setBaseline(baseline);

// Record a measurement
const measurement: PerformanceBaseline = {
  fcp: 1050,        // 100ms slower - regression
  lcp: 2100,
  cls: 0.12,        // Regression
  tti: 2800,
  ttfb: 250,
  performanceScore: 88
};

const snapshot = performanceRegressionDetector.recordSnapshot(measurement);

// Check for regressions
snapshot.alerts.forEach(alert => {
  console.log(`${alert.metric}: ${alert.current}ms (↑${alert.regression}%)`);
  console.log(`  Severity: ${alert.severity}`);
  console.log(`  Baseline: ${alert.baseline}ms`);
});

// Get trend
const trend = performanceRegressionDetector.getTrend('fcp', 1440); // last 24 hours
console.log('FCP trend:', trend); // 'improving' | 'stable' | 'regressing'

// Get alerts from last hour
const recentAlerts = performanceRegressionDetector.getRecentAlerts(60);

// Compare two measurements
const comparison = performanceRegressionDetector.compare(baseline, measurement);
console.log('FCP change: ↑' + comparison.fcp.toFixed(2) + '%');
```

### 3. Performance Monitoring Provider (`components/analytics/PerformanceMonitoringProvider.tsx`)

React provider that integrates monitoring throughout the app.

**Usage in Layout:**

```tsx
import { PerformanceMonitoringProvider } from '@/components/analytics/PerformanceMonitoringProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <PerformanceMonitoringProvider>
          {children}
        </PerformanceMonitoringProvider>
      </body>
    </html>
  );
}
```

**Features:**
- Auto-initializes both monitoring systems
- Collects Web Vitals data
- Reports to analytics endpoints
- Development-only floating indicator showing current status

## Integration Examples

### Example 1: Monitor Ad System Impact

```typescript
// Before adding ads
const scriptsBefore = scriptLoadMonitor.getScripts();

// After adding <AdSlot /> components
const scriptsAfter = scriptLoadMonitor.getScripts();

// Generate impact report
const report = await scriptLoadMonitor.generateReport();

if (report.summary.estimatedFCPImpact > 100) {
  console.warn('Ad system adding >100ms to FCP');
}
```

### Example 2: Alert on Regression

```typescript
performanceRegressionDetector.init();

// Set baseline after optimization
const baseline = { fcp: 950, lcp: 1800, cls: 0.08, tti: 2500, ttfb: 200, performanceScore: 92 };
performanceRegressionDetector.setBaseline(baseline);

// Later, measure again
const current = { fcp: 1100, lcp: 2050, cls: 0.15, tti: 3200, ttfb: 300, performanceScore: 85 };
const snapshot = performanceRegressionDetector.recordSnapshot(current);

if (snapshot.alerts.length > 0) {
  // Send alert to monitoring service
  await fetch('/api/monitoring/alert', {
    method: 'POST',
    body: JSON.stringify(snapshot.alerts)
  });
}
```

### Example 3: Trend Analysis Dashboard

```typescript
// Get 7-day trends
const fcp_trend = performanceRegressionDetector.getTrend('fcp', 7 * 24 * 60);
const lcp_trend = performanceRegressionDetector.getTrend('lcp', 7 * 24 * 60);
const score_trend = performanceRegressionDetector.getTrend('performanceScore', 7 * 24 * 60);

// Display in dashboard
<div>
  <MetricCard metric="FCP" trend={fcp_trend} />
  <MetricCard metric="LCP" trend={lcp_trend} />
  <ScoreCard trend={score_trend} />
</div>
```

### Example 4: Script Efficiency Analysis

```typescript
const efficiency = scriptLoadMonitor.getImpactEfficiency();

// Sort by worst impact/KB ratio
const sorted = Array.from(efficiency.entries())
  .sort((a, b) => b[1] - a[1]);

sorted.forEach(([name, ratio]) => {
  console.log(`${name}: ${ratio.toFixed(2)} impact/KB`);
});

// Find candidates for removal/optimization
const expensive = sorted.filter(([_, ratio]) => ratio > 50);
```

## API Endpoints

### POST `/api/analytics/events`

Report script load metrics:

```json
{
  "eventName": "script_load_monitoring",
  "domain": "performance",
  "properties": {
    "totalScripts": 8,
    "totalLoadTime": 3450,
    "totalByteSize": 245000,
    "estimatedFCPImpact": 230,
    "estimatedLCPImpact": 520,
    "criticalScriptCount": 2,
    "criticalScripts": "Google AdSense,Google Tag Manager",
    "scripts": [...]
  }
}
```

### POST `/api/web-vitals`

Core Web Vitals data (existing endpoint):

```json
{
  "id": "metric-id",
  "name": "FCP",
  "value": 950,
  "delta": 0,
  "rating": "good",
  "navigationType": "navigation",
  "pathname": "/blog/post-slug"
}
```

## Monitoring Dashboard

The development floating indicator shows:
- Critical alerts (red) with >threshold metrics
- Warning alerts (yellow) with >warning metrics
- Latest metrics snapshot
- Threshold status

Access with button in bottom-right corner (dev mode only).

## Performance Optimization Guide

### Reducing Script Load Impact

1. **Use async/defer attributes:**
```tsx
<script src="..." async />      // Load in parallel, don't block
<script src="..." defer />      // Load in parallel, execute in order
<script src="..." />            // Default: render-blocking
```

2. **Implement lazy loading:**
```typescript
// From ad system - example pattern
const [shouldLoad, setShouldLoad] = useState(false);

useEffect(() => {
  if (shouldLoad) {
    scriptLoadMonitor.trackNewScript(scriptElement);
  }
}, [shouldLoad]);
```

3. **Monitor ad impact specifically:**
```typescript
const adScripts = scriptLoadMonitor.getScripts()
  .filter(s => s.name.includes('Ad'));

const adImpact = await Promise.all(
  adScripts.map(s => scriptLoadMonitor.measureScriptImpact(s))
);

const totalAdImpact = adImpact.reduce((sum, i) => sum + i.fcp, 0);
console.log(`Total ad impact on FCP: ${totalAdImpact}ms`);
```

4. **Use inline critical CSS:**
Reduce render-blocking stylesheets by inlining critical CSS.

5. **Defer non-critical scripts:**
Move analytics, ads, and other non-critical scripts to load after page interactive.

## Thresholds & Alerts

### Regression Alert Severity

**Critical:** Metric exceeds hard threshold AND shows regression
- FCP >1500ms
- LCP >2500ms
- CLS >0.1
- Performance Score <85

**Warning:** Metric exceeds warning threshold OR >10% regression
- FCP >1000ms
- LCP >2000ms
- CLS >0.05
- Performance Score <90

### Regression Detection

Automatically detects regressions when:
- Metrics degrade >10% from baseline on timings
- Score drops >5 points
- AND exceeds warning threshold

## Best Practices

1. **Set baselines after optimization:**
```typescript
// After significant refactoring
const optimizedMetrics = measurements;
performanceRegressionDetector.updateBaseline(optimizedMetrics);
```

2. **Monitor regularly:**
- Run Lighthouse audits weekly
- Monitor production metrics daily
- Check trends for degradation patterns

3. **Include ad impact in budgets:**
- Budget 200-300ms for ad system (including network + execution)
- Track separately to isolate impact

4. **Use with CI/CD:**
```yaml
- name: Check for regressions
  run: |
    npm run test:performance
    # Fails if any critical alerts or regressions detected
```

5. **Share alerts:**
```typescript
// Slack notification on regression
if (snapshot.alerts.some(a => a.severity === 'critical')) {
  sendSlackAlert({
    text: `⚠️ Performance regression on ${snapshot.pageUrl}`,
    blocks: snapshot.alerts.map(...)
  });
}
```

## Debugging

### Check what scripts loaded

```typescript
const report = await scriptLoadMonitor.generateReport();
console.table(report.scripts);
```

### Find regression source

```typescript
const lastSnapshot = performanceRegressionDetector.getLatestSnapshot();
lastSnapshot.alerts.forEach(alert => {
  console.log(`${alert.metric} regressed by ${alert.regression}%`);
  // Investigate cause, check recent code changes
});
```

### Export data for analysis

```typescript
const data = performanceRegressionDetector.exportData();
// Analyze baselines, snapshots, thresholds
```

## Related Files

- `lib/script-load-monitor.ts` - Script monitoring implementation
- `lib/performance-regression-detector.ts` - Regression detection
- `components/analytics/PerformanceMonitoringProvider.tsx` - Provider component
- `components/analytics/WebVitalsReporter.tsx` - Existing Web Vitals reporter
- `.github/workflows/seo-performance.yml` - CI/CD performance checks

## See Also

- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring](https://developers.google.com/web/tools/lighthouse/v3/scoring)
- [Performance Budget Best Practices](https://web.dev/performance-budgets-101/)
- [MONITORING_AND_ALERTS.md](./MONITORING_AND_ALERTS.md) - Full monitoring guide
