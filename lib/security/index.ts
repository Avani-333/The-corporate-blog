/**
 * Security Module — Barrel Export
 *
 * Central entry-point for all security utilities:
 *   - Rate Limiting
 *   - Security Headers (Helmet-equivalent)
 *   - CORS Policy
 */

// Rate Limiting
export {
  applyRateLimit,
  attachRateLimitHeaders,
  withRateLimit,
  getClientIP,
  // Preset configs
  API_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  PASSWORD_RESET_RATE_LIMIT,
  SEARCH_RATE_LIMIT,
  CMS_WRITE_RATE_LIMIT,
  UPLOAD_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
  type RateLimitConfig,
} from './rate-limit';

// Security Headers (Helmet)
export {
  generateSecurityHeaders,
  getNextConfigHeaders,
  applySecurityHeaders,
  type SecurityHeaderConfig,
  type SecurityHeadersOptions,
} from './headers';

// CORS
export {
  corsMiddleware,
  applyCors,
  handlePreflight,
  withCors,
  getDefaultCorsOptions,
  getStaticCorsHeaders,
  type CorsOptions,
} from './cors';
