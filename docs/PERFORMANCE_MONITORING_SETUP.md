# Performance Monitoring Implementation Checklist

Complete monitoring infrastructure for script load impact and performance regression detection.

## ✅ Completed Components

### Core Monitoring Libraries

- [x] **Script Load Monitor** (`lib/script-load-monitor.ts`)
  - Automatic script discovery via PerformanceObserver
  - Tracks load time, execution time, byte size
  - Identifies critical (render-blocking) scripts
  - Estimates Core Web Vitals impact
  - Support for dynamically injected scripts
  - Impact efficiency calculations

- [x] **Performance Regression Detector** (`lib/performance-regression-detector.ts`)
  - Baseline storage with localStorage persistence
  - Regression detection (>10% on timings, >5 on score)
  - Trend analysis (improving/stable/regressing)
  - Historical snapshot tracking
  - Configurable thresholds per metric
  - Snapshot-based time-series data

### React Integration

- [x] **PerformanceMonitoringProvider** (`components/analytics/PerformanceMonitoringProvider.tsx`)
  - Auto-initializes both monitoring systems
  - Integrates with Web Vitals reporter
  - Reports metrics to analytics endpoints
  - Development-only floating indicator
  - Automatic script load reporting

- [x] **usePerformanceMonitoring Hook** (`hooks/usePerformanceMonitoring.ts`)
  - Comprehensive monitoring data access
  - Script metrics and reports
  - Regression alerts and trends
  - Methods for baseline setting and data clearing
  - Alternative hooks: `useRegressionDetection()`, `useScriptMonitoring()`

### API Endpoints

- [x] **POST /api/monitoring/alerts** - Receive and store monitoring alerts
- [x] **GET /api/monitoring/alerts** - Query recent alerts with filters
- [x] **POST /api/web-vitals** - Existing Web Vitals endpoint (already in place)
- [x] **POST /api/analytics/events** - Existing analytics endpoint (already in place)

### Documentation

- [x] **SCRIPT_LOAD_MONITORING.md** - Complete guide with examples
- [x] **This checklist** - Implementation status and integration guide

## 📊 Integration Steps

### Step 1: Add Provider to Root Layout

**File:** `app/layout.tsx`

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

**Status:** ⏳ Needs Integration

### Step 2: Add Hook to Blog Post Page

**File:** `app/blog/[slug]/page.tsx`

```tsx
'use client';

import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

export function BlogPostContent() {
  const monitoring = usePerformanceMonitoring();

  if (!monitoring.isHealthy) {
    console.warn('Performance issues:', monitoring.regressionAlerts);
  }

  return (
    <article>
      {monitoring.scripts.length > 0 && (
        <debug info={`${monitoring.scripts.length} scripts loaded`} />
      )}
      {/* Content */}
    </article>
  );
}
```

**Status:** ⏳ Needs Integration

### Step 3: Configure Thresholds

**File:** `config/monitoring.ts` (Create new)

```typescript
import { PerformanceThreshold } from '@/lib/performance-regression-detector';

export const PERFORMANCE_THRESHOLDS: Partial<PerformanceThreshold> = {
  // Core Web Vitals thresholds
  fcp: { min: 1500, warning: 1000 },
  lcp: { min: 2500, warning: 2000 },
  cls: { min: 0.1, warning: 0.05 },
  tti: { min: 3800, warning: 3000 },
  ttfb: { min: 600, warning: 300 },
  
  // Lighthouse score threshold
  performanceScore: 85,
};

// Script load thresholds
export const SCRIPT_THRESHOLDS = {
  maxTotalLoadTime: 3000,        // ms - all scripts total
  maxCriticalLoadTime: 300,      // ms - per critical script
  maxFcpImpact: 300,             // ms - estimated impact on FCP
  maxLcpImpact: 500,             // ms - estimated impact on LCP
};

// Alert severity rules
export const ALERT_RULES = {
  criticalRegression: {
    timingIncrease: 20,           // %
    scoreDecrease: 10,            // points
  },
  warningRegression: {
    timingIncrease: 10,           // %
    scoreDecrease: 5,             // points
  },
};
```

**Status:** ⏳ Needs Creation

### Step 4: Set Initial Baselines

**File:** `scripts/set-performance-baseline.ts` (Create new)

```typescript
import { performanceRegressionDetector } from '@/lib/performance-regression-detector';

/**
 * Run after successful performance optimization
 * to establish baselines for regression detection
 *
 * Usage: node scripts/set-performance-baseline.ts
 */

async function setBaselines() {
  // Get current measurements from Lighthouse
  const baseline = {
    fcp: 950,        // ms - First Contentful Paint
    lcp: 1800,       // ms - Largest Contentful Paint  
    cls: 0.08,       // unitless - Cumulative Layout Shift
    tti: 2500,       // ms - Time to Interactive
    ttfb: 200,       // ms - Time to First Byte
    performanceScore: 92  // 0-100
  };

  // For each tracked page
  const pages = [
    '/',
    '/blog',
    '/blog/post-slug'
  ];

  pages.forEach(page => {
    console.log(`Setting baseline for ${page}`);
    performanceRegressionDetector.setBaseline(baseline);
  });

  console.log('✅ Baselines set');
}

setBaselines().catch(console.error);
```

**Status:** ⏳ Needs Creation

### Step 5: Add CI/CD Performance Checks

**File:** `.github/workflows/performance-regression.yml` (Create/Update)

```yaml
name: Performance Regression Check

on: [pull_request]

jobs:
  performance-check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run Lighthouse
        run: |
          npm install -g @lhci/cli@0.10.x
          lhci autorun
      
      - name: Check for regressions
        run: |
          # Compare against baseline
          node scripts/check-regression.js
```

**Status:** ⏳ Needs Creation

### Step 6: Setup Alerting (Optional)

**File:** `lib/monitoring-alerts.ts` (Create new)

```typescript
import { RegressionAlert } from '@/lib/performance-regression-detector';

interface AlertChannel {
  slack?: { webhook: string; channel: string };
  email?: { recipients: string[] };
  pagerduty?: { integrationKey: string };
}

export async function sendAlert(
  alert: RegressionAlert,
  channels: AlertChannel
): Promise<void> {
  // Slack
  if (channels.slack) {
    await fetch(channels.slack.webhook, {
      method: 'POST',
      body: JSON.stringify({
        text: `⚠️ Performance Alert: ${alert.metric}`,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${alert.metric}* regression detected\n` +
                  `Current: ${alert.current}ms\n` +
                  `Baseline: ${alert.baseline}ms\n` +
                  `Change: ↑${alert.regression}%`
          }
        }]
      })
    });
  }

  // Email
  if (channels.email) {
    await sendEmail({
      to: channels.email.recipients,
      subject: `[Alert] Performance Regression on ${alert.metric}`,
      body: buildEmailBody(alert)
    });
  }

  // PagerDuty
  if (channels.pagerduty && alert.severity === 'critical') {
    await triggerIncident(alert, channels.pagerduty);
  }
}
```

**Status:** ⏳ Optional Enhancement

## 🎯 Monitoring Strategy

### For Ad System

Monitor the estimated impact of Google AdSense scripts:

```typescript
// In blog post component
const monitoring = useScriptMonitoring();

const adScripts = monitoring.scripts.filter(s => 
  s.name.includes('AdSense') || s.name.includes('pagead')
);

const adImpact = adScripts.reduce((sum, s) => sum + s.loadTime, 0);
console.log(`Ad impact: ${adImpact}ms`);

// Alert if exceeds budget
if (adImpact > 300) {
  console.warn('⚠️ Ad system exceeds 300ms load budget');
}
```

### For Affiliate System

Track click tracking impact:

```typescript
// Affiliate redirect is lightweight API call
// Monitor impact of affiliate link tracking + badge rendering

const linkScripts = monitoring.scripts.filter(s =>
  s.name.includes('affiliate') || s.url.includes('/api/r/')
);

const affiliateImpact = linkScripts.reduce((sum, s) => sum + s.executionTime, 0);
```

### For Content Changes

Detect when new scripts are added:

```typescript
// Before and after comparison
const before = monitoring.scripts.length;

// Deploy new feature with ads
const after = monitoring.scripts.length;

if (after > before) {
  console.log(`${after - before} new scripts added`);
  
  const regression = monitoring.latestSnapshot?.alerts || [];
  if (regression.length > 0) {
    console.warn('New scripts caused regression');
  }
}
```

## 📈 Dashboard Ideas

### Real-Time Metrics Panel

```tsx
export function PerformanceDashboard() {
  const monitoring = usePerformanceMonitoring();

  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard
        label="Scripts"
        value={monitoring.scripts.length}
        subtext={`${monitoring.criticalScripts.length} critical`}
      />
      <MetricCard
        label="Load Impact"
        value={`${monitoring.scriptReport?.summary.estimatedFCPImpact}ms`}
        status={monitoring.isHealthy ? 'good' : 'warning'}
      />
      <TrendCard
        label="FCP"
        trend={monitoring.fcp_trend}
        value={monitoring.latestSnapshot?.metrics.fcp}
      />
      <AlertsCard
        alerts={monitoring.regressionAlerts}
      />
    </div>
  );
}
```

### CI/CD Status Page

Add to dashboard showing:
- Latest Lighthouse scores
- Performance comparison to main branch
- Regression detection results
- Alert history (24h)

## 🔧 Troubleshooting

### Scripts not being tracked

```typescript
// Initialize manually
import { scriptLoadMonitor } from '@/lib/script-load-monitor';

scriptLoadMonitor.init();
const scripts = scriptLoadMonitor.getScripts();
console.log('Tracked:', scripts);
```

### No regression alerts appearing

```typescript
// Check if baseline is set
const detector = performanceRegressionDetector;
const baseline = detector['baselines']; // accessor for debugging

// Set baseline manually if missing
detector.setBaseline({
  fcp: 1000, lcp: 2000, cls: 0.1, tti: 3000, ttfb: 200, performanceScore: 90
});
```

### Web Vitals not reporting

Check that `PerformanceMonitoringProvider` is in root layout and Web Vitals reporter is initialized.

## 📚 Related Documentation

- [SCRIPT_LOAD_MONITORING.md](./SCRIPT_LOAD_MONITORING.md) - Complete monitoring guide
- [MONITORING_AND_ALERTS.md](./MONITORING_AND_ALERTS.md) - Full monitoring strategy
- [Performance Budget Guide](https://web.dev/performance-budgets-101/)
- [Web Vitals](https://web.dev/vitals/)

## 🚀 Next Steps

1. **Immediate** (This week)
   - [ ] Add PerformanceMonitoringProvider to root layout
   - [ ] Verify script monitoring is working in devtools
   - [ ] Set initial baselines for key pages

2. **Short Term** (This month)
   - [ ] Create monitoring config file
   - [ ] Setup alerting integration (Slack)
   - [ ] Add performance check to CI/CD
   - [ ] Train team on using monitoring dashboard

3. **Medium Term** (Next sprint)
   - [ ] Create dashboard for trend analysis
   - [ ] Integrate with existing Lighthouse audits
   - [ ] Setup automated regression alerts
   - [ ] Document ad system impact

4. **Long Term** (Next quarter)
   - [ ] Archive historical metrics (>30 days)
   - [ ] Create performance SLA tracking
   - [ ] Enable per-component impact analysis
   - [ ] Implement automatic performance budgets

## ✨ Success Metrics

When monitoring is fully implemented, you should be able to:

- ✅ See all scripts loading on each page
- ✅ Measure ad system impact on Core Web Vitals
- ✅ Detect performance regressions automatically
- ✅ Alert team when thresholds exceeded
- ✅ Track trends over time
- ✅ Make data-driven optimization decisions

---

**Created:** March 20, 2026
**Status:** Components Complete, Integration Pending
**Last Updated:** Implementation checklist created
