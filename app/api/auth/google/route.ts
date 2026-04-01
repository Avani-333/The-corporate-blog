/**
 * Google OAuth API Route - Initiate
 * Handles Google OAuth flow initiation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/auth/google-oauth';
import { generateTokenId } from '@/lib/auth/jwt';

// ============================================================================
// TYPES
// ============================================================================

interface OAuthInitRequest {
  /** Redirect URL after successful authentication */
  redirectUrl?: string;
  /** Additional state data */
  state?: string;
}

// ============================================================================
// GET - INITIATE GOOGLE OAUTH
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUrl = searchParams.get('redirect') || '/dashboard';
    const customState = searchParams.get('state');

    // Generate state for CSRF protection
    const stateData = {
      csrf: generateTokenId(),
      redirect: redirectUrl,
      timestamp: Date.now(),
      ...(customState && { custom: customState }),
    };

    // Encode state as base64
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Get Google OAuth URL
    const authUrl = getGoogleAuthUrl(encodedState);

    // Store state in cookie for verification (optional, for extra security)
    const response = NextResponse.json({
      success: true,
      authUrl,
      state: encodedState,
    });

    // Set state cookie that will be verified in callback
    response.cookies.set('oauth_state', encodedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate OAuth flow',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - MANUAL INITIATE (with body parameters)
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: OAuthInitRequest = {};
    try {
      body = await request.json();
    } catch {
      // Use defaults if no body provided
    }

    const { redirectUrl = '/dashboard', state: customState } = body;

    // Validate redirect URL (basic security check)
    if (redirectUrl && !redirectUrl.startsWith('/') && !redirectUrl.startsWith(process.env.NEXTAUTH_URL || '')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid redirect URL',
        },
        { status: 400 }
      );
    }

    // Generate state for CSRF protection
    const stateData = {
      csrf: generateTokenId(),
      redirect: redirectUrl,
      timestamp: Date.now(),
      ...(customState && { custom: customState }),
    };

    // Encode state as base64
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Get Google OAuth URL
    const authUrl = getGoogleAuthUrl(encodedState);

    // Store state in cookie for verification
    const response = NextResponse.json({
      success: true,
      authUrl,
      state: encodedState,
      redirectUrl,
    });

    response.cookies.set('oauth_state', encodedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth POST initiation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate OAuth flow',
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