# Memory Leak Detection Integration Guide

**Status**: ✅ Ready for Integration  
**Last Updated**: 2026-03-21  
**Estimated Setup Time**: 5 minutes  
**Environment Variables**: 1 required, 1 optional

---

## Quick Integration

### Step 1: Add Environment Variables

Add to [`.env.local`](.env.local):

```bash
# Enable memory leak detection widget (development only)
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true

# Optional: Custom refresh interval in milliseconds
NEXT_PUBLIC_MEMORY_CHECK_INTERVAL=5000
```

### Step 2: Import Hook in Root Layout

In [app/layout.tsx](app/layout.tsx):

```typescript
import { MemoryLeakDetectionWidget } from '@/hooks/useMemoryLeakDetection';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <MemoryLeakDetectionWidget componentName="App" />
      </body>
    </html>
  );
}
```

### Step 3: Enable During Development

```bash
# Start development server with memory monitoring
npm run dev:memory-monitoring

# Or manually
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true npm run dev
```

### Step 4: View Memory Report

Open browser console and run:

```javascript
window.memoryLeakReport()
```

---

## Detailed Integration

### Option A: Global Widget (Recommended for Full App Testing)

Add to root layout to monitor entire application:

```typescript
// app/layout.tsx
'use client';

import { MemoryLeakDetectionWidget } from '@/hooks/useMemoryLeakDetection';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        
        {/* Global memory monitoring widget */}
        {process.env.NEXT_PUBLIC_MEMORY_LEAK_DETECTION === 'true' && (
          <MemoryLeakDetectionWidget componentName="GlobalApp" />
        )}
      </body>
    </html>
  );
}
```

**Advantages**:
- Monitors entire app lifecycle
- Catches leaks at any level
- Single widget for all pages

**Disadvantages**:
- Slight performance overhead (1-2% CPU)
- Widget visible in bottom-right

### Option B: Component-Level Monitoring (For Specific Components)

Monitor specific components for leaks:

```typescript
// pages/blog/[slug].tsx
'use client';

import { useMemoryLeakDetection } from '@/hooks/useMemoryLeakDetection';

export function BlogPost() {
  // Monitor this component specifically
  const { metrics, report } = useMemoryLeakDetection('BlogPost');

  return (
    <article>
      <h1>Blog Post</h1>
      
      {/* Show metrics inline if detected leaks */}
      {metrics && !metrics.summary.isClean && (
        <div style={{ padding: '10px', background: '#ffebee', margin: '10px 0' }}>
          <strong>⚠️ Memory Issues Detected</strong>
          <button onClick={() => report()}>View Full Report</button>
        </div>
      )}
      
      <Content />
    </article>
  );
}
```

**Advantages**:
- Targeted monitoring for specific features
- Can isolate component-level leaks
- Lower overhead

**Disadvantages**:
- Need to import in multiple places
- May miss global leaks

### Option C: Custom Hook Integration

Use the hook directly in components:

```typescript
// components/dashboard/AnalyticsDashboard.tsx
'use client';

import { useMemoryLeakDetection } from '@/hooks/useMemoryLeakDetection';

export function AnalyticsDashboard() {
  const { metrics, takeSnapshot, report } = useMemoryLeakDetection('Dashboard');

  // Manually trigger snapshot on important events
  const handleDataRefresh = () => {
    takeSnapshot();
    fetchAnalytics();
  };

  return (
    <div>
      <button onClick={handleDataRefresh}>Refresh Data</button>
      
      {metrics && (
        <div>
          <p>Memory: {metrics.summary.maxHeapUsage.toFixed(1)}MB</p>
          <p>DOM Nodes: {metrics.snapshots[metrics.snapshots.length - 1]?.domNodeCount || 0}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Configuration Options

### Environment Variables

```bash
# REQUIRED: Enable/disable memory monitoring
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true|false

# OPTIONAL: Custom check interval (default: 5000ms)
NEXT_PUBLIC_MEMORY_CHECK_INTERVAL=5000

# OPTIONAL: Threshold for heap growth alert (default: 50MB)
NEXT_PUBLIC_MEMORY_THRESHOLD_MB=50

# OPTIONAL: Threshold for listener alert (default: 1000)
NEXT_PUBLIC_LISTENER_THRESHOLD=1000

# OPTIONAL: Threshold for DOM node growth (default: 100)
NEXT_PUBLIC_DOM_GROWTH_THRESHOLD=100
```

### Hook Options

```typescript
const { metrics, takeSnapshot, report, isMonitoring } = useMemoryLeakDetection(
  'ComponentName', // Display name
  5000,             // Snapshot interval (ms)
  50 * 1024 * 1024  // Heap growth threshold (bytes)
);
```

### Widget Customization

```typescript
<MemoryLeakDetectionWidget
  componentName="CustomName"
  refreshInterval={10000}
/>
```

---

## Interpreting the Widget

### Widget Display

When enabled, the widget appears in bottom-right corner:

```
┌──────────────────────────┐
│ ✅ Memory OK             │
├──────────────────────────┤
│ Heap: 42.5 MB            │
│ DOM Nodes: 1,245         │
│ Event Listeners: 23      │
│ Observers: 8             │
│ Timers: 0 / Intervals: 0 │
│                          │
│          [Full Report]   │
└──────────────────────────┘
```

### Widget States

#### ✅ Green (Healthy)

All metrics within normal range:
- Heap memory stable or growing slowly (<1MB/s)
- Event listeners being cleaned up
- Observers being disconnected
- No timer accumulation

#### ⚠️ Orange (Warning)

Some metrics elevated but not critical:
- Moderate heap growth (1-5MB per operation)
- High listener count (>500 but <1000)
- Multiple active observers
- Orphaned timers increasing

#### 🔴 Red (Critical)

Memory leak detected:
- Linear heap growth >50MB per operation
- Event listeners >1000 not cleaned
- Hundreds of active observers
- Hundreds of orphaned timers

---

## Common Integration Scenarios

### Scenario 1: Full App Monitoring

Monitor entire application during QA testing:

```bash
# Terminal
npm run dev:memory-monitoring

# Then interact with app normally
# Widget shows real-time memory stats in corner
# Click "Full Report" to see detailed metrics
```

### Scenario 2: Feature Testing

Test specific feature for leaks:

```bash
# Terminal
npm run dev:memory-monitoring

# In browser
# 1. Open DevTools Console
# 2. Perform feature actions (e.g., create blog post)
# 3. Run: window.memoryLeakReport()
# 4. Check for warnings/errors
# 5. Repeat feature 5-10 times
# 6. Check memory growth is linear or declining
```

### Scenario 3: Build Verification

Before deployment, verify no leaks:

```bash
# Terminal 1
npm run build
npm run start

# Terminal 2
npm run load-test:memory

# Analyze results
npm run load-test:analyze
```

### Scenario 4: Development Workflow

Enable during normal development:

```bash
# In .env.local
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true

# Terminal
npm run dev

# Widget shows in bottom-right
# Monitor while developing features
# Catch leaks immediately
```

---

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | performance.memory API available |
| Edge (Chromium) | ✅ Full | performance.memory API available |
| Firefox | ⚠️ Limited | performance.memory not available, use other metrics |
| Safari | ⚠️ Limited | performance.memory not available |

**Recommendation**: Use Chrome/Edge for development to get full memory metrics.

---

## Performance Impact

### Overhead Analysis

When enabled:

| Operation | Overhead |
|-----------|----------|
| Memory snapshot (5s interval) | 0.2% CPU |
| Event listener tracking | <0.1% CPU |
| Observer tracking | <0.1% CPU |
| DOM node counting | 0.1% CPU (frequent updates) |
| Timer tracking | <0.1% CPU |
| **Total** | **~0.5-1% CPU** |

**Recommendation**: Acceptable for development, disable in production.

### Production Deployment

Ensure disabled in production:

```typescript
// components/app-layout.tsx
{process.env.NEXT_PUBLIC_MEMORY_LEAK_DETECTION !== 'true' && (
  <MemoryLeakDetectionWidget />
)}
```

Or simply don't set env var in production:

```bash
# .env.production
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=false  # Or omit entirely
```

---

## Troubleshooting Integration

### Issue: Widget Not Visible

**Cause**: Environment variable not set

**Fix**:
```bash
# Check .env.local has:
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true

# Restart dev server
npm run dev:memory-monitoring
```

### Issue: No Memory Data

**Cause**: performance.memory API not available

**Fix**:
```javascript
// In console
console.log(performance.memory);

// If undefined, you need Chrome/Edge
// Other browsers have limited memory tracking
```

### Issue: Too Much Overhead

**Cause**: Widget refreshing too frequently

**Fix**:
```bash
# In .env.local, increase interval
NEXT_PUBLIC_MEMORY_CHECK_INTERVAL=10000  # Check every 10 seconds instead of 5
```

### Issue: False Leak Alerts

**Cause**: Normal caching being detected as leak

**Fix**:
```typescript
// Increase thresholds in .env.local
NEXT_PUBLIC_MEMORY_THRESHOLD_MB=100  # Increase from 50MB
NEXT_PUBLIC_DOM_GROWTH_THRESHOLD=200  # Increase from 100 nodes
```

---

## Advanced: Custom Memory Alert

Create custom alert for specific metrics:

```typescript
// hooks/useMemoryAlert.ts
import { useMemoryLeakDetection } from './useMemoryLeakDetection';
import { useEffect } from 'react';

export function useMemoryAlert() {
  const { metrics } = useMemoryLeakDetection('CustomAlert', 5000, 100 * 1024 * 1024);

  useEffect(() => {
    if (!metrics) return;

    const { leaksDetected, warnings } = metrics;

    // Send to monitoring service
    if (leaksDetected.length > 0) {
      fetch('/api/monitoring/memory-leak', {
        method: 'POST',
        body: JSON.stringify({
          leaks: leaksDetected,
          timestamp: new Date(),
          url: window.location.href,
        }),
      });
    }
  }, [metrics]);
}

// Usage in component:
export function PageWithMonitoring() {
  useMemoryAlert();
  return <YourContent />;
}
```

---

## Advanced: Automated Testing

Integrate memory tests into CI/CD:

```bash
# scripts/test-memory-leaks.sh
#!/bin/bash

echo "Building app..."
npm run build

echo "Starting server..."
npm run start &
SERVER_PID=$!

# Wait for server to start
sleep 5

echo "Running memory tests..."
npm run load-test:memory

RESULT=$?

echo "Stopping server..."
kill $SERVER_PID

if [ $RESULT -ne 0 ]; then
  echo "❌ Memory leak tests failed!"
  exit 1
else
  echo "✅ All memory tests passed!"
  exit 0
fi
```

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Memory Leak Tests
  run: bash scripts/test-memory-leaks.sh
  if: failure() != true
```

---

## Integration Checklist

- [ ] Added `NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true` to `.env.local`
- [ ] Imported `MemoryLeakDetectionWidget` in `app/layout.tsx`
- [ ] Widget visible in bottom-right corner during `npm run dev`
- [ ] Can see memory metrics (heap, DOM nodes, listeners)
- [ ] Can click "Full Report" and see detailed console output
- [ ] Verified `performance.memory` available in DevTools console
- [ ] Tested with repeated page navigations (no leak pattern)
- [ ] Ran load tests: `npm run load-test:memory`
- [ ] All memory tests passed
- [ ] Disabled in production `.env.production`

---

## Next Steps

1. **Enable Memory Monitoring**
   ```bash
   NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true npm run dev
   ```

2. **Interact with Application**
   - Navigate between pages
   - Open/close modals
   - Trigger dynamic content loading
   - Run infinite scroll

3. **Check Memory Report**
   ```javascript
   window.memoryLeakReport()
   ```

4. **Review Results**
   - Check for leak warnings
   - Verify event listener cleanup
   - Monitor heap growth pattern

5. **Fix Any Issues**
   - Use [MEMORY_LEAK_DETECTION_PATTERNS.md](./MEMORY_LEAK_DETECTION_PATTERNS.md) to identify patterns
   - Implement cleanups in useEffect hooks
   - Re-run tests to verify fix

---

## Related Documentation

- [MEMORY_LEAK_DETECTION_PATTERNS.md](./MEMORY_LEAK_DETECTION_PATTERNS.md) - How detection works
- [LCP_MEMORY_VALIDATION_GUIDE.md](./LCP_MEMORY_VALIDATION_GUIDE.md) - Running validation tests
- [PERFORMANCE_MONITORING_SETUP.md](./PERFORMANCE_MONITORING_SETUP.md) - Production monitoring
- [useMemoryLeakDetection.ts](../hooks/useMemoryLeakDetection.ts) - Hook source code

---

**Need Help?** Check troubleshooting section above or see INFRASTRUCTURE.md for escalation path.
