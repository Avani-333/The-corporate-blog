/**
 * Security Headers Configuration (Helmet-equivalent for Next.js)
 *
 * Provides a comprehensive set of HTTP security headers matching and exceeding
 * what helmet.js sets up for Express. All headers are applied via next.config.js
 * and reinforced in middleware for API routes.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityHeaderConfig {
  key: string;
  value: string;
}

export interface SecurityHeadersOptions {
  /** The site's own origin, used in CSP and CORS. Default: process.env.NEXT_PUBLIC_SITE_URL */
  siteOrigin?: string;
  /** Enable Strict-Transport-Security. Default: true */
  hsts?: boolean;
  /** HSTS max-age in seconds. Default: 63072000 (2 years) */
  hstsMaxAge?: number;
  /** Include subdomains in HSTS. Default: true */
  hstsIncludeSubDomains?: boolean;
  /** Submit to browser HSTS preload list. Default: false (opt-in) */
  hstsPreload?: boolean;
  /** Content-Security-Policy directives. Override for custom policies. */
  cspDirectives?: Record<string, string[]>;
  /** Permissions-Policy features. */
  permissionsPolicy?: Record<string, string>;
  /** Allow embedding in iframes. Default: false (DENY) */
  allowIframes?: boolean;
  /** If frames are allowed, restrict to same origin. Default: true */
  framesSameOrigin?: boolean;
  /** Enable Cross-Origin isolation headers. Default: false */
  crossOriginIsolation?: boolean;
}

// ============================================================================
// DEFAULT CSP DIRECTIVES
// ============================================================================

function getDefaultCSP(siteOrigin: string): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://va.vercel-scripts.com', 'https://static.cloudflareinsights.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com', 'https://via.placeholder.com', 'https://www.google-analytics.com', 'https://lh3.googleusercontent.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'connect-src': ["'self'", siteOrigin, 'https://www.google-analytics.com', 'https://vitals.vercel-insights.com', 'https://va.vercel-scripts.com', 'https://cloudflareinsights.com', 'https://*.cloudflareinsights.com'],
    'frame-src': ["'self'", 'https://accounts.google.com'],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
    'block-all-mixed-content': [],
  };
}

// ============================================================================
// DEFAULT PERMISSIONS POLICY
// ============================================================================

function getDefaultPermissionsPolicy(): Record<string, string> {
  return {
    camera: '()',
    microphone: '()',
    geolocation: '()',
    'interest-cohort': '()',     // Opt out of FLoC
    'browsing-topics': '()',     // Opt out of Topics API
    payment: '()',
    usb: '()',
    magnetometer: '()',
    gyroscope: '()',
    accelerometer: '()',
    'ambient-light-sensor': '()',
    autoplay: '(self)',
    'encrypted-media': '(self)',
    fullscreen: '(self)',
    'picture-in-picture': '(self)',
  };
}

// ============================================================================
// HEADER GENERATION
// ============================================================================

function buildCSPString(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

function buildPermissionsPolicyString(features: Record<string, string>): string {
  return Object.entries(features)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

/**
 * Generate the full set of security headers.
 */
export function generateSecurityHeaders(options: SecurityHeadersOptions = {}): SecurityHeaderConfig[] {
  const {
    siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecorporateblog.com',
    hsts = true,
    hstsMaxAge = 63072000,
    hstsIncludeSubDomains = true,
    hstsPreload = false,
    cspDirectives,
    permissionsPolicy,
    allowIframes = false,
    framesSameOrigin = true,
    crossOriginIsolation = false,
  } = options;

  const headers: SecurityHeaderConfig[] = [];

  // ---- X-Content-Type-Options ----
  headers.push({ key: 'X-Content-Type-Options', value: 'nosniff' });

  // ---- X-Frame-Options ----
  if (!allowIframes) {
    headers.push({ key: 'X-Frame-Options', value: 'DENY' });
  } else if (framesSameOrigin) {
    headers.push({ key: 'X-Frame-Options', value: 'SAMEORIGIN' });
  }

  // ---- X-XSS-Protection ----
  // Deprecated in modern browsers but still useful for older ones
  headers.push({ key: 'X-XSS-Protection', value: '1; mode=block' });

  // ---- Referrer-Policy ----
  headers.push({ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' });

  // ---- Strict-Transport-Security ----
  if (hsts) {
    let hstsValue = `max-age=${hstsMaxAge}`;
    if (hstsIncludeSubDomains) hstsValue += '; includeSubDomains';
    if (hstsPreload) hstsValue += '; preload';
    headers.push({ key: 'Strict-Transport-Security', value: hstsValue });
  }

  // ---- Content-Security-Policy ----
  const csp = cspDirectives || getDefaultCSP(siteOrigin);
  headers.push({ key: 'Content-Security-Policy', value: buildCSPString(csp) });

  // ---- Permissions-Policy ----
  const pp = permissionsPolicy || getDefaultPermissionsPolicy();
  headers.push({ key: 'Permissions-Policy', value: buildPermissionsPolicyString(pp) });

  // ---- X-DNS-Prefetch-Control ----
  headers.push({ key: 'X-DNS-Prefetch-Control', value: 'on' });

  // ---- X-Download-Options (IE specific) ----
  headers.push({ key: 'X-Download-Options', value: 'noopen' });

  // ---- X-Permitted-Cross-Domain-Policies (Flash/PDF) ----
  headers.push({ key: 'X-Permitted-Cross-Domain-Policies', value: 'none' });

  // ---- Cross-Origin headers ----
  headers.push({ key: 'Cross-Origin-Opener-Policy', value: crossOriginIsolation ? 'same-origin' : 'same-origin-allow-popups' });
  headers.push({ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' });

  if (crossOriginIsolation) {
    headers.push({ key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' });
  }

  return headers;
}

/**
 * Format headers for next.config.js `headers()` return value.
 */
export function getNextConfigHeaders(options?: SecurityHeadersOptions) {
  const securityHeaders = generateSecurityHeaders(options);

  return [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ];
}

/**
 * Apply security headers to a NextResponse in middleware.
 */
export function applySecurityHeaders(
  response: Response | globalThis.Response,
  options?: SecurityHeadersOptions
): void {
  const securityHeaders = generateSecurityHeaders(options);
  for (const { key, value } of securityHeaders) {
    response.headers.set(key, value);
  }
}
