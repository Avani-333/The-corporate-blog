/**
 * Authentication API Route - Logout
 * Handles user logout with token revocation and cookie clearing
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getRefreshToken,
  clearAuthCookies,
  AUTH_ERRORS,
  extractUser 
} from '@/lib/auth/jwt';
import { 
  revokeRefreshToken, 
  revokeAllUserTokens,
  validateRefreshToken 
} from '@/lib/auth/refresh-tokens';

// ============================================================================
// LOGOUT TYPES
// ============================================================================

interface LogoutRequest {
  /** Revoke all tokens for this user across all devices */
  logoutAll?: boolean;
  /** Optional reason for logout */
  reason?: 'user_initiated' | 'security' | 'admin_action';
}

interface LogoutResponse {
  success: boolean;
  message?: string;
  tokensRevoked?: number;
  error?: string;
}

// ============================================================================
// LOGOUT HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body (optional)
    let body: LogoutRequest = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      // Ignore parsing errors for logout - it's optional
    }

    const { logoutAll = false, reason = 'user_initiated' } = body;

    // Get user information (optional for logout)
    const user = await extractUser(request);

    // Get refresh token from request
    const refreshToken = getRefreshToken(request);

    let tokensRevoked = 0;
    let currentTokenRevoked = false;

    // If we have a refresh token, validate and revoke it
    if (refreshToken) {
      try {
        const validation = await validateRefreshToken(refreshToken);
        if (validation.valid && validation.token) {
          await revokeRefreshToken(validation.token.tokenId);
          tokensRevoked = 1;
          currentTokenRevoked = true;
        }
      } catch (error) {
        console.error('Error revoking current refresh token:', error);
        // Continue with logout even if token revocation fails
      }
    }

    // If user wants to logout from all devices and we have user info
    if (logoutAll && user) {
      try {
        const allTokensRevoked = await revokeAllUserTokens(user.id);
        tokensRevoked = allTokensRevoked;
      } catch (error) {
        console.error('Error revoking all user tokens:', error);
        // Continue with logout even if bulk revocation fails
      }
    }

    // Clear authentication cookies
    const clearedCookies = clearAuthCookies();

    // Prepare response
    const response = NextResponse.json({
      success: true,
      message: logoutAll 
        ? 'Logged out from all devices successfully'
        : 'Logged out successfully',
      tokensRevoked,
    } as LogoutResponse);

    // Set cleared cookies in response
    clearedCookies.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    // Add security headers
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, clear cookies and return success
    // This ensures user is logged out from the frontend
    const clearedCookies = clearAuthCookies();
    const response = NextResponse.json({
      success: true,
      message: 'Logged out (with errors in cleanup)',
      error: 'Some cleanup operations failed',
    } as LogoutResponse);

    clearedCookies.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  }
}

// ============================================================================
// GET - LOGOUT STATUS/INFO
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if user is logged in
    const user = await extractUser(request);
    const refreshToken = getRefreshToken(request);

    return NextResponse.json({
      loggedIn: !!user,
      hasRefreshToken: !!refreshToken,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
      } : null,
    });
  } catch (error) {
    console.error('Logout status check error:', error);
    return NextResponse.json({
      loggedIn: false,
      hasRefreshToken: false,
      user: null,
    });
  }
}

// ============================================================================
// DELETE - FORCE LOGOUT (ADMIN ACTION)
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // This endpoint is for admin-initiated logouts
    const user = await extractUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: AUTH_ERRORS.TOKEN_INVALID },
        { status: 401 }
      );
    }

    // Check if user has admin privileges (implement based on your role system)
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS },
        { status: 403 }
      );
    }

    // Parse request to get target user ID
    let targetUserId: string;
    try {
      const body = await request.json();
      targetUserId = body.userId;
      
      if (!targetUserId || typeof targetUserId !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Valid userId is required' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Revoke all tokens for the target user
    const tokensRevoked = await revokeAllUserTokens(targetUserId);

    return NextResponse.json({
      success: true,
      message: `Force logout successful for user ${targetUserId}`,
      tokensRevoked,
      action: 'admin_force_logout',
      adminUser: user.id,
    } as LogoutResponse);
  } catch (error) {
    console.error('Force logout error:', error);
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