/**
 * Ad System Development & Testing Utilities
 *
 * Provides browser console helpers and testing utilities for the ad system.
 * Load these in development/staging environments only.
 *
 * Usage in browser console:
 * ```javascript
 * // List all ads on page
 * adDebug.listAds();
 *
 * // Test ad injection
 * adDebug.testInjectAd(2);
 *
 * // Remove all ads
 * adDebug.removeAll();
 * ```
 */

interface AdDebugUtils {
  listAds: () => void;
  testInjectAd: (afterH2Index: number) => void;
  removeAll: () => void;
  removeSlot: (slotId: string) => void;
  findH2s: () => void;
  checkScriptLoad: () => void;
  reloadAds: () => void;
  simulateAdLoad: (slotId: string) => void;
  generateReport: () => string;
}

/**
 * Initialize ad debugging tools
 * Safe to call multiple times
 */
export function initializeAdDebugUtils(): void {
  if ((window as any).adDebug) {
    console.log('Ad debug tools already initialized');
    return;
  }

  const adDebug: AdDebugUtils = {
    /**
     * List all ads currently on the page
     */
    listAds(): void {
      const ads = document.querySelectorAll('[data-ad-type]');
      console.group(`📢 Found ${ads.length} Ad Slots`);

      ads.forEach((ad, index) => {
        const id = ad.id;
        const type = ad.getAttribute('data-ad-type');
        const ins = ad.querySelector('ins.adsbygoogle');
        const isLoaded = !!ins;

        console.log(
          `%c${index + 1}. ${id} (${type})`,
          'font-weight: bold; color: #0066cc'
        );
        console.log({
          element: ad,
          isLoaded,
          adClientId: ins?.getAttribute('data-ad-client'),
          adSlotId: ins?.getAttribute('data-ad-slot'),
          format: ins?.getAttribute('data-ad-format'),
        });
      });

      console.groupEnd();
    },

    /**
     * Test injecting an ad after a specific H2
     * Useful for checking H2 selection logic
     */
    testInjectAd(afterH2Index: number): void {
      console.log(`🔬 Testing ad injection after H2 #${afterH2Index}...`);

      const h2s = Array.from(document.querySelectorAll('h2'));
      console.log(`Found ${h2s.length} H2 headings`);

      if (h2s.length < afterH2Index) {
        console.warn(`❌ Not enough H2s (need ${afterH2Index}, have ${h2s.length})`);
        return;
      }

      const targetH2 = h2s[afterH2Index - 1];
      console.log(`📍 Target H2: "${targetH2.textContent}"`);

      // Create test ad
      const testAd = document.createElement('div');
      testAd.id = `test-ad-${afterH2Index}`;
      testAd.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2rem;
        border-radius: 0.5rem;
        text-align: center;
        font-weight: bold;
        margin: 1.5rem auto;
        max-width: 728px;
      `;
      testAd.textContent = `✓ Test Ad Injected After H2 #${afterH2Index}`;

      targetH2.insertAdjacentElement('afterend', testAd);
      console.log('✅ Test ad injected successfully');
    },

    /**
     * Remove all ads from page
     */
    removeAll(): void {
      const ads = document.querySelectorAll('[data-ad-injection="true"]');
      ads.forEach((ad) => ad.remove());
      console.log(`🗑️ Removed ${ads.length} injected ads`);
    },

    /**
     * Remove a specific ad slot
     */
    removeSlot(slotId: string): void {
      const slot = document.getElementById(`ad-container-${slotId}`);
      if (slot) {
        slot.remove();
        console.log(`✓ Removed ad slot: ${slotId}`);
      } else {
        console.warn(`✗ Ad slot not found: ${slotId}`);
      }
    },

    /**
     * Find and display all H2 headings
     */
    findH2s(): void {
      const h2s = Array.from(document.querySelectorAll('h2'));
      console.group(`📋 Found ${h2s.length} H2 Headings`);

      h2s.forEach((h2, index) => {
        console.log(`  ${index + 1}. "${h2.textContent}"`);
      });

      console.groupEnd();
    },

    /**
     * Check if AdSense script loaded
     */
    checkScriptLoad(): void {
      console.group('🔍 AdSense Script Status');

      const script = document.querySelector(
        'script[src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
      );

      console.log('Script in DOM:', !!script);
      console.log('window.adsbygoogle exists:', !!window.adsbygoogle);

      if (window.adsbygoogle) {
        console.log('✅ AdSense is loaded and ready');
      } else {
        console.log('❌ AdSense script not loaded');
      }

      console.groupEnd();
    },

    /**
     * Reload/reinitialize all ads
     */
    reloadAds(): void {
      console.log('🔄 Reloading ads...');

      if (window.adsbygoogle) {
        try {
          (window.adsbygoogle as any).push({});
          console.log('✅ Ad reload triggered');
        } catch (err) {
          console.error('❌ Failed to reload ads:', err);
        }
      } else {
        console.error('❌ AdSense not loaded');
      }
    },

    /**
     * Simulate an ad load for testing
     */
    simulateAdLoad(slotId: string): void {
      const ins = document.querySelector(`ins[data-ad-slot="${slotId}"]`);
      if (!ins) {
        console.warn(`Ad slot not found: ${slotId}`);
        return;
      }

      console.log(`Simulating ad load for: ${slotId}`);

      // Simulate ad rendering
      (ins as HTMLElement).style.backgroundColor = '#f0f0f0';
      (ins as HTMLElement).style.display = 'block';
      (ins as HTMLElement).style.minHeight = '250px';

      // Add fake ad content
      const fakeAd = document.createElement('div');
      fakeAd.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 250px;
        background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%);
        border: 1px dashed #999;
        border-radius: 4px;
        font-size: 14px;
        color: #666;
      `;
      fakeAd.textContent = '[Simulated Ad]';

      (ins as HTMLElement).appendChild(fakeAd);
      console.log('✅ Simulation complete');
    },

    /**
     * Generate a debug report
     */
    generateReport(): string {
      const ads = document.querySelectorAll('[data-ad-type]');
      const h2s = document.querySelectorAll('h2');

      const report = `
╔════════════════════════════════════════╗
║   AD SYSTEM DEBUG REPORT               ║
╚════════════════════════════════════════╝

📊 STATISTICS
  • Total Ad Slots: ${ads.length}
  • Total H2 Headings: ${h2s.length}
  • AdSense Loaded: ${!!window.adsbygoogle ? '✅ Yes' : '❌ No'}

📍 H2 HEADINGS
${Array.from(h2s)
  .map((h2, i) => `  ${i + 1}. ${h2.textContent}`)
  .join('\n')}

📢 AD SLOTS
${Array.from(ads)
  .map((ad) => {
    const type = ad.getAttribute('data-ad-type');
    const id = ad.id;
    return `  • ${id} (${type})`;
  })
  .join('\n')}

🔧 ENVIRONMENT
  • URL: ${window.location.href}
  • User Agent: ${navigator.userAgent}
  • Timestamp: ${new Date().toISOString()}
      `;

      console.log(report);
      return report;
    },
  };

  // Attach to window for console access
  (window as any).adDebug = adDebug;

  console.log('%c✅ Ad Debug Tools Initialized', 'color: green; font-weight: bold');
  console.log('%cUse `adDebug` to access debugging utilities', 'color: blue');
  console.log('%cExamples: adDebug.listAds(), adDebug.findH2s(), adDebug.removeAll()', 'color: gray');
}

/**
 * Development component to test ad system
 * Only include in development/staging builds
 */
export function AdDebugPanel() {
  if (typeof window === 'undefined') {
    return null;
  }

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        backgroundColor: '#fff',
        border: '2px solid #0066cc',
        borderRadius: '0.5rem',
        padding: '1rem',
        zIndex: 9999,
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ marginBottom: '1rem', fontWeight: 'bold', color: '#0066cc' }}>
        🔧 Ad Debug Panel
      </div>

      <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#333' }}>
        <p>📌 Use browser console:</p>
        <code style={{ backgroundColor: '#f5f5f5', padding: '0.25rem 0.5rem', borderRadius: '3px' }}>
          adDebug.listAds()
        </code>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          Open DevTools → Console for more commands
        </p>
      </div>

      <button
        onClick={() => {
          (window as any).adDebug?.listAds?.();
        }}
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          width: '100%',
        }}
      >
        List Ads
      </button>
    </div>
  );
}
