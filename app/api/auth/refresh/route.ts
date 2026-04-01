/**
 * Authentication API Route - Refresh Token
 * Handles token refresh and rotation for maintaining user sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  AUTH_ERRORS,
  type AuthTokens 
} from '@/lib/auth/jwt';
import { 
  rotateRefreshToken,
  detectSuspiciousActivity 
} from '@/lib/auth/refresh-tokens';

// ============================================================================
// TYPES
// ============================================================================

interface RefreshRequest {
  /** Refresh token (optional if provided in cookie) */
  refreshToken?: string;
}

interface RefreshResponse {
  success: boolean;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  user?: {
    id: string;
    email: string;
    name?: string;
    username?: string;
    role: string;
    status: string;
  };
  error?: string;
  suspiciousActivity?: boolean;
}

// ============================================================================
// DEVICE INFO EXTRACTION
// ============================================================================

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

function extractDeviceInfo(request: NextRequest): {
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
} {
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const ipAddress = getClientId(request);
  
  // Simple device detection
  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    deviceType = 'Mobile';
  } else if (/Tablet|iPad/.test(userAgent)) {
    deviceType = 'Tablet';
  }
  
  const deviceInfo = `${deviceType} - ${userAgent.split(' ')[0]}`;

  return {
    ipAddress,
    userAgent,
    deviceInfo,
  };
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const refreshAttempts = new Map<string, { count: number; lastAttempt: number }>();

function isRefreshRateLimited(clientId: string): boolean {
  const attempts = refreshAttempts.get(clientId);
  if (!attempts) return false;

  const now = Date.now();
  const timeWindow = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 20; // Max 20 refresh attempts per 5 minutes

  // Reset if time window has passed
  if (now - attempts.lastAttempt > timeWindow) {
    refreshAttempts.delete(clientId);
    return false;
  }

  return attempts.count >= maxAttempts;
}

function recordRefreshAttempt(clientId: string): void {
  const now = Date.now();
  const attempts = refreshAttempts.get(clientId) || { count: 0, lastAttempt: 0 };
  
  attempts.count += 1;
  attempts.lastAttempt = now;
  refreshAttempts.set(clientId, attempts);
}

// ============================================================================
// REFRESH TOKEN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = getClientId(request);

    // Check rate limiting
    if (isRefreshRateLimited(clientId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many refresh attempts. Please try again later.',
        } as RefreshResponse,
        { status: 429 }
      );
    }

    // Record refresh attempt
    recordRefreshAttempt(clientId);

    // Get refresh token from request body or cookies
    let refreshToken: string | null = null;
    
    try {
      const text = await request.text();
      if (text.trim()) {
        const body: RefreshRequest = JSON.parse(text);
        refreshToken = body.refreshToken || null;
      }
    } catch {
      // Ignore parsing errors - we'll try cookies
    }

    // Fallback to cookies if no token in body
    if (!refreshToken) {
      refreshToken = getRefreshToken(request);
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: AUTH_ERRORS.REFRESH_TOKEN_INVALID,
        } as RefreshResponse,
        { status: 401 }
      );
    }

    // Extract device information for security checks
    const { ipAddress, userAgent, deviceInfo } = extractDeviceInfo(request);

    // Rotate the refresh token
    const rotationResult = await rotateRefreshToken(refreshToken, {
      ipAddress,
      userAgent,
      deviceInfo,
    });

    if (!rotationResult.success) {
      // Clear cookies on failed refresh
      const clearedCookies = clearAuthCookies();
      const response = NextResponse.json(
        {
          success: false,
          error: rotationResult.error || AUTH_ERRORS.REFRESH_TOKEN_INVALID,
        } as RefreshResponse,
        { status: 401 }
      );

      clearedCookies.forEach(cookie => {
        response.headers.append('Set-Cookie', cookie);
      });

      return response;
    }

    // Check for suspicious activity (optional - for enhanced security)
    let suspiciousActivity = false;
    try {
      // You would need to extract userId from the token or database
      // This is a simplified version
      suspiciousActivity = false; // Implement based on your security requirements
    } catch (error) {
      console.error('Suspicious activity check failed:', error);
    }

    // Get user info (you'll need to fetch from database based on the rotated token)
    const { accessToken, refreshToken: newRefreshToken } = rotationResult;
    
    if (!accessToken || !newRefreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: AUTH_ERRORS.INTERNAL_ERROR,
        } as RefreshResponse,
        { status: 500 }
      );
    }

    // Decode the access token to get user info for response
    // Note: In production, you might want to fetch from database instead
    const { verifyAccessToken } = await import('@/lib/auth/jwt');
    const userInfo = await verifyAccessToken(accessToken);

    if (!userInfo) {
      return NextResponse.json(
        {
          success: false,
          error: AUTH_ERRORS.INTERNAL_ERROR,
        } as RefreshResponse,
        { status: 500 }
      );
    }

    // Prepare tokens for cookie setting
    const tokens: AuthTokens = {
      accessToken,
      refreshToken: newRefreshToken,
      user: userInfo,
    };

    // Set new cookies and return success response
    const cookieHeaders = setAuthCookies(tokens);
    const response = NextResponse.json({
      success: true,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        username: userInfo.username,
        role: userInfo.role,
        status: userInfo.status,
      },
      suspiciousActivity,
    } as RefreshResponse);

    // Set cookies in response
    cookieHeaders.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    // Add security headers
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Clear cookies on error
    const clearedCookies = clearAuthCookies();
    const response = NextResponse.json(
      {
        success: false,
        error: AUTH_ERRORS.INTERNAL_ERROR,
      } as RefreshResponse,
      { status: 500 }
    );

    clearedCookies.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  }
}

// ============================================================================
// GET - CHECK REFRESH TOKEN STATUS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const refreshToken = getRefreshToken(request);
    
    if (!refreshToken) {
      return NextResponse.json({
        valid: false,
        hasToken: false,
      });
    }

    const { validateRefreshToken } = await import('@/lib/auth/refresh-tokens');
    const validation = await validateRefreshToken(refreshToken);

    return NextResponse.json({
      valid: validation.valid,
      hasToken: true,
      error: validation.error,
      expiresAt: validation.token?.expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('Refresh token status check error:', error);
    return NextResponse.json({
      valid: false,
      hasToken: false,
      error: 'Status check failed',
    });
  }
}

// ============================================================================
// DELETE - REVOKE REFRESH TOKEN
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const refreshToken = getRefreshToken(request);
    
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token found' },
        { status: 400 }
      );
    }

    const { validateRefreshToken, revokeRefreshToken } = await import('@/lib/auth/refresh-tokens');
    
    // Validate token first
    const validation = await validateRefreshToken(refreshToken);
    if (!validation.valid || !validation.token) {
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token' },
        { status: 400 }
      );
    }

    // Revoke the token
    await revokeRefreshToken(validation.token.tokenId);

    // Clear cookies
    const clearedCookies = clearAuthCookies();
    const response = NextResponse.json({
      success: true,
      message: 'Refresh token revoked successfully',
    });

    clearedCookies.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  } catch (error) {
    console.error('Refresh token revocation error:', error);
    return NextResponse.json(
      { success: false, error: AUTH_ERRORS.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}

// ============================================================================
// METHOD NOT ALLOWED
// ============================================================================

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}