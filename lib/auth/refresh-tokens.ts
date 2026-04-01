/**
 * Refresh Token Management
 * Handles refresh token storage, rotation, validation, and blacklisting
 */

import { PrismaClient } from '@prisma/client';
import { 
  generateRefreshToken, 
  verifyRefreshToken, 
  generateTokenId,
  type RefreshTokenPayload 
} from './jwt';
import { getTokenBlacklist } from './token-blacklist';

// ============================================================================
// PRISMA CLIENT
// ============================================================================

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
}

export interface CreateRefreshTokenOptions {
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshTokenValidation {
  valid: boolean;
  token?: RefreshTokenRecord;
  error?: string;
}

export interface TokenRotationResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

// ============================================================================
// REFRESH TOKEN CRUD OPERATIONS
// ============================================================================

/**
 * Create new refresh token
 */
export async function createRefreshToken(
  options: CreateRefreshTokenOptions
): Promise<RefreshTokenRecord> {
  const tokenId = generateTokenId();
  const token = await generateRefreshToken(options.userId, tokenId);
  
  // Calculate expiration date (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return prisma.refreshToken.create({
    data: {
      userId: options.userId,
      tokenId,
      token,
      expiresAt,
      deviceInfo: options.deviceInfo,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      isRevoked: false,
    },
  });
}

/**
 * Find refresh token by token value
 */
export async function findRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
  return prisma.refreshToken.findFirst({
    where: {
      token,
      isRevoked: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });
}

/**
 * Find refresh token by token ID
 */
export async function findRefreshTokenById(tokenId: string): Promise<RefreshTokenRecord | null> {
  return prisma.refreshToken.findFirst({
    where: {
      tokenId,
      isRevoked: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });
}

/**
 * Update refresh token last used timestamp
 */
export async function updateRefreshTokenUsage(
  tokenId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      tokenId,
      isRevoked: false,
    },
    data: {
      lastUsedAt: new Date(),
      ipAddress,
    },
  });
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      tokenId,
    },
    data: {
      isRevoked: true,
      updatedAt: new Date(),
    },
  });
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      updatedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Get all active refresh tokens for a user
 */
export async function getUserRefreshTokens(userId: string): Promise<RefreshTokenRecord[]> {
  return prisma.refreshToken.findMany({
    where: {
      userId,
      isRevoked: false,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: new Date(),
          },
        },
        {
          isRevoked: true,
          updatedAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          },
        },
      ],
    },
  });

  return result.count;
}

// ============================================================================
// TOKEN VALIDATION
// ============================================================================

/**
 * Validate refresh token
 */
export async function validateRefreshToken(token: string): Promise<RefreshTokenValidation> {
  try {
    // First verify the JWT structure and signature
    const payload = await verifyRefreshToken(token);
    if (!payload) {
      return {
        valid: false,
        error: 'Invalid refresh token format',
      };
    }

    // Check if token exists in database and is not revoked
    const tokenRecord = await findRefreshToken(token);
    if (!tokenRecord) {
      return {
        valid: false,
        error: 'Refresh token not found or expired',
      };
    }

    // Validate token ID matches
    if (tokenRecord.tokenId !== payload.tokenId) {
      return {
        valid: false,
        error: 'Token ID mismatch',
      };
    }

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'Refresh token expired',
      };
    }

    return {
      valid: true,
      token: tokenRecord,
    };
  } catch (error) {
    console.error('Refresh token validation error:', error);
    return {
      valid: false,
      error: 'Token validation failed',
    };
  }
}

// ============================================================================
// TOKEN ROTATION
// ============================================================================

/**
 * Rotate refresh token (invalidate old, create new)
 * 
 * This function:
 * 1. Validates the old token
 * 2. Checks for suspicious activity
 * 3. Updates last used timestamp
 * 4. Adds old token to blacklist
 * 5. Creates new refresh token
 * 6. Generates new access token
 */
export async function rotateRefreshToken(
  currentToken: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
  }
): Promise<TokenRotationResult> {
  try {
    // Validate current token
    const validation = await validateRefreshToken(currentToken);
    if (!validation.valid || !validation.token) {
      return {
        success: false,
        error: validation.error || 'Invalid refresh token',
      };
    }

    const { token: tokenRecord } = validation;
    const blacklist = getTokenBlacklist();

    // Check for suspicious activity
    const isSuspicious = await detectSuspiciousActivity(
      tokenRecord.userId,
      options?.ipAddress
    );

    if (isSuspicious) {
      console.warn(`Suspicious token usage detected for user ${tokenRecord.userId}`);
      // Add all user tokens to blacklist for security
      const userTokens = await getUserRefreshTokens(tokenRecord.userId);
      for (const token of userTokens) {
        await blacklist.addToBlacklist(
          token.tokenId,
          tokenRecord.userId,
          token.expiresAt,
          'security'
        );
      }
      
      // Also revoke in database
      await revokeAllUserTokens(tokenRecord.userId);
      
      return {
        success: false,
        error: 'Suspicious activity detected. Please log in again.',
      };
    }

    // Update last used timestamp
    await updateRefreshTokenUsage(
      tokenRecord.tokenId,
      options?.ipAddress
    );

    // Add old token to blacklist (prevents reuse)
    await blacklist.addToBlacklist(
      tokenRecord.tokenId,
      tokenRecord.userId,
      tokenRecord.expiresAt,
      'rotation'
    );

    // Revoke current token in database
    await revokeRefreshToken(tokenRecord.tokenId);

    // Create new refresh token
    const newTokenRecord = await createRefreshToken({
      userId: tokenRecord.userId,
      deviceInfo: options?.deviceInfo || tokenRecord.deviceInfo,
      ipAddress: options?.ipAddress || tokenRecord.ipAddress,
      userAgent: options?.userAgent || tokenRecord.userAgent,
    });

    // Fetch user data for access token
    const user = await prisma.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const { generateAccessToken } = await import('./jwt');
    const accessToken = await generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      username: user.username || undefined,
      role: user.role,
      status: user.status,
    });

    return {
      success: true,
      accessToken,
      refreshToken: newTokenRecord.token,
    };
  } catch (error) {
    console.error('Token rotation error:', error);
    return {
      success: false,
      error: 'Failed to rotate token',
    };
  }
}

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

/**
 * Check for suspicious token usage patterns
 */
export async function detectSuspiciousActivity(
  userId: string,
  newIpAddress?: string
): Promise<boolean> {
  try {
    const recentTokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      select: {
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    // Check for multiple IPs in short time
    if (newIpAddress && recentTokens.length > 0) {
      const uniqueIps = new Set(
        recentTokens
          .filter(t => t.ipAddress)
          .map(t => t.ipAddress)
      );
      
      if (uniqueIps.size >= 3 && !uniqueIps.has(newIpAddress)) {
        return true; // Suspicious: too many different IPs
      }
    }

    // Check for rapid token creation
    if (recentTokens.length > 10) {
      return true; // Suspicious: too many tokens created
    }

    return false;
  } catch (error) {
    console.error('Suspicious activity detection error:', error);
    return false;
  }
}

/**
 * Get token usage statistics for user
 */
export async function getUserTokenStats(userId: string): Promise<{
  activeTokens: number;
  totalTokens: number;
  lastActivity?: Date;
  uniqueIPs: number;
  devices: string[];
}> {
  try {
    const [activeTokens, allTokens] = await Promise.all([
      prisma.refreshToken.count({
        where: {
          userId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.refreshToken.findMany({
        where: { userId },
        select: {
          lastUsedAt: true,
          ipAddress: true,
          deviceInfo: true,
        },
      }),
    ]);

    const lastActivity = allTokens
      .map(t => t.lastUsedAt)
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];

    const uniqueIPs = new Set(
      allTokens.filter(t => t.ipAddress).map(t => t.ipAddress)
    ).size;

    const devices = Array.from(
      new Set(
        allTokens
          .filter(t => t.deviceInfo)
          .map(t => t.deviceInfo)
      )
    );

    return {
      activeTokens,
      totalTokens: allTokens.length,
      lastActivity,
      uniqueIPs,
      devices,
    };
  } catch (error) {
    console.error('Get user token stats error:', error);
    return {
      activeTokens: 0,
      totalTokens: 0,
      uniqueIPs: 0,
      devices: [],
    };
  }
}

// ============================================================================
// MAINTENANCE FUNCTIONS
// ============================================================================

/**
 * Scheduled cleanup of old and revoked tokens
 */
export async function performTokenMaintenance(): Promise<{
  expiredRemoved: number;
  revokedRemoved: number;
}> {
  try {
    // Remove expired tokens
    const expiredResult = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Remove old revoked tokens (older than 30 days)
    const revokedResult = await prisma.refreshToken.deleteMany({
      where: {
        isRevoked: true,
        updatedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      expiredRemoved: expiredResult.count,
      revokedRemoved: revokedResult.count,
    };
  } catch (error) {
    console.error('Token maintenance error:', error);
    return {
      expiredRemoved: 0,
      revokedRemoved: 0,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createRefreshToken,
  findRefreshToken,
  findRefreshTokenById,
  updateRefreshTokenUsage,
  revokeRefreshToken,
  revokeAllUserTokens,
  getUserRefreshTokens,
  validateRefreshToken,
  rotateRefreshToken,
  cleanupExpiredTokens,
  detectSuspiciousActivity,
  getUserTokenStats,
  performTokenMaintenance,
};