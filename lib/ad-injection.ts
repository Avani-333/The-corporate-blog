import { ReactNode } from 'react';

export interface AdInjectionConfig {
  /**
   * Which H2 heading to inject after (1-indexed)
   * For example: 2 = inject after 2nd H2, 3 = inject after 3rd H2
   * @default 2
   */
  injectAfterH2Index?: number;

  /**
   * Ad slot configuration
   */
  adSlotId: string;

  /**
   * Type of ad
   */
  adType?: 'adsense' | 'direct' | 'placeholder';

  /**
   * Google AdSense client ID (required for adsense type)
   */
  adClientId?: string;

  /**
   * Google AdSense slot ID (required for adsense type)
   */
  adSlotSlotId?: string;

  /**
   * Ad format
   */
  format?: 'horizontal' | 'vertical' | 'auto';

  /**
   * Ad width
   */
  width?: number;

  /**
   * Ad height
   */
  height?: number;
}

/**
 * Client-side utility to inject ads into DOM after specific H2 headings
 *
 * This function is designed to work with React-rendered content and MDX
 * Can be used in useEffect to inject ads dynamically after hydration
 *
 * Usage (in useEffect):
 * ```tsx
 * useEffect(() => {
 *   injectAdAfterH2({
 *     injectAfterH2Index: 2,
 *     adSlotId: 'post-content-1',
 *     adType: 'adsense',
 *     adClientId: 'ca-pub-xxx',
 *     adSlotSlotId: 'xxx',
 *   });
 * }, []);
 * ```
 */
export function injectAdAfterH2(config: AdInjectionConfig): HTMLElement | null {
  const {
    injectAfterH2Index = 2,
    adSlotId,
    adType = 'placeholder',
    adClientId,
    adSlotSlotId,
    format = 'horizontal',
    width = 728,
    height = 90,
  } = config;

  try {
    // Find all H2 headings in the document
    const h2Elements = Array.from(document.querySelectorAll('h2'));

    if (h2Elements.length < injectAfterH2Index) {
      console.warn(
        `[AdInjection] Could not find H2 #${injectAfterH2Index} (found ${h2Elements.length} H2s)`
      );
      return null;
    }

    // Get the target H2 (0-indexed)
    const targetH2 = h2Elements[injectAfterH2Index - 1];
    if (!targetH2) {
      return null;
    }

    // Create ad container
    const adContainer = document.createElement('div');
    adContainer.id = `ad-container-${adSlotId}`;
    adContainer.setAttribute('data-ad-injection', 'true');

    // Calculate aspect ratio for CLS prevention
    const aspectRatio = (height / width) * 100;

    adContainer.style.cssText = `
      position: relative;
      width: 100%;
      max-width: ${width}px;
      margin: 1.5rem auto;
      background-color: transparent;
    `;

    // Create aspect ratio wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: relative;
      width: 100%;
      padding-bottom: ${aspectRatio}%;
    `;

    // Create inner container
    const inner = document.createElement('div');
    inner.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    if (adType === 'adsense') {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.cssText = `
        display: block;
        width: 100%;
        height: 100%;
      `;
      ins.setAttribute('data-ad-client', adClientId || '');
      ins.setAttribute('data-ad-slot', adSlotSlotId || '');
      ins.setAttribute('data-ad-format', format);
      ins.setAttribute('data-full-width-responsive', 'true');

      inner.appendChild(ins);
    } else if (adType === 'direct') {
      const brandDiv = document.createElement('div');
      brandDiv.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: white;
        font-size: 0.875rem;
        color: #6b7280;
      `;
      brandDiv.textContent = 'Brand Advertisement';
      inner.appendChild(brandDiv);
    } else {
      // Placeholder
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 0.5rem;
        background-color: #f9fafb;
        border: 1px dashed #e5e7eb;
        border-radius: 0.5rem;
      `;
      placeholder.innerHTML = `
        <svg style="width: 2rem; height: 2rem; color: #d1d5db;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span style="font-size: 0.75rem; color: #9ca3af;">Ad Placeholder</span>
      `;
      inner.appendChild(placeholder);
    }

    wrapper.appendChild(inner);
    adContainer.appendChild(wrapper);

    // Insert after the target H2
    targetH2.insertAdjacentElement('afterend', adContainer);

    return adContainer;
  } catch (err) {
    console.error('[AdInjection] Error injecting ad:', err);
    return null;
  }
}

/**
 * Find H2 headings with optional filtering
 *
 * Useful for determining which H2 index to target for ad injection
 *
 * Usage:
 * ```tsx
 * const h2s = findH2Headings();
 * console.log(`Found ${h2s.length} H2 headings`);
 * ```
 */
export function findH2Headings(
  selector: string = 'h2'
): { index: number; element: HTMLElement; text: string }[] {
  const h2Elements = Array.from(document.querySelectorAll(selector));

  return h2Elements.map((el, index) => ({
    index: index + 1,
    element: el as HTMLElement,
    text: el.textContent || '',
  }));
}

/**
 * Remove injected ads from the page
 *
 * Usage:
 * ```tsx
 * removeInjectedAds('post-content-1');
 * // or remove all
 * removeInjectedAds();
 * ```
 */
export function removeInjectedAds(adSlotId?: string): void {
  if (adSlotId) {
    const container = document.getElementById(`ad-container-${adSlotId}`);
    if (container) {
      container.remove();
    }
  } else {
    // Remove all injected ads
    document.querySelectorAll('[data-ad-injection="true"]').forEach((el) => {
      el.remove();
    });
  }
}

/**
 * Reinitialize ads (useful for single-page navigation)
 * Call this after dynamic content is added to the page
 *
 * Usage:
 * ```tsx
 * useEffect(() => {
 *   reinitializeAds?.();
 * }, [pathname]);
 * ```
 */
export function reinitializeAds(): void {
  if (window.adsbygoogle) {
    try {
      (window.adsbygoogle as any).push({});
    } catch (err) {
      console.error('[AdInjection] Failed to reinitialize ads:', err);
    }
  }
}
