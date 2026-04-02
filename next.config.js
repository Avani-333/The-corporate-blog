const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable source maps in production to prevent secret leakage
  productionBrowserSourceMaps: false,
  
  // Skip type checking during builds 
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    domains: [
      'res.cloudinary.com',
      'images.unsplash.com',
      'via.placeholder.com',
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const siteOrigin = isProd ? 'https://thecorporateblog.com' : 'http://localhost:3000';

    return [
      // ---- Global Security Headers (Helmet-equivalent) ----
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Download-Options', value: 'noopen' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(self), encrypted-media=(self), fullscreen=(self), picture-in-picture=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Strict script-src: only allow self and trusted analytics/monitoring vendors
              // 'unsafe-inline' removed - requires external scripts or data attributes
              // 'unsafe-eval' removed - use event handlers in markup instead of eval()
              "script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://va.vercel-scripts.com https://static.cloudflareinsights.com",
              // Strict style-src: only self and Google Fonts
              // 'unsafe-inline' removed - use CSS modules and tailwind classes instead
              "style-src 'self' https://fonts.googleapis.com",
              // Image sources
              "img-src 'self' data: blob: https: images.unsplash.com https://res.cloudinary.com https://lh3.googleusercontent.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Connection sources for analytics and monitoring
              `connect-src 'self' ${siteOrigin} https://www.google-analytics.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://cloudflareinsights.com https://*.cloudflareinsights.com https://sentry.io`,
              // Frame sources - restrict to essential third-party
              "frame-src 'self' https://accounts.google.com",
              // Prevent embedding in frames (clickjacking protection)
              "frame-ancestors 'none'",
              // Disable plugins/objects
              "object-src 'none'",
              // Base URI restriction
              "base-uri 'self'",
              // Form actions to same origin only
              "form-action 'self'",
              // Upgrade all HTTP to HTTPS
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
      // ---- CORS headers for API routes ----
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: siteOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          { key: 'Access-Control-Expose-Headers', value: 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After' },
          { key: 'Vary', value: 'Origin' },
        ],
      },
      // ---- Search URLs are crawlable for discovery but never indexable ----
      {
        source: '/search',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
        ],
      },
      {
        source: '/search/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
        ],
      },
      // ---- Block access to source maps (security) ----
      {
        source: '/:path*.map',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/_next/:path*.map',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
      {
        source: '/robots.txt',
        destination: '/api/robots',
      },
    ];
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  env: {
    CUSTOM_KEY: 'production-blog',
  },
};

// Wrap with Sentry for source map handling and error tracking
module.exports = withSentryConfig(
  withBundleAnalyzer(nextConfig),
  {
    // Sentry configuration
    silent: true, // Suppress Sentry logs during build
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Automatically upload source maps to Sentry (release tracking)
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
  }
);