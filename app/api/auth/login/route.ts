/**
 * Authentication API Route - Login
 * Handles user login with JWT tokens and refresh token issuance
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { 
  generateAccessToken,
  setAuthCookies,
  validateUserStatus,
  AUTH_ERRORS,
  type AuthTokens,
  type LoginCredentials,
  type AuthResult 
} from '@/lib/auth/jwt';
import { verifyPassword } from '@/lib/auth/password';
import { createRefreshToken } from '@/lib/auth/refresh-tokens';
import { UserStatus } from '@/types';

const prisma = new PrismaClient();

// ============================================================================
// RATE LIMITING STORE
// ============================================================================

const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = forwarded?.split(',')[0] || realIp || 'unknown';
  return remoteAddr;
}

function isRateLimited(clientId: string): { limited: boolean; resetTime?: number } {
  const attempts = loginAttempts.get(clientId);
  if (!attempts) return { limited: false };

  const now = Date.now();
  
  // Check if still locked out
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return { limited: true, resetTime: attempts.lockedUntil };
  }

  // Reset if lockout period has passed
  if (attempts.lockedUntil && attempts.lockedUntil <= now) {
    loginAttempts.delete(clientId);
    return { limited: false };
  }

  // Check if too many attempts in time window (15 minutes)
  const timeWindow = 15 * 60 * 1000; // 15 minutes
  if (attempts.count >= 5 && (now - attempts.lastAttempt) < timeWindow) {
    const lockoutDuration = 15 * 60 * 1000; // 15 minutes
    attempts.lockedUntil = now + lockoutDuration;
    return { limited: true, resetTime: attempts.lockedUntil };
  }

  return { limited: false };
}

function recordLoginAttempt(clientId: string, success: boolean): void {
  const now = Date.now();
  const attempts = loginAttempts.get(clientId) || { count: 0, lastAttempt: 0 };

  if (success) {
    // Reset on successful login
    loginAttempts.delete(clientId);
  } else {
    // Increment failed attempts
    attempts.count += 1;
    attempts.lastAttempt = now;
    loginAttempts.set(clientId, attempts);
  }
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

function validateLoginRequest(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  } else if (data.password.length < 1) {
    errors.push('Password cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// DEVICE INFO EXTRACTION
// ============================================================================

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
// LOGIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = getClientId(request);

    // Check rate limiting
    const rateLimitCheck = isRateLimited(clientId);
    if (rateLimitCheck.limited) {
      const resetTime = rateLimitCheck.resetTime ? new Date(rateLimitCheck.resetTime) : undefined;
      return NextResponse.json(
        {
          success: false,
          error: AUTH_ERRORS.RATE_LIMITED,
          resetTime: resetTime?.toISOString(),
        },
        { status: 429 }
      );
    }

    // Parse and validate request
    let body: LoginCredentials;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const validation = validateLoginRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: validation.errors },
        { status: 400 }
      );
    }

    const { email, password, rememberMe = false } = body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        password: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLogin: true,
      },
    });

    if (!user) {
      recordLoginAttempt(clientId, false);
      return NextResponse.json(
        { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      recordLoginAttempt(clientId, false);
      return NextResponse.json(
        { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // Validate user status
    const statusValidation = validateUserStatus(user.status);
    if (!statusValidation.valid) {
      recordLoginAttempt(clientId, false);
      
      // Special handling for unverified emails
      if (user.status === UserStatus.PENDING_VERIFICATION) {
        return NextResponse.json(
          {
            success: false,
            error: statusValidation.error,
            requiresVerification: true,
            userId: user.id,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { success: false, error: statusValidation.error },
        { status: 403 }
      );
    }

    // Extract device information
    const { ipAddress, userAgent, deviceInfo } = extractDeviceInfo(request);

    // Create refresh token
    const refreshTokenRecord = await createRefreshToken({
      userId: user.id,
      deviceInfo,
      ipAddress,
      userAgent,
    });

    // Generate access token
    const accessToken = await generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      username: user.username || undefined,
      role: user.role,
      status: user.status,
    });

    // Prepare tokens
    const tokens: AuthTokens = {
      accessToken,
      refreshToken: refreshTokenRecord.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        username: user.username || undefined,
        role: user.role,
        status: user.status,
      },
    };

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Record successful login
    recordLoginAttempt(clientId, true);

    // Set cookies and return response
    const cookieHeaders = setAuthCookies(tokens);
    const response = NextResponse.json({
      success: true,
      user: tokens.user,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });

    // Set cookies in response
    cookieHeaders.forEach(cookie => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: AUTH_ERRORS.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}

// ============================================================================
// METHOD NOT ALLOWED
// ============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

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