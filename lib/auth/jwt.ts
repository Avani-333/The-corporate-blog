/**
 * JWT Authentication Utilities
 * Handles JWT token generation, verification, and refresh token management
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { UserRole, UserStatus } from '@/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production'
);

export const AUTH_CONFIG = {
  // Token expiration times
  accessTokenExpiry: '15m',      // 15 minutes
  refreshTokenExpiry: '7d',      // 7 days
  
  // Cookie configuration
  cookieNames: {
    accessToken: 'tcb_access_token',
    refreshToken: 'tcb_refresh_token',
  },
  
  // Cookie options
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
  
  // Rate limiting
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface JWTUser {
  id: string;
  email: string;
  name?: string;
  username?: string;
  role: UserRole;
  status: UserStatus;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: JWTUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: JWTUser;
  tokens?: AuthTokens;
  error?: string;
  requiresVerification?: boolean;
}

// ============================================================================
// JWT TOKEN UTILITIES
// ============================================================================

/**
 * Generate access token (JWT)
 */
export async function generateAccessToken(user: JWTUser): Promise<string> {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.accessTokenExpiry)
    .setIssuer('thecorporateblog')
    .setAudience('thecorporateblog-users')
    .sign(JWT_SECRET);
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(userId: string, tokenId: string): Promise<string> {
  const payload = {
    userId,
    tokenId,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.refreshTokenExpiry)
    .setIssuer('thecorporateblog')
    .setAudience('thecorporateblog-refresh')
    .sign(REFRESH_SECRET);
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token: string): Promise<JWTUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'thecorporateblog',
      audience: 'thecorporateblog-users',
    });

    return payload as JWTUser;
  } catch (error) {
    console.error('Access token verification failed:', error);
    return null;
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET, {
      issuer: 'thecorporateblog',
      audience: 'thecorporateblog-refresh',
    });

    return payload as RefreshTokenPayload;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

// ============================================================================
// TOKEN EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * Extract token from cookies
 */
export function extractTokenFromCookies(cookieName: string): string | null {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get(cookieName);
    return tokenCookie?.value || null;
  } catch (error) {
    // Handle case where cookies() is not available (e.g., in API routes)
    return null;
  }
}

/**
 * Get access token from request (cookie or header)
 */
export function getAccessToken(request: NextRequest): string | null {
  // Try Authorization header first
  const bearerToken = extractBearerToken(request);
  if (bearerToken) return bearerToken;

  // Try cookie as fallback
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`${AUTH_CONFIG.cookieNames.accessToken}=([^;]+)`));
    if (match) return match[1];
  }

  return null;
}

/**
 * Get refresh token from request
 */
export function getRefreshToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`${AUTH_CONFIG.cookieNames.refreshToken}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

/**
 * Set authentication cookies
 */
export function setAuthCookies(tokens: AuthTokens): string[] {
  const { accessToken, refreshToken } = tokens;
  
  const accessTokenCookie = `${AUTH_CONFIG.cookieNames.accessToken}=${accessToken}; ` +
    `Path=${AUTH_CONFIG.cookieOptions.path}; ` +
    `Max-Age=${15 * 60}; ` + // 15 minutes
    `${AUTH_CONFIG.cookieOptions.httpOnly ? 'HttpOnly; ' : ''}` +
    `${AUTH_CONFIG.cookieOptions.secure ? 'Secure; ' : ''}` +
    `SameSite=${AUTH_CONFIG.cookieOptions.sameSite}`;

  const refreshTokenCookie = `${AUTH_CONFIG.cookieNames.refreshToken}=${refreshToken}; ` +
    `Path=${AUTH_CONFIG.cookieOptions.path}; ` +
    `Max-Age=${7 * 24 * 60 * 60}; ` + // 7 days
    `${AUTH_CONFIG.cookieOptions.httpOnly ? 'HttpOnly; ' : ''}` +
    `${AUTH_CONFIG.cookieOptions.secure ? 'Secure; ' : ''}` +
    `SameSite=${AUTH_CONFIG.cookieOptions.sameSite}`;

  return [accessTokenCookie, refreshTokenCookie];
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(): string[] {
  const expiredAccessToken = `${AUTH_CONFIG.cookieNames.accessToken}=; ` +
    `Path=${AUTH_CONFIG.cookieOptions.path}; ` +
    `Max-Age=0; ` +
    `${AUTH_CONFIG.cookieOptions.httpOnly ? 'HttpOnly; ' : ''}` +
    `${AUTH_CONFIG.cookieOptions.secure ? 'Secure; ' : ''}` +
    `SameSite=${AUTH_CONFIG.cookieOptions.sameSite}`;

  const expiredRefreshToken = `${AUTH_CONFIG.cookieNames.refreshToken}=; ` +
    `Path=${AUTH_CONFIG.cookieOptions.path}; ` +
    `Max-Age=0; ` +
    `${AUTH_CONFIG.cookieOptions.httpOnly ? 'HttpOnly; ' : ''}` +
    `${AUTH_CONFIG.cookieOptions.secure ? 'Secure; ' : ''}` +
    `SameSite=${AUTH_CONFIG.cookieOptions.sameSite}`;

  return [expiredAccessToken, expiredRefreshToken];
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Parse expiration time to seconds
 */
export function parseExpirationTime(timeStr: string): number {
  const match = timeStr.match(/(\d+)([smhd])/);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);
  
  const [, amount, unit] = match;
  const num = parseInt(amount, 10);
  
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 60 * 60;
    case 'd': return num * 24 * 60 * 60;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: JWTUser | RefreshTokenPayload): boolean {
  if (!token.exp) return true;
  return Date.now() >= token.exp * 1000;
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: JWTUser | RefreshTokenPayload): Date | null {
  if (!token.exp) return null;
  return new Date(token.exp * 1000);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate user status for authentication
 */
export function validateUserStatus(status: UserStatus): { valid: boolean; error?: string } {
  switch (status) {
    case UserStatus.ACTIVE:
      return { valid: true };
    case UserStatus.INACTIVE:
      return { valid: false, error: 'Account is inactive. Please contact support.' };
    case UserStatus.SUSPENDED:
      return { valid: false, error: 'Account is suspended. Please contact support.' };
    case UserStatus.PENDING_VERIFICATION:
      return { valid: false, error: 'Please verify your email address before signing in.' };
    default:
      return { valid: false, error: 'Invalid account status.' };
  }
}

/**
 * Generate secure token ID
 */
export function generateTokenId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Re-export extractUser from middleware for backwards compatibility
 */
export { extractUser } from './middleware';

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  USER_INACTIVE: 'Account is inactive',
  USER_SUSPENDED: 'Account is suspended',
  EMAIL_NOT_VERIFIED: 'Email address not verified',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  REFRESH_TOKEN_EXPIRED: 'Refresh token has expired',
  REFRESH_TOKEN_INVALID: 'Invalid refresh token',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  RATE_LIMITED: 'Too many login attempts. Please try again later.',
  INTERNAL_ERROR: 'An internal error occurred',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
} as const;

export type AuthError = keyof typeof AUTH_ERRORS;

export function getAuthErrorMessage(error: AuthError): string {
  return AUTH_ERRORS[error];
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  validateUserStatus,
  generateTokenId,
  AUTH_CONFIG,
  AUTH_ERRORS,
};