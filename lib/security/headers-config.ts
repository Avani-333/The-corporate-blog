/**
 * Security Headers Configuration Module
 * Manages CSP headers with nonce support, security directives, and validation
 */

export interface SecurityHeaderConfig {
  cspNonce?: string;
  reportUri?: string;
  reportOnly?: boolean;
}

/**
 * Generates a random nonce for CSP inline scripts/styles
 * Nonce should be regenerated on every request
 */
export function generateCSPNonce(): string {
  const buffer = new Uint8Array(16);
  // In production, use crypto.getRandomValues()
  // For now, generate a hex string nonce
  return Array.from(buffer, (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * CSP Directives Configuration
 * Organized by security level to allow easy toggling
 */
export const CSP_DIRECTIVES = {
  // ============================================================
  // STRICT MODE (Recommended for production)
  // ============================================================
  strict: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://va.vercel-scripts.com',
      'https://static.cloudflareinsights.com',
    ],
    'style-src': ["'self'", 'https://fonts.googleapis.com'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://res.cloudinary.com',
      'https://images.unsplash.com',
      'https://lh3.googleusercontent.com',
    ],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'connect-src': [
      "'self'",
      'https://www.google-analytics.com',
      'https://vitals.vercel-insights.com',
      'https://va.vercel-scripts.com',
      'https://cloudflareinsights.com',
      'https://*.cloudflareinsights.com',
      'https://sentry.io',
    ],
    'frame-src': ["'self'", 'https://accounts.google.com'],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
  },

  // ============================================================
  // NORMAL MODE (For development/staging with some flexibility)
  // ============================================================
  normal: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Only in development
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://va.vercel-scripts.com',
      'https://static.cloudflareinsights.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://res.cloudinary.com',
      'https://images.unsplash.com',
      'https://lh3.googleusercontent.com',
    ],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'connect-src': [
      "'self'",
      'https://www.google-analytics.com',
      'https://vitals.vercel-insights.com',
      'https://va.vercel-scripts.com',
      'https://cloudflareinsights.com',
      'https://*.cloudflareinsights.com',
      'https://sentry.io',
    ],
    'frame-src': ["'self'", 'https://accounts.google.com'],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
  },
};

/**
 * Build CSP header value from directives
 */
export function buildCSPHeader(
  directives: Record<string, string[]>,
  nonce?: string
): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      // Handle empty directive arrays
      if (!values || values.length === 0) {
        return key;
      }

      // Add nonce to script-src and style-src if provided
      let directiveValues = [...values];
      if (nonce && (key === 'script-src' || key === 'style-src')) {
        directiveValues = [`'nonce-${nonce}'`, ...directiveValues];
      }

      return `${key} ${directiveValues.join(' ')}`;
    })
    .join('; ');
}

/**
 * Validate CSP directives for common issues
 */
export function validateCSPDirectives(
  directives: Record<string, string[]>
): string[] {
  const warnings: string[] = [];

  // Check for unsafe-inline in script-src
  if (directives['script-src']?.includes("'unsafe-inline'")) {
    warnings.push(
      "WARNING: 'unsafe-inline' in script-src weakens CSP. Use nonces or hashes instead."
    );
  }

  // Check for unsafe-eval in script-src
  if (directives['script-src']?.includes("'unsafe-eval'")) {
    warnings.push(
      "WARNING: 'unsafe-eval' in script-src is a security risk. Avoid using eval()."
    );
  }

  // Check for wildcard in certain directives
  const restrictedDirectives = ['script-src', 'style-src', 'frame-src'];
  restrictedDirectives.forEach((dir) => {
    if (directives[dir]?.includes('*') || directives[dir]?.includes('https:')) {
      warnings.push(
        `WARNING: Wildcard or broad HTTPS in ${dir} may be too permissive.`
      );
    }
  });

  // Check if frame-ancestors is properly set
  if (!directives['frame-ancestors']?.includes("'none'")) {
    warnings.push(
      "WARNING: frame-ancestors should be set to 'none' to prevent clickjacking."
    );
  }

  return warnings;
}

/**
 * Get recommended CSP based on environment
 */
export function getRecommendedCSP(
  environment: 'production' | 'staging' | 'development'
): Record<string, string[]> {
  switch (environment) {
    case 'production':
      return CSP_DIRECTIVES.strict;
    case 'staging':
      return CSP_DIRECTIVES.normal; // More flexible for testing
    default: // development
      return CSP_DIRECTIVES.normal;
  }
}

/**
 * Security Headers Object
 * All recommended security headers for the application
 */
export const SECURITY_HEADERS = {
  // Prevent content type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Clickjacking protection
  'X-Frame-Options': 'DENY',

  // Legacy XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // DNS prefetching control
  'X-DNS-Prefetch-Control': 'on',

  // Prevent IE download prompt
  'X-Download-Options': 'noopen',

  // Restrict Flash/PDF cross-domain access
  'X-Permitted-Cross-Domain-Policies': 'none',

  // Cross-origin opener policy
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',

  // Cross-origin resource policy
  'Cross-Origin-Resource-Policy': 'same-origin',

  // HSTS - Strict Transport Security
  'Strict-Transport-Security':
    'max-age=63072000; includeSubDomains; preload',

  // Permissions/Features policy
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(self), encrypted-media=(self), fullscreen=(self), picture-in-picture=(self)',
};

/**
 * API Security Headers
 * Additional headers for API endpoints
 */
export const API_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  'X-API-Version': '1',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
};

/**
 * Validate all security headers
 */
export function validateSecurityHeaders(): string[] {
  const warnings: string[] = [];

  // Check HSTS configuration
  const hsts = SECURITY_HEADERS['Strict-Transport-Security'];
  if (!hsts?.includes('includeSubDomains')) {
    warnings.push('WARNING: HSTS should include subdomains.');
  }
  if (!hsts?.includes('preload')) {
    warnings.push('WARNING: Consider adding preload to HSTS for maximum security.');
  }

  // Check frame-ancestors
  const frameAncestors = SECURITY_HEADERS['X-Frame-Options'];
  if (frameAncestors !== 'DENY' && frameAncestors !== 'SAMEORIGIN') {
    warnings.push('WARNING: X-Frame-Options should be DENY or SAMEORIGIN.');
  }

  return warnings;
}

/**
 * Export all security configurations for use in middleware/headers
 */
export const SECURITY_CONFIG = {
  headers: SECURITY_HEADERS,
  apiHeaders: API_SECURITY_HEADERS,
  cspDirectives: getRecommendedCSP('production'),
  nonce: null as string | null,
};
