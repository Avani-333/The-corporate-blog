/**
 * Script Load Impact Monitor
 *
 * Monitors third-party script loading and their impact on Core Web Vitals.
 * Tracks:
 * - Script load timing
 * - Network impact (bytes, time)
 * - Core Web Vitals interaction
 * - Performance attribution
 *
 * @see docs/MONITORING_AND_ALERTS.md
 */

export interface ScriptMetric {
  name: string;
  url: string;
  loadTime: number; // ms
  executionTime: number; // ms
  byteSize: number; // bytes
  priority: 'high' | 'medium' | 'low';
  async: boolean;
  defer: boolean;
}

export interface ScriptImpact {
  script: ScriptMetric;
  fcp: number; // Impact on FCP (ms) - positive = slower
  lcp: number; // Impact on LCP (ms)
  cls: number; // Impact on CLS (shift amount)
  tti: number; // Impact on TTI (ms)
}

export interface ScriptLoadMonitorReport {
  timestamp: string;
  pageUrl: string;
  scripts: ScriptMetric[];
  impacts: ScriptImpact[];
  summary: {
    totalScripts: number;
    totalLoadTime: number;
    totalByteSize: number;
    estimatedFCPImpact: number;
    estimatedLCPImpact: number;
    criticalScripts: string[];
  };
}

class ScriptLoadMonitor {
  private scripts: Map<string, ScriptMetric> = new Map();
  private initialized = false;
  private performanceObserver: PerformanceObserver | null = null;
  private baselineMetrics: Record<string, number> = {};

  /**
   * Initialize script monitoring
   * Should be called as early as possible in app lifecycle
   */
  init() {
    if (typeof window === 'undefined' || this.initialized) return;

    this.initialized = true;

    // Observe resource timing entries (scripts)
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name.endsWith('.js') || entry.name.includes('adsbygoogle')) {
              this.recordScript(entry as PerformanceResourceTiming);
            }
          }
        });

        this.performanceObserver.observe({ entryTypes: ['resource', 'measure'] });
      } catch (error) {
        console.warn('Failed to initialize PerformanceObserver:', error);
      }
    }

    // Track existing scripts in DOM
    this.trackExistingScripts();

    // Monitor lazy-loaded scripts
    this.setupMutationObserver();
  }

  /**
   * Track scripts already in DOM
   */
  private trackExistingScripts() {
    if (typeof document === 'undefined') return;

    const scripts = document.querySelectorAll('script');
    scripts.forEach((script) => {
      if (script.src) {
        this.scripts.set(script.src, {
          name: this.extractScriptName(script.src),
          url: script.src,
          loadTime: 0,
          executionTime: 0,
          byteSize: 0,
          priority: script.hasAttribute('async') ? 'low' : 'high',
          async: script.hasAttribute('async'),
          defer: script.hasAttribute('defer'),
        });
      }
    });
  }

  /**
   * Setup mutation observer for dynamically added scripts
   */
  private setupMutationObserver() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const element = node as Element;
            if (element.tagName === 'SCRIPT' && element.getAttribute('src')) {
              this.trackNewScript(element as HTMLScriptElement);
            }
          }
        });
      });
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Track a newly added script
   */
  private trackNewScript(script: HTMLScriptElement) {
    const src = script.src;
    if (!src || this.scripts.has(src)) return;

    // Measure script execution
    const startMark = `script-start-${src}`;
    const endMark = `script-end-${src}`;

    performance.mark(startMark);

    const onLoad = () => {
      performance.mark(endMark);
      const measure = performance.measure(`script-${src}`, startMark, endMark);

      this.scripts.set(src, {
        name: this.extractScriptName(src),
        url: src,
        loadTime: measure.duration,
        executionTime: measure.duration,
        byteSize: 0, // Would need to fetch headers to get actual size
        priority: script.hasAttribute('async') ? 'low' : 'high',
        async: script.hasAttribute('async'),
        defer: script.hasAttribute('defer'),
      });

      script.removeEventListener('load', onLoad);
    };

    script.addEventListener('load', onLoad);
  }

  /**
   * Record script from performance timing
   */
  private recordScript(timing: PerformanceResourceTiming) {
    const url = timing.name;
    if (this.scripts.has(url)) return;

    this.scripts.set(url, {
      name: this.extractScriptName(url),
      url,
      loadTime: Math.round(timing.duration),
      executionTime: Math.round(timing.duration),
      byteSize: timing.decodedBodySize || timing.encodedBodySize || 0,
      priority: 'medium',
      async: false,
      defer: false,
    });
  }

  /**
   * Extract meaningful name from script URL
   */
  private extractScriptName(url: string): string {
    try {
      const urlObj = new URL(url);
      // Handle common ad networks
      if (urlObj.hostname.includes('adsbygoogle')) return 'Google AdSense';
      if (urlObj.hostname.includes('googletagmanager')) return 'Google Tag Manager';
      if (urlObj.hostname.includes('google-analytics')) return 'Google Analytics';
      if (urlObj.hostname.includes('facebook')) return 'Facebook Pixel';
      if (urlObj.hostname.includes('cloudflare')) return 'Cloudflare Script';

      // Use filename
      const filename = urlObj.pathname.split('/').pop() || url;
      return filename.split('?')[0];
    } catch {
      return url.split('/').pop() || url;
    }
  }

  /**
   * Measure the impact of a specific script on Core Web Vitals
   * This uses heuristics and network timing analysis
   */
  async measureScriptImpact(script: ScriptMetric): Promise<ScriptImpact> {
    // Heuristic: scripts blocking rendering impact FCP/LCP
    // Async/defer scripts have lower impact
    const blockingFactor = script.async || script.defer ? 0.3 : 0.8;

    // Network impact: longer loads = more impact
    const networkImpact = script.loadTime * blockingFactor;

    // Execution impact: js execution blocks main thread
    const executionImpact = script.executionTime * 0.5;

    // Third-party scripts often affect CLS with injected content
    const thirdPartyFactor = script.url.includes('pagead') ? 0.15 : 0; // AdSense impact

    return {
      script,
      fcp: networkImpact * 0.4, // FCP is affected by network + parsing
      lcp: networkImpact * 0.6 + executionImpact,
      cls: thirdPartyFactor,
      tti: networkImpact + executionImpact * 2, // TTI heavily affected by execution
    };
  }

  /**
   * Get all tracked scripts
   */
  getScripts(): ScriptMetric[] {
    return Array.from(this.scripts.values());
  }

  /**
   * Get critical (render-blocking) scripts
   */
  getCriticalScripts(): ScriptMetric[] {
    return this.getScripts().filter((s) => !s.async && !s.defer && !s.url.includes('analytics'));
  }

  /**
   * Generate monitoring report
   */
  async generateReport(): Promise<ScriptLoadMonitorReport> {
    const scripts = this.getScripts();

    // Calculate impacts for each script
    const impacts: ScriptImpact[] = [];
    for (const script of scripts) {
      const impact = await this.measureScriptImpact(script);
      impacts.push(impact);
    }

    // Calculate summary metrics
    const totalLoadTime = scripts.reduce((sum, s) => sum + s.loadTime, 0);
    const totalByteSize = scripts.reduce((sum, s) => sum + s.byteSize, 0);
    const estimatedFCPImpact = impacts.reduce((sum, i) => sum + i.fcp, 0);
    const estimatedLCPImpact = impacts.reduce((sum, i) => sum + i.lcp, 0);

    return {
      timestamp: new Date().toISOString(),
      pageUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
      scripts,
      impacts,
      summary: {
        totalScripts: scripts.length,
        totalLoadTime: Math.round(totalLoadTime),
        totalByteSize,
        estimatedFCPImpact: Math.round(estimatedFCPImpact),
        estimatedLCPImpact: Math.round(estimatedLCPImpact),
        criticalScripts: this.getCriticalScripts().map((s) => s.name),
      },
    };
  }

  /**
   * Get impact ratio: impact per kilobyte
   * Lower is better (less impact for the size)
   */
  getImpactEfficiency(scripts?: ScriptMetric[]): Map<string, number> {
    const scr = scripts || this.getScripts();
    const efficiency = new Map<string, number>();

    scr.forEach((script) => {
      const sizeKb = script.byteSize / 1024;
      const impactScore = script.loadTime + script.executionTime;
      efficiency.set(script.name, sizeKb > 0 ? impactScore / sizeKb : impactScore);
    });

    return efficiency;
  }

  /**
   * Identify scripts with high impact
   */
  getHighImpactScripts(threshold: number = 100): ScriptMetric[] {
    return this.getScripts().filter((s) => s.loadTime + s.executionTime > threshold);
  }

  /**
   * Reset monitor
   */
  reset() {
    this.scripts.clear();
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}

// Singleton instance
export const scriptLoadMonitor = new ScriptLoadMonitor();

/**
 * React hook for monitoring script loads
 */
export function useScriptLoadMonitor() {
  if (typeof window === 'undefined') return null;

  // Initialize on first use
  if (!scriptLoadMonitor) {
    scriptLoadMonitor.init();
  }

  return scriptLoadMonitor;
}

/**
 * Send script load metrics to analytics
 */
export async function reportScriptLoadMetrics() {
  if (typeof window === 'undefined') return;

  try {
    const report = await scriptLoadMonitor.generateReport();

    const payload = {
      eventName: 'script_load_monitoring',
      domain: 'performance',
      properties: {
        totalScripts: report.summary.totalScripts,
        totalLoadTime: report.summary.totalLoadTime,
        totalByteSize: report.summary.totalByteSize,
        estimatedFCPImpact: report.summary.estimatedFCPImpact,
        estimatedLCPImpact: report.summary.estimatedLCPImpact,
        criticalScriptCount: report.summary.criticalScripts.length,
        criticalScripts: report.summary.criticalScripts.join(','),
        scripts: report.scripts.map((s) => ({
          name: s.name,
          loadTime: s.loadTime,
          byteSize: s.byteSize,
          priority: s.priority,
        })),
      },
    };

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/events', blob);
    } else {
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Silently fail telemetry
      });
    }
  } catch (error) {
    console.warn('Failed to report script load metrics:', error);
  }
}
