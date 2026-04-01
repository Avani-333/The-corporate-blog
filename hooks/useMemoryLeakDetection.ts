/**
 * useMemoryLeakDetection Hook
 * 
 * Monitors client-side memory usage and detects potential memory leaks
 * during development. Tracks:
 * - Heap memory growth over time
 * - Event listener cleanup
 * - Observer cleanup
 * - DOM node count
 * - Timer/interval cleanup
 * 
 * Enable with: NEXT_PUBLIC_MEMORY_LEAK_DETECTION=true
 * View report with: window.memoryLeakReport()
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  jsHeapSizeLimit: number;
  domNodeCount: number;
  eventListeners: number;
  activeTimers: number;
  activeIntervals: number;
  observers: number;
}

interface MemoryMetrics {
  snapshots: MemorySnapshot[];
  leaksDetected: string[];
  warnings: string[];
  summary: {
    avgHeapGrowth: number;
    maxHeapUsage: number;
    domNodeGrowth: number;
    isClean: boolean;
  };
}

// ============================================================================
// GLOBALS FOR TRACKING
// ============================================================================

interface WindowWithMetrics extends Window {
  __memoryMetrics?: MemoryMetrics;
  __activeTimers?: number;
  __activeIntervals?: number;
  __eventListeners?: Set<{ target: EventTarget; event: string; handler: any }>;
  __observers?: Array<{ type: string; instance: any }>;
  memoryLeakReport?: () => void;
}

const w = typeof window !== 'undefined' ? (window as WindowWithMetrics) : null;

// ============================================================================
// INITIALIZE TRACKING (once per app)
// ============================================================================

if (w && !w.__memoryMetrics) {
  w.__memoryMetrics = {
    snapshots: [],
    leaksDetected: [],
    warnings: [],
    summary: {
      avgHeapGrowth: 0,
      maxHeapUsage: 0,
      domNodeGrowth: 0,
      isClean: true,
    },
  };

  w.__activeTimers = 0;
  w.__activeIntervals = 0;
  w.__eventListeners = new Set();
  w.__observers = [];

  // ========================================================================
  // HOOK INTO setInterval / setTimeout
  // ========================================================================

  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;
  const originalClearTimeout = window.clearTimeout;
  const originalClearInterval = window.clearInterval;

  window.setTimeout = function (...args: any[]) {
    w.__activeTimers!++;
    const id = originalSetTimeout.apply(this, args);
    return id;
  } as any;

  window.setInterval = function (...args: any[]) {
    w.__activeIntervals!++;
    const id = originalSetInterval.apply(this, args);
    return id;
  } as any;

  window.clearTimeout = function (id: number) {
    w.__activeTimers!--;
    return originalClearTimeout.call(this, id);
  };

  window.clearInterval = function (id: number) {
    w.__activeIntervals!--;
    return originalClearInterval.call(this, id);
  };

  // ========================================================================
  // HOOK INTO addEventListener / removeEventListener
  // ========================================================================

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    w.__eventListeners!.add({
      target: this,
      event: type,
      handler: listener,
    });
    return originalAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) {
    // Try to remove from tracking
    for (const item of w.__eventListeners!.values()) {
      if (item.target === this && item.event === type && item.handler === listener) {
        w.__eventListeners!.delete(item);
      }
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  // ========================================================================
  // HOOK INTO MutationObserver
  // ========================================================================

  const OriginalMutationObserver = window.MutationObserver;

  window.MutationObserver = class extends OriginalMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      w.__observers!.push({
        type: 'MutationObserver',
        instance: this,
      });
    }

    disconnect(): void {
      super.disconnect();
      w.__observers = w.__observers!.filter((o) => o.instance !== this);
    }
  } as any;

  // Copy static methods
  Object.setPrototypeOf(window.MutationObserver, OriginalMutationObserver);

  // ========================================================================
  // HOOK INTO IntersectionObserver
  // ========================================================================

  if (window.IntersectionObserver) {
    const OriginalIntersectionObserver = window.IntersectionObserver;

    window.IntersectionObserver = class extends OriginalIntersectionObserver {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        super(callback, options);
        w.__observers!.push({
          type: 'IntersectionObserver',
          instance: this,
        });
      }

      disconnect(): void {
        super.disconnect();
        w.__observers = w.__observers!.filter((o) => o.instance !== this);
      }
    } as any;

    Object.setPrototypeOf(window.IntersectionObserver, OriginalIntersectionObserver);
  }

  // ========================================================================
  // HOOK INTO ResizeObserver
  // ========================================================================

  if (window.ResizeObserver) {
    const OriginalResizeObserver = window.ResizeObserver;

    window.ResizeObserver = class extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        w.__observers!.push({
          type: 'ResizeObserver',
          instance: this,
        });
      }

      disconnect(): void {
        super.disconnect();
        w.__observers = w.__observers!.filter((o) => o.instance !== this);
      }
    } as any;

    Object.setPrototypeOf(window.ResizeObserver, OriginalResizeObserver);
  }

  // ========================================================================
  // EXPOSE REPORTING FUNCTION
  // ========================================================================

  w.memoryLeakReport = function () {
    const metrics = w.__memoryMetrics!;
    console.group('🔍 Memory Leak Detection Report');
    console.table({
      'Snapshots Collected': metrics.snapshots.length,
      'Leaks Detected': metrics.leaksDetected.length,
      'Warnings': metrics.warnings.length,
      'DOM Nodes (current)':
        metrics.snapshots.length > 0
          ? metrics.snapshots[metrics.snapshots.length - 1].domNodeCount
          : 0,
      'Heap Used (MB)':
        metrics.snapshots.length > 0
          ? (metrics.snapshots[metrics.snapshots.length - 1].heapUsed / 1048576).toFixed(2)
          : 'N/A',
      'Active Timers': w.__activeTimers,
      'Active Intervals': w.__activeIntervals,
      'Event Listeners': w.__eventListeners!.size,
      'Active Observers': w.__observers!.length,
    });

    if (metrics.leaksDetected.length > 0) {
      console.error('🚨 Detected Issues:');
      metrics.leaksDetected.forEach((leak) => console.error(`  - ${leak}`));
    }

    if (metrics.warnings.length > 0) {
      console.warn('⚠️ Warnings:');
      metrics.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    console.log('📊 Memory Snapshots:');
    console.table(
      metrics.snapshots.map((s) => ({
        ...s,
        heapUsed_MB: (s.heapUsed / 1048576).toFixed(2),
        heapTotal_MB: (s.heapTotal / 1048576).toFixed(2),
      }))
    );

    console.groupEnd();

    return metrics;
  };
}

// ============================================================================
// REACT HOOK
// ============================================================================

export function useMemoryLeakDetection(componentName: string = 'Component') {
  const [metrics, setMetrics] = useState<MemoryMetrics | null>(null);
  const snapshotIntervalRef = useRef<number | null>(null);
  const enabledRef = useRef(process.env.NEXT_PUBLIC_MEMORY_LEAK_DETECTION === 'true');

  const takeSnapshot = useCallback(() => {
    if (!w) return;

    const memory = performance.memory;
    if (!memory) {
      console.warn('performance.memory not available - enable Chrome DevTools for memory tracking');
      return;
    }

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      domNodeCount: document.querySelectorAll('*').length,
      eventListeners: w.__eventListeners!.size,
      activeTimers: w.__activeTimers!,
      activeIntervals: w.__activeIntervals!,
      observers: w.__observers!.length,
    };

    w.__memoryMetrics!.snapshots.push(snapshot);

    // Analyze for leaks
    analyzeForLeaks(w.__memoryMetrics!);

    setMetrics(w.__memoryMetrics);
  }, []);

  const analyzeForLeaks = (metrics: MemoryMetrics) => {
    const snapshots = metrics.snapshots;
    if (snapshots.length < 2) return;

    metrics.leaksDetected = [];
    metrics.warnings = [];

    const current = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];

    // Check 1: Heap memory growth
    const heapGrowth = current.heapUsed - previous.heapUsed;
    if (Math.abs(heapGrowth) > 5 * 1024 * 1024) {
      // 5MB threshold
      metrics.warnings.push(
        `Heap memory changed by ${(heapGrowth / 1048576).toFixed(2)}MB`
      );
    }

    // Check 2: DOM node growth
    const domGrowth = current.domNodeCount - previous.domNodeCount;
    if (domGrowth > 100) {
      // 100 node threshold
      metrics.leaksDetected.push(
        `DOM nodes increased by ${domGrowth} (potential leak in ${componentName})`
      );
    }

    // Check 3: Event listeners not cleaned
    if (current.eventListeners > 1000) {
      // 1000 listener threshold
      metrics.warnings.push(
        `High event listener count: ${current.eventListeners}. Check for cleanup.`
      );
    }

    // Check 4: Timers/intervals
    if (current.activeTimers > 100 || current.activeIntervals > 100) {
      metrics.warnings.push(
        `Active timers: ${current.activeTimers}, intervals: ${current.activeIntervals}. May indicate memory leak.`
      );
    }

    // Check 5: Observers
    if (current.observers > 50) {
      metrics.warnings.push(
        `High observer count: ${current.observers}. Verify all are being cleaned up.`
      );
    }

    // Update summary
    metrics.summary = {
      avgHeapGrowth:
        snapshots.length > 1
          ? snapshots
              .slice(1)
              .reduce((sum, s, i) => sum + (s.heapUsed - snapshots[i].heapUsed), 0) /
            (snapshots.length - 1) /
            1048576
          : 0,
      maxHeapUsage: Math.max(...snapshots.map((s) => s.heapUsed)) / 1048576,
      domNodeGrowth: current.domNodeCount - (snapshots[0]?.domNodeCount || 0),
      isClean: metrics.leaksDetected.length === 0,
    };
  };

  // Start monitoring on mount
  useEffect(() => {
    if (!enabledRef.current) {
      return;
    }

    // Take initial snapshot
    takeSnapshot();

    // Take snapshots every 5 seconds
    snapshotIntervalRef.current = window.setInterval(takeSnapshot, 5000) as any;

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, [takeSnapshot]);

  // Log when component unmounts (check for cleanup)
  useEffect(() => {
    return () => {
      if (enabledRef.current && process.env.NODE_ENV === 'development') {
        const report = w?.memoryLeakReport?.();
        if (report && !report.summary.isClean) {
          console.warn(
            `⚠️ ${componentName} unmounted with potential leaks detected. Check report above.`
          );
        }
      }
    };
  }, []);

  return {
    metrics,
    takeSnapshot,
    report: () => w?.memoryLeakReport?.(),
    isMonitoring: enabledRef.current,
  };
}

// ============================================================================
// COMPONENT FOR DISPLAYING METRICS
// ============================================================================

interface MemoryLeakDetectionWidgetProps {
  componentName?: string;
  refreshInterval?: number;
}

export function MemoryLeakDetectionWidget({
  componentName = 'App',
  refreshInterval = 5000,
}: MemoryLeakDetectionWidgetProps) {
  const { metrics } = useMemoryLeakDetection(componentName);

  if (!metrics || !process.env.NEXT_PUBLIC_MEMORY_LEAK_DETECTION) {
    return null;
  }

  const current = metrics.snapshots[metrics.snapshots.length - 1];
  const isHealthy = metrics.summary.isClean && metrics.warnings.length === 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: isHealthy ? '#e8f5e9' : '#fff3e0',
        border: `2px solid ${isHealthy ? '#4caf50' : '#ff9800'}`,
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        fontFamily: 'monospace',
        zIndex: 9999,
        maxWidth: 300,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
        {isHealthy ? '✅ Memory OK' : '⚠️ Memory Issues'}
      </div>

      {current && (
        <>
          <div>Heap: {(current.heapUsed / 1048576).toFixed(1)} MB</div>
          <div>DOM Nodes: {current.domNodeCount}</div>
          <div>Event Listeners: {current.eventListeners}</div>
          <div>Observers: {current.observers}</div>
          <div>
            Timers: {current.activeTimers} / Intervals: {current.activeIntervals}
          </div>
        </>
      )}

      {metrics.leaksDetected.length > 0 && (
        <div style={{ marginTop: 8, color: '#d32f2f' }}>
          {metrics.leaksDetected.map((leak, i) => (
            <div key={i} style={{ fontSize: 10 }}>
              🚨 {leak}
            </div>
          ))}
        </div>
      )}

      {metrics.warnings.length > 0 && (
        <div style={{ marginTop: 8, color: '#f57c00' }}>
          {metrics.warnings.slice(0, 2).map((warning, i) => (
            <div key={i} style={{ fontSize: 10 }}>
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => w?.memoryLeakReport?.()}
        style={{
          marginTop: 8,
          padding: '4px 8px',
          fontSize: 10,
          cursor: 'pointer',
          background: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: 4,
        }}
      >
        Full Report
      </button>
    </div>
  );
}

export default useMemoryLeakDetection;
