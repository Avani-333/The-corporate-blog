'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';

export type AdType = 'adsense' | 'direct' | 'placeholder';

interface AdSlotProps {
  /**
   * Unique identifier for the ad slot (used for multiple ads on same page)
   * Example: 'post-content-1', 'sidebar-1'
   */
  id: string;

  /**
   * Type of ad to display
   * - 'adsense': Google AdSense
   * - 'direct': Direct brand sponsorship ads
   * - 'placeholder': Fallback placeholder
   */
  type?: AdType;

  /**
   * Google AdSense client ID. Required if type='adsense'
   * Example: 'ca-pub-xxxxxxxxxxxxxxxx'
   */
  adClientId?: string;

  /**
   * Google AdSense slot ID. Required if type='adsense'
   * Example: 'xxxxxxxxxxxxxxxx'
   */
  adSlotId?: string;

  /**
   * Placement strategy - horizontal or vertical
   * @default 'horizontal'
   */
  format?: 'horizontal' | 'vertical' | 'auto';

  /**
   * Container width in pixels for sizing
   * @default 728
   */
  width?: number;

  /**
   * Container height in pixels for sizing
   * @default 90
   */
  height?: number;

  /**
   * Class name for custom styling
   */
  className?: string;

  /**
   * Callback when ad is successfully loaded
   */
  onAdLoad?: () => void;

  /**
   * Callback when ad fails to load
   */
  onAdError?: () => void;
}

/**
 * Reusable AdSlot component with:
 * - Lazy loading via Intersection Observer
 * - No CLS (Cumulative Layout Shift) via fixed dimensions
 * - Support for Google AdSense, direct ads, and placeholders
 *
 * Usage:
 * ```tsx
 * <AdSlot
 *   id="post-content-1"
 *   type="adsense"
 *   adClientId="ca-pub-xxx"
 *   adSlotId="xxx"
 *   width={728}
 *   height={90}
 * />
 * ```
 */
export const AdSlot = ({
  id,
  type = 'placeholder',
  adClientId,
  adSlotId,
  format = 'horizontal',
  width = 728,
  height = 90,
  className = '',
  onAdLoad,
  onAdError,
}: AdSlotProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { ref: inViewRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true, // Only load once when it comes into view
  });

  // Merge both refs
  useEffect(() => {
    if (containerRef.current && inViewRef) {
      inViewRef(containerRef.current);
    }
  }, [inViewRef]);

  // Load ad script when in view
  useEffect(() => {
    if (!inView || isLoaded || hasError || type === 'placeholder') {
      return;
    }

    const loadAdScript = async () => {
      try {
        if (type === 'adsense') {
          if (!adClientId || !adSlotId) {
            console.warn(`AdSlot[${id}]: Missing adClientId or adSlotId for AdSense`);
            setHasError(true);
            onAdError?.();
            return;
          }

          // Dynamically load Google AdSense script
          const script = document.createElement('script');
          script.async = true;
          script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
          script.setAttribute('data-ad-client', adClientId);
          script.setAttribute('crossorigin', 'anonymous');

          script.onload = () => {
            // Push the ad after script loads
            if (containerRef.current && window.adsbygoogle) {
              try {
                (window.adsbygoogle as any).push({});
                setIsLoaded(true);
                onAdLoad?.();
              } catch (err) {
                console.error(`AdSlot[${id}]: Failed to push ad`, err);
                setHasError(true);
                onAdError?.();
              }
            }
          };

          script.onerror = () => {
            console.error(`AdSlot[${id}]: Failed to load AdSense script`);
            setHasError(true);
            onAdError?.();
          };

          document.head.appendChild(script);
        } else if (type === 'direct') {
          // Placeholder for direct ad implementation
          setIsLoaded(true);
          onAdLoad?.();
        }
      } catch (err) {
        console.error(`AdSlot[${id}]: Error loading ad`, err);
        setHasError(true);
        onAdError?.();
      }
    };

    loadAdScript();
  }, [inView, isLoaded, hasError, id, type, adClientId, adSlotId, onAdLoad, onAdError]);

  // Determine aspect ratio for CLS prevention
  const aspectRatio = (height / width) * 100;

  return (
    <div
      ref={containerRef}
      id={`ad-slot-${id}`}
      className={`ad-slot-container ${className}`}
      data-ad-type={type}
      // Fixed container to prevent CLS
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${width}px`,
        margin: '1.5rem auto 1.5rem auto',
        backgroundColor: hasError || type === 'placeholder' ? '#f3f4f6' : 'transparent',
        border: hasError || type === 'placeholder' ? '1px dashed #e5e7eb' : 'none',
        borderRadius: '0.5rem',
      }}
    >
      {/* Aspect ratio container to prevent CLS */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: `${aspectRatio}%`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {type === 'adsense' && !hasError && (
            <ins
              className="adsbygoogle"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
              }}
              data-ad-client={adClientId}
              data-ad-slot={adSlotId}
              data-ad-format={format}
              data-full-width-responsive="true"
            />
          )}

          {type === 'direct' && !hasError && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                fontSize: '0.875rem',
                color: '#6b7280',
              }}
            >
              {/* Direct brand ad content goes here */}
              <span>Brand Advertisement</span>
            </div>
          )}

          {(type === 'placeholder' || (hasError && type !== 'placeholder')) && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '0.5rem',
                backgroundColor: '#f9fafb',
              }}
            >
              <svg
                style={{
                  width: '2rem',
                  height: '2rem',
                  color: '#d1d5db',
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Ad Placeholder
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Loading indicator for development */}
      {!isLoaded && !hasError && type !== 'placeholder' && inView && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '0.5rem',
          }}
        >
          <div
            style={{
              width: '1rem',
              height: '1rem',
              border: '2px solid #e5e7eb',
              borderTopColor: '#9ca3af',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Type augmentation for adsbygoogle
declare global {
  interface Window {
    adsbygoogle?: any;
  }
}
