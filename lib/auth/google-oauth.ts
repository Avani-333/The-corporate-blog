/**
 * Google OAuth Configuration and Utilities
 * Handles Google OAuth integration for The Corporate Blog
 */

import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';
import { 
  generateAccessToken, 
  hashPassword,
  generateTokenId,
  type JWTUser 
} from './jwt';
import { createRefreshToken } from './refresh-tokens';
import { UserRole, UserStatus } from '@/types';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/google/callback`,
  scopes: [
    'openid',
    'profile',
    'email',
  ],
} as const;

// Validate configuration
if (!GOOGLE_OAUTH_CONFIG.clientId) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is required');
}

if (!GOOGLE_OAUTH_CONFIG.clientSecret) {
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required');
}

// ============================================================================
// OAUTH CLIENT
// ============================================================================

const googleClient = new OAuth2Client({
  clientId: GOOGLE_OAUTH_CONFIG.clientId,
  clientSecret: GOOGLE_OAUTH_CONFIG.clientSecret,
  redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
});

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleProfile {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  hd?: string; // Hosted domain for G Suite accounts
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export interface OAuthResult {
  success: boolean;
  user?: JWTUser;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  isNewUser?: boolean;
  error?: string;
}

// ============================================================================
// OAUTH URL GENERATION
// ============================================================================

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state?: string): string {
  const authUrl = googleClient.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    scope: GOOGLE_OAUTH_CONFIG.scopes,
    prompt: 'consent', // Force consent screen to get refresh token
    state: state || generateTokenId(), // CSRF protection
    include_granted_scopes: true,
  });

  return authUrl;
}

// ============================================================================
// TOKEN EXCHANGE
// ============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  try {
    const { tokens } = await googleClient.getToken(code);
    
    if (!tokens.access_token || !tokens.id_token) {
      throw new Error('Invalid tokens received from Google');
    }

    return tokens as GoogleTokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange authorization code');
  }
}

// ============================================================================
// PROFILE FETCHING
// ============================================================================

/**
 * Get user profile from Google
 */
export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const profile: GoogleProfile = await response.json();
    
    if (!profile.email || !profile.id) {
      throw new Error('Invalid profile data received from Google');
    }

    return profile;
  } catch (error) {
    console.error('Error fetching Google profile:', error);
    throw new Error('Failed to fetch user profile');
  }
}

/**
 * Verify Google ID token
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_OAUTH_CONFIG.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      throw new Error('Invalid ID token payload');
    }

    return {
      id: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified || false,
      name: payload.name || '',
      given_name: payload.given_name || '',
      family_name: payload.family_name || '',
      picture: payload.picture || '',
      locale: payload.locale || 'en',
      hd: payload.hd,
    };
  } catch (error) {
    console.error('Error verifying Google ID token:', error);
    throw new Error('Failed to verify ID token');
  }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Find or create user from Google profile
 */
export async function findOrCreateUser(
  profile: GoogleProfile,
  deviceInfo: {
    ipAddress: string;
    userAgent: string;
    deviceInfo: string;
  }
): Promise<{ user: JWTUser; isNewUser: boolean }> {
  try {
    // First, try to find existing user by email
    let user = await prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        status: true,
        emailVerified: true,
        googleId: true,
      },
    });

    let isNewUser = false;

    if (user) {
      // Existing user - update Google ID if not set
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            googleId: profile.id,
            emailVerified: profile.email_verified,
            lastLogin: new Date(),
          },
        });
      } else {
        // Just update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });
      }
    } else {
      // Create new user
      isNewUser = true;
      const username = await generateUniqueUsername(profile.given_name || profile.name);
      
      user = await prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          name: profile.name,
          username,
          password: await hashPassword(generateTokenId()), // Random password for OAuth users
          role: UserRole.SUBSCRIBER, // Default role for new OAuth users
          status: profile.email_verified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
          emailVerified: profile.email_verified,
          googleId: profile.id,
          avatar: profile.picture,
          lastLogin: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          status: true,
          emailVerified: true,
          googleId: true,
        },
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        username: user.username || undefined,
        role: user.role,
        status: user.status,
      },
      isNewUser,
    };
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    throw new Error('Failed to process user data');
  }
}

/**
 * Generate unique username from name
 */
async function generateUniqueUsername(name: string): Promise<string> {
  // Clean and normalize the name
  let baseUsername = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);

  if (!baseUsername || baseUsername.length < 3) {
    baseUsername = 'user';
  }

  // Check if username exists
  let username = baseUsername;
  let counter = 0;

  while (true) {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!existing) {
      break;
    }

    counter++;
    username = `${baseUsername}${counter}`;
  }

  return username;
}

// ============================================================================
// OAUTH FLOW HANDLER
// ============================================================================

/**
 * Complete OAuth flow - exchange code and create session
 */
export async function completeGoogleOAuth(
  code: string,
  deviceInfo: {
    ipAddress: string;
    userAgent: string;
    deviceInfo: string;
  }
): Promise<OAuthResult> {
  try {
    // Exchange code for tokens
    const googleTokens = await exchangeCodeForTokens(code);

    // Verify ID token and get profile
    const profile = await verifyGoogleIdToken(googleTokens.id_token);

    // Find or create user
    const { user, isNewUser } = await findOrCreateUser(profile, deviceInfo);

    // Check user status
    if (user.status === UserStatus.SUSPENDED) {
      return {
        success: false,
        error: 'Account is suspended. Please contact support.',
      };
    }

    if (user.status === UserStatus.INACTIVE) {
      return {
        success: false,
        error: 'Account is inactive. Please contact support.',
      };
    }

    // Create refresh token for the session
    const refreshTokenRecord = await createRefreshToken({
      userId: user.id,
      deviceInfo: deviceInfo.deviceInfo,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
    });

    // Generate access token
    const accessToken = await generateAccessToken(user);

    return {
      success: true,
      user,
      tokens: {
        accessToken,
        refreshToken: refreshTokenRecord.token,
      },
      isNewUser,
    };
  } catch (error) {
    console.error('Google OAuth completion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OAuth authentication failed',
    };
  }
}

// ============================================================================
// ACCOUNT LINKING
// ============================================================================

/**
 * Link Google account to existing user
 */
export async function linkGoogleAccount(
  userId: string,
  googleProfile: GoogleProfile
): Promise<boolean> {
  try {
    // Check if Google ID is already linked to another account
    const existingGoogleUser = await prisma.user.findFirst({
      where: {
        googleId: googleProfile.id,
        id: { not: userId },
      },
    });

    if (existingGoogleUser) {
      throw new Error('Google account is already linked to another user');
    }

    // Update user with Google ID
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleId: googleProfile.id,
        emailVerified: googleProfile.email_verified,
        avatar: googleProfile.picture || undefined,
      },
    });

    return true;
  } catch (error) {
    console.error('Error linking Google account:', error);
    return false;
  }
}

/**
 * Unlink Google account from user
 */
export async function unlinkGoogleAccount(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
      },
    });

    return true;
  } catch (error) {
    console.error('Error unlinking Google account:', error);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleProfile,
  verifyGoogleIdToken,
  findOrCreateUser,
  completeGoogleOAuth,
  linkGoogleAccount,
  unlinkGoogleAccount,
  GOOGLE_OAUTH_CONFIG,
};