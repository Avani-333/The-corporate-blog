import { useEffect, useCallback } from 'react';

interface UseAdScriptOptions {
  /**
   * AdSense client ID
   */
  clientId?: string;

  /**
   * Whether to load the script immediately or on demand
   * @default false
   */
  immediate?: boolean;

  /**
   * Callback when script loads successfully
   */
  onLoad?: () => void;

  /**
   * Callback when script fails to load
   */
  onError?: (error: Error) => void;
}

/**
 * Hook for lazy loading Google AdSense script with error handling
 *
 * Usage:
 * ```tsx
 * const { isLoaded, error, loadAdScript } = useAdScript({
 *   clientId: 'ca-pub-xxx',
 *   immediate: false,
 * });
 *
 * // Manually load when needed
 * useEffect(() => {
 *   if (shouldLoad) {
 *     loadAdScript();
 *   }
 * }, [shouldLoad, loadAdScript]);
 * ```
 */
export function useAdScript({
  clientId,
  immediate = false,
  onLoad,
  onError,
}: UseAdScriptOptions) {
  const loadAdScript = useCallback(async () => {
    try {
      // Check if already loaded
      if (window.adsbygoogle) {
        onLoad?.();
        return;
      }

      // Check if script is already in the DOM
      const existingScript = document.querySelector(
        'script[src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
      );

      if (existingScript) {
        // Wait for existing script to load
        return new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (window.adsbygoogle) {
              clearInterval(checkInterval);
              onLoad?.();
              resolve();
            }
          }, 100);

          // Timeout after 5s
          setTimeout(() => {
            clearInterval(checkInterval);
            const error = new Error('AdSense script load timeout');
            onError?.(error);
            reject(error);
          }, 5000);
        });
      }

      // Create and load script
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        script.async = true;
        script.setAttribute('crossorigin', 'anonymous');

        if (clientId) {
          script.setAttribute('data-ad-client', clientId);
        }

        script.onload = () => {
          onLoad?.();
          resolve();
        };

        script.onerror = () => {
          const error = new Error('Failed to load AdSense script');
          onError?.(error);
          reject(error);
        };

        document.head.appendChild(script);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      throw error;
    }
  }, [clientId, onLoad, onError]);

  // Optionally load immediately
  useEffect(() => {
    if (immediate) {
      loadAdScript().catch((err) => {
        console.error('Failed to load AdSense script:', err);
      });
    }
  }, [immediate, loadAdScript]);

  return {
    loadAdScript,
  };
}
