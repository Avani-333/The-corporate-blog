# LCP & Memory Leak Validation Guide

**Status**: ✅ Complete  
**Last Updated**: 2026-03-21  
**Target LCP**: <2000ms under load  
**Target Memory Growth**: <50MB per operation  
**Memory Leak Threshold**: Zero detected

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Running Tests](#running-tests)
3. [Interpreting Results](#interpreting-results)
4. [Memory Leak Detection](#memory-leak-detection)
5. [Debugging Issues](#debugging-issues)
6. [Performance Recommendations](#performance-recommendations)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

```bash
# Install k6 (load testing framework)
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
# Or download from https://k6.io/docs/get-started/installation/
```

### Run Full Validation Suite

```bash
# Run comprehensive LCP and memory validation
npm run load-test:validation

# Run LCP test specifically
npm run load-test:lcp

# Run memory leak detection
npm run load-test:memory

# Enable development memory monitoring
npm run dev:memory-monitoring
```

---

## Running Tests

### Test Scenarios

#### 1. LCP (Largest Contentful Paint) Test

Measures rendering performance under load.

```bash
npm run load-test:lcp
```

**What it tests:**
- Page load time under normal conditions
- LCP metric measurement
- Memory usage during page rendering
- Ad script impact on LCP

**Expected Results:**
- LCP P50 < 1500ms
- LCP P95 < 2000ms
- LCP P99 < 2500ms

#### 2. Memory Leak Detection Test

Tests for memory leaks during repeated operations.

```bash
npm run load-test:memory
```

**What it tests:**
- Memory growth across 10 page loads
- Event listener cleanup
- Observer cleanup (MutationObserver, IntersectionObserver, ResizeObserver)
- DOM node stability
- Timer/interval cleanup

**Expected Results:**
- No memory leaks detected
- Memory growth < 50MB per operation
- All event listeners cleaned up
- All observers cleaned up
- DOM nodes stable across navigations

#### 3. Sustained Load Test

Tests performance under sustained high load.

```bash
npm run load-test:validation
```

**Load Profile:**
- Ramp-up: 1→10 VUs over 2 minutes
- Steady state: 10 VUs for 5 minutes
- Ramp-down: 10→1 VUs over 2 minutes

**Duration**: ~9 minutes total

---

## Interpreting Results

### Success Criteria

✅ **PASS** when all of the following are true:

```
┌─────────────────────────────────────────────────┐
│ LCP Metrics (Largest Contentful Paint)         │
├─────────────────────────────────────────────────┤
│ ✅ LCP P50          < 1500ms                   │
│ ✅ LCP P95          < 2000ms                   │
│ ✅ LCP P99          < 2500ms                   │
│ ✅ Violations       = 0                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Memory Metrics                                  │
├─────────────────────────────────────────────────┤
│ ✅ Heap Growth      < 50MB/operation           │
│ ✅ Memory Leaks     = 0                        │
│ ✅ DOM Node Growth  < 100 nodes/page           │
│ ✅ Event Listeners  Fully cleaned up           │
│ ✅ Observers        Fully cleaned up           │
│ ✅ Timers/Intervals = 0 after cleanup          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Layout Metrics                                  │
├─────────────────────────────────────────────────┤
│ ✅ CLS (Cumulative Layout Shift) < 0.1         │
│ ✅ TTI (Time to Interactive)      < 3000ms     │
│ ✅ FID/INP (Input Delay)          < 100ms      │
└─────────────────────────────────────────────────┘
```

### Example Output

```
       checks........................: 100.00% ✓ 520       ✗ 0
     data_received..................: 1.2 MB  13 kB/s
     data_sent.......................: 145 kB  1.5 kB/s
     http_req_duration...............: avg=1,247ms min=890ms med=1,120ms max=3,450ms p(95)=1,890ms p(99)=2,340ms
     http_req_failed.................: 0.00%   ✓ 0        ✗ 520
   ✓ lcp.............................: avg=1,234ms min=1,020ms med=1,185ms max=2,890ms p(95)=1,850ms p(99)=2,210ms
   ✓ lcp_above_threshold............: 0        (checks)
   ✓ client_heap_used_mb............: avg=42.5 min=28 max=67
   ✓ client_memory_growth_mb........: avg=1.2 min=0.1 max=8.5
   ✓ memory_leak_detected...........: 0        (checks)
   ✓ event_listeners................: avg=23 min=2 max=156
   ✓ uncleaned_listeners............: 0        (checks)
   ✓ observers_count................: avg=8 min=1 max=24
   ✓ uncleaned_observers............: 0        (checks)
   ✓ dom_nodes.......................: avg=1,245 min=890 max=1,890
   ✓ dom_node_growth_detected.......: 0        (checks)

🎉 All checks passed! Performance is healthy.
```

---

## Memory Leak Detection

### How It Works

The validator tracks potential memory leaks through 5 mechanisms:

#### 1. Event Listener Tracking

**What it does:**
- Wraps `addEventListener()` to track all registered listeners
- Unwraps `removeEventListener()` to track cleanup
- Detects listeners that aren't removed between page navigations

**Detection code:**

```typescript
EventTarget.prototype.addEventListener = function(type, listener, options) {
  __eventListeners.add({ target: this, event: type, handler: listener });
  return originalAddEventListener.call(this, type, listener, options);
};

EventTarget.prototype.removeEventListener = function(type, listener, options) {
  // Remove from tracking when cleaned up
  __eventListeners.delete(trackedListener);
  return originalRemoveEventListener.call(this, type, listener, options);
};
```

**What to look for:**
- Unbalanced addEventListener/removeEventListener calls
- Event listeners lingering after page navigation
- Hundreds of listeners accumulating over time

#### 2. Observer Tracking

**What it does:**
- Wraps MutationObserver, IntersectionObserver, ResizeObserver
- Tracks `disconnect()` calls
- Detects observers that remain active after cleanup

**Detection code:**

```typescript
window.MutationObserver = class extends OriginalMutationObserver {
  constructor(callback) {
    super(callback);
    __observers.push({ type: 'MutationObserver', instance: this });
  }
  
  disconnect() {
    super.disconnect();
    __observers = __observers.filter(o => o.instance !== this);
  }
};
```

**What to look for:**
- Observers created but never disconnected
- Multiple observers watching same DOM node
- Observers preventing garbage collection

#### 3. Memory Trend Analysis

**What it does:**
- Compares heap memory across page loads
- Calculates average growth per operation
- Detects non-linear growth patterns

**Thresholds:**
- Alert if avg growth > 50MB/operation
- Alert if max heap > 500MB
- Alert if growth is non-linear (indicates leak)

**Example analysis:**

```
Load 1: 28MB → growth: +0MB (baseline)
Load 2: 29.5MB → growth: +1.5MB ✅
Load 3: 30.8MB → growth: +1.3MB ✅
Load 4: 32.1MB → growth: +1.3MB ✅
...
Load 10: 40.2MB → avg growth: +1.24MB ✅

VERDICT: ✅ Linear growth, not a leak
```

**Leak pattern example:**

```
Load 1: 28MB → growth: +0MB (baseline)
Load 2: 35MB → growth: +7MB ❌
Load 3: 50MB → growth: +15MB ❌
Load 4: 75MB → growth: +25MB ❌
...
Load 10: 280MB → avg growth: +28.2MB ❌

VERDICT: ❌ Exponential growth, definite leak!
```

#### 4. DOM Node Accumulation

**What it does:**
- Counts DOM nodes via `document.querySelectorAll('*')`
- Detects sudden increases in node count
- Identifies DOM trees not being removed from memory

**Thresholds:**
- Alert if growth > 100 nodes per page load
- Alert if DOM remains > 10,000 nodes

#### 5. Timer/Interval Cleanup

**What it does:**
- Tracks `setTimeout()` and `setInterval()` calls
- Validates `clearTimeout()` and `clearInterval()` are called
- Detects orphaned timers keeping memory alive

**Detection code:**

```typescript
window.setTimeout = function(...args) {
  __activeTimers++;
  return originalSetTimeout.apply(this, args);
};

window.clearTimeout = function(id) {
  __activeTimers--;
  return originalClearTimeout.call(this, id);
};
```

**What to look for:**
- Timer counts growing with each page load
- Intervals never being cleared
- Background timers preventing garbage collection

---

## Debugging Issues

### Issue: High LCP (>2000ms)

**Possible Causes:**

1. **Slow Ad Script Loading**
   ```bash
   # Check ad script in Network tab (DevTools → Network)
   # Look for: analytics scripts, ad networks, third-party providers
   ```

2. **Large Images Not Optimized**
   ```bash
   # Run Lighthouse audit
   npm run lighthouse -- http://localhost:3000/blog/post-slug
   ```

3. **Unoptimized Database Queries**
   ```bash
   # Enable query monitoring
   LOG_QUERIES=true npm run dev
   
   # Check for N+1 patterns
   # Use lib/database/queryMonitoring.ts to detect
   ```

4. **Font Loading Delays**
   ```css
   /* Add font-display: swap to reduce layout shift */
   @font-face {
     font-family: 'Inter';
     font-display: swap;
     src: url('/fonts/Inter.woff2') format('woff2');
   }
   ```

**Fix Steps:**

```bash
# 1. Check current LCP
npm run load-test:lcp

# 2. Identify bottleneck
open "DevTools → Performance tab"

# 3. Apply fix (example: lazy load ads)
# See: components/ads/AdComponent.tsx

# 4. Verify improvement
npm run load-test:lcp

# 5. Check before/after
npm run load-test:analyze
```

### Issue: Memory Leaks Detected

**Check Event Listeners:**

```javascript
// In browser console
window.memoryLeakReport()

// Check event listeners output
Event Listeners: 2450 ← Too high!
Uncleaned listeners: 318 ← Should be 0
```

**Find Memory Leak:**

```javascript
// In browser DevTools → Console
// Enable memory detection
NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true

// Uses the useMemoryLeakDetection hook
// Run a page navigation cycle
// Look for warnings in console
```

**Common Leak Patterns:**

1. **Event Listeners Not Cleaned**
   ```typescript
   // ❌ BAD
   useEffect(() => {
     window.addEventListener('scroll', handleScroll);
     // No cleanup function!
   }, []);

   // ✅ GOOD
   useEffect(() => {
     window.addEventListener('scroll', handleScroll);
     return () => window.removeEventListener('scroll', handleScroll);
   }, []);
   ```

2. **Observers Not Disconnected**
   ```typescript
   // ❌ BAD
   const observer = new MutationObserver(callback);
   observer.observe(element, { childList: true });
   // Never calls observer.disconnect()

   // ✅ GOOD
   useEffect(() => {
     const observer = new MutationObserver(callback);
     observer.observe(element, { childList: true });
     return () => observer.disconnect();
   }, []);
   ```

3. **Intervals Not Cleared**
   ```typescript
   // ❌ BAD
   setInterval(() => {
     fetchMetrics();
   }, 5000);
   // Interval runs forever

   // ✅ GOOD
   useEffect(() => {
     const interval = setInterval(() => {
       fetchMetrics();
     }, 5000);
     return () => clearInterval(interval);
   }, []);
   ```

---

## Performance Recommendations

### 1. Image Optimization

```typescript
// Use next/image with Cloudinary
import Image from 'next/image';

export function BlogImage({ src, alt }) {
  return (
    <Image
      src={src}
      alt={alt}
      priority={false} // Use priority for LCP image only
      placeholder="blur"
      blurDataURL={getBlurDataUrl(src)}
      sizes="(max-width: 640px) 100vw,
             (max-width: 1280px) 50vw,
             33vw"
    />
  );
}
```

### 2. Code Splitting

```typescript
// Dynamic imports for below-the-fold components
import dynamic from 'next/dynamic';

const CommentsSection = dynamic(
  () => import('@/components/blog/CommentsSection'),
  { loading: () => <p>Loading comments...</p>, ssr: false }
);

export function BlogPost() {
  return (
    <>
      <BlogContent />
      <CommentsSection /> {/* Loaded async */}
    </>
  );
}
```

### 3. Font Optimization

```typescript
// Use next/font for system imports
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevent FOUT
  variable: '--font-inter',
  preload: true,
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      {children}
    </html>
  );
}
```

### 4. Database Query Optimization

```typescript
// Use batch queries, not N+1
import { getOptimizedQueries } from '@/lib/database/optimizedQueries';

// ❌ BAD - N+1 queries
posts.forEach(post => {
  const author = await db.user.findUnique({ where: { id: post.authorId } });
});

// ✅ GOOD - Batch query
const authors = await db.user.findMany({
  where: { id: { in: posts.map(p => p.authorId) } }
});
```

### 5. Eliminate Memory Leaks

See [Memory Leak Detection](#memory-leak-detection) section above.

---

## Troubleshooting

### k6 Not Found

```bash
# Install k6
brew install k6  # macOS
# Or download from https://k6.io/docs/get-started/installation/

# Verify installation
k6 version
```

### performance.memory API Not Available

```bash
# This API is only available in Chrome/Edge
# Use chromium-based browser for testing

# Check if available
console.log(performance.memory); // Should return object, not undefined
```

### Tests Timeout

```bash
# Increase timeout in lcp-memory-validator.ts
// Default: 30s per test
// Change in validator: import { sleep } from 'k6';

// Or increase system timeout
k6 run --duration=120s scripts/load-test/lcp-memory-validator.ts
```

### Port Already in Use

```bash
# If running local server on 3000
lsof -i :3000  # Find process using port
kill -9 <PID>   # Kill process

# Or use different port
PORT=3001 npm run dev
# Update k6 script baseURL to http://localhost:3001
```

### Memory Report Shows High Numbers

**Check if legitimate:**

```javascript
// In console
const report = window.memoryLeakReport();

// Check heap vs limit
const heapUsedMB = report.snapshots[0].heapUsed / 1048576;
const heapLimitMB = report.snapshots[0].jsHeapSizeLimit / 1048576;
const ratio = heapUsedMB / heapLimitMB;

if (ratio < 0.5) {
  console.log('✅ Heap usage is healthy');
} else {
  console.warn('⚠️ Heap usage is high, but may not be a leak');
}
```

**Common False Positives:**

1. **Browser Cache Growing** - Normal, not a leak
2. **First Load Optimizations** - Caches and indexes loaded first time
3. **Ad Script Initialization** - May allocate memory on first load

**Verify Real Leak:**

```javascript
// Reload page 5 times without leaving tab
// Check memory growth pattern

// TRUE LEAK: 10MB → 20MB → 30MB → 40MB (linear)
// FALSE POSITIVE: 10MB → 15MB → 16MB → 16.5MB (settling)
```

---

## Next Steps

1. ✅ **Run validation suite**
   ```bash
   npm run load-test:validation
   ```

2. ✅ **Check results against success criteria** (see [Success Criteria](#success-criteria))

3. ✅ **Document baseline metrics**
   ```bash
   npm run load-test:analyze > ./reports/baseline.txt
   ```

4. ✅ **Enable development monitoring**
   ```bash
   npm run dev:memory-monitoring
   ```

5. ✅ **Set up automated alerts** (see MONITORING_IMPLEMENTATION_CHECKLIST.md)

---

## Related Documentation

- [DATABASE_OPTIMIZATION_QUICK_REFERENCE.md](./DATABASE_OPTIMIZATION_QUICK_REFERENCE.md) - Query optimization
- [PERFORMANCE_MONITORING_SETUP.md](./PERFORMANCE_MONITORING_SETUP.md) - Metrics collection
- [SECURITY_CONFIGURATION_GUIDE.md](./SECURITY_CONFIGURATION_GUIDE.md) - Security headers

---

**Contact**: See INFRASTRUCTURE.md for escalation path
