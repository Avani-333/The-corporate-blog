/**
 * Google OAuth API Route - Callback
 * Handles Google OAuth callback and completes authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { completeGoogleOAuth } from '@/lib/auth/google-oauth';
import { setAuthCookies } from '@/lib/auth/jwt';

// ============================================================================
// TYPES
// ============================================================================

interface StateData {
  csrf: string;
  redirect: string;
  timestamp: number;
  custom?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function extractDeviceInfo(request: NextRequest): {
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
} {
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // Simple device detection
  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    deviceType = 'Mobile';
  } else if (/Tablet|iPad/.test(userAgent)) {
    deviceType = 'Tablet';
  }
  
  const deviceInfo = `${deviceType} - ${userAgent.split(' ')[0]}`;

  return { ipAddress, userAgent, deviceInfo };
}

function validateState(receivedState: string, cookieState: string): StateData | null {
  try {
    // Verify state matches cookie (CSRF protection)
    if (receivedState !== cookieState) {
      console.error('State mismatch: CSRF protection triggered');
      return null;
    }

    // Decode state
    const stateJson = Buffer.from(receivedState, 'base64url').toString();
    const stateData: StateData = JSON.parse(stateJson);

    // Check timestamp (state should not be older than 10 minutes)
    const maxAge = 10 * 60 * 1000; // 10 minutes
    if (Date.now() - stateData.timestamp > maxAge) {
      console.error('State expired');
      return null;
    }

    return stateData;
  } catch (error) {
    console.error('State validation error:', error);
    return null;
  }
}

function createErrorRedirect(error: string, redirectUrl: string = '/auth/login'): NextResponse {
  const errorUrl = new URL(redirectUrl, process.env.NEXTAUTH_URL);
  errorUrl.searchParams.set('error', error);
  return NextResponse.redirect(errorUrl);
}

function createSuccessRedirect(
  redirectUrl: string = '/dashboard',
  isNewUser: boolean = false
): NextResponse {
  const successUrl = new URL(redirectUrl, process.env.NEXTAUTH_URL);
  if (isNewUser) {
    successUrl.searchParams.set('welcome', 'true');
  }
  return NextResponse.redirect(successUrl);
}

// ============================================================================
// GET - HANDLE GOOGLE OAUTH CALLBACK
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract parameters from callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      
      const errorMessage = error === 'access_denied' 
        ? 'Authentication cancelled'
        : `Authentication error: ${error}`;
        
      return createErrorRedirect(errorMessage);
    }

    // Validate required parameters
    if (!code || !state) {
      return createErrorRedirect('Invalid callback parameters');
    }

    // Get state from cookie for verification
    const cookieState = request.cookies.get('oauth_state')?.value;
    if (!cookieState) {
      return createErrorRedirect('Missing authentication state');
    }

    // Validate and decode state
    const stateData = validateState(state, cookieState);
    if (!stateData) {
      return createErrorRedirect('Invalid authentication state');
    }

    // Extract device information
    const deviceInfo = extractDeviceInfo(request);

    // Complete OAuth flow
    const oauthResult = await completeGoogleOAuth(code, deviceInfo);

    if (!oauthResult.success) {
      console.error('OAuth completion failed:', oauthResult.error);
      return createErrorRedirect(
        oauthResult.error || 'Authentication failed',
        stateData.redirect
      );
    }

    if (!oauthResult.tokens || !oauthResult.user) {
      return createErrorRedirect('Authentication incomplete', stateData.redirect);
    }

    // Set authentication cookies
    const tokens = {
      accessToken: oauthResult.tokens.accessToken,
      refreshToken: oauthResult.tokens.refreshToken,
      user: oauthResult.user,
    };

    const cookieHeaders = setAuthCookies(tokens);
    
    // Create success redirect response
    const response = createSuccessRedirect(
      stateData.redirect,
      oauthResult.isNewUser
    );

    // Clear oauth state cookie
    response.cookies.delete('oauth_state');

    // Set authentication cookies
    cookieHeaders.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    // Add security headers
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return createErrorRedirect('Internal authentication error');
  }
}

// ============================================================================
// POST - API-STYLE CALLBACK (for SPAs)
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { code, state } = body;

    // Validate parameters
    if (!code || !state) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters',
        },
        { status: 400 }
      );
    }

    // Get state from cookie for verification
    const cookieState = request.cookies.get('oauth_state')?.value;
    if (!cookieState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing authentication state',
        },
        { status: 400 }
      );
    }

    // Validate state
    const stateData = validateState(state, cookieState);
    if (!stateData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid authentication state',
        },
        { status: 400 }
      );
    }

    // Extract device information
    const deviceInfo = extractDeviceInfo(request);

    // Complete OAuth flow
    const oauthResult = await completeGoogleOAuth(code, deviceInfo);

    if (!oauthResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: oauthResult.error || 'Authentication failed',
        },
        { status: 400 }
      );
    }

    if (!oauthResult.tokens || !oauthResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication incomplete',
        },
        { status: 500 }
      );
    }

    // Set authentication cookies
    const tokens = {
      accessToken: oauthResult.tokens.accessToken,
      refreshToken: oauthResult.tokens.refreshToken,
      user: oauthResult.user,
    };

    const cookieHeaders = setAuthCookies(tokens);

    // Create response
    const response = NextResponse.json({
      success: true,
      user: oauthResult.user,
      tokens: {
        accessToken: oauthResult.tokens.accessToken,
        refreshToken: oauthResult.tokens.refreshToken,
      },
      isNewUser: oauthResult.isNewUser,
      redirectUrl: stateData.redirect,
    });

    // Clear oauth state cookie
    response.cookies.delete('oauth_state');

    // Set authentication cookies
    cookieHeaders.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  } catch (error) {
    console.error('OAuth POST callback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal authentication error',
      },
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

export async function DELETE(): Promise<NextResponse> {
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