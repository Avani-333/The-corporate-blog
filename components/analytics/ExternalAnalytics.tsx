'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics-events';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;
const CLOUDFLARE_WEB_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;

export function ExternalAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const pathWithQuery = query ? `${pathname}?${query}` : pathname;
    const absoluteUrl = typeof window !== 'undefined' ? window.location.href : pathWithQuery;
    trackPageView(pathname, absoluteUrl);
  }, [pathname, searchParams]);

  return (
    <>
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="lazyOnload"
            defer
          />
          <Script id="ga4-init" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
            `}
          </Script>
        </>
      )}

      {CLOUDFLARE_WEB_ANALYTICS_TOKEN && (
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="lazyOnload"
          defer
          data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_WEB_ANALYTICS_TOKEN })}
        />
      )}
    </>
  );
}
