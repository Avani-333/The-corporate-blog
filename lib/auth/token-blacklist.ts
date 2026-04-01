/**
 * Token Blacklist Service
 * Redis-ready service for tracking revoked/blacklisted tokens
 * 
 * Prevents refresh token reuse after logout or rotation.
 * Supports both in-memory store and Redis backend.
 */

type BlacklistStore = 'memory' | 'redis';

interface BlacklistEntry {
  tokenId: string;
  userId: string;
  revokedAt: number; // Unix timestamp (ms)
  expiresAt: number; // Unix timestamp (ms)
  reason?: 'logout' | 'rotation' | 'security' | 'compromised';
}

/**
 * In-memory blacklist store (development/single-instance)
 */
class MemoryBlacklistStore {
  private entries = new Map<string, BlacklistEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup expired entries every 30 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  has(tokenId: string): boolean {
    const entry = this.entries.get(tokenId);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(tokenId);
      return false;
    }
    
    return true;
  }

  add(entry: BlacklistEntry): void {
    this.entries.set(entry.tokenId, entry);
  }

  remove(tokenId: string): void {
    this.entries.delete(tokenId);
  }

  getEntry(tokenId: string): BlacklistEntry | null {
    const entry = this.entries.get(tokenId);
    if (!entry) return null;
    
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(tokenId);
      return null;
    }
    
    return entry;
  }

  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [tokenId, entry] of this.entries.entries()) {
      if (entry.expiresAt < now) {
        entriesToDelete.push(tokenId);
      }
    }

    entriesToDelete.forEach(tokenId => this.entries.delete(tokenId));
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }
}

/**
 * Redis blacklist store (production/distributed)
 */
class RedisBlacklistStore {
  private redis: any = null;
  private keyPrefix = 'tcb:token-blacklist:';

  constructor(redisClient?: any) {
    if (redisClient) {
      this.redis = redisClient;
    } else if (process.env.REDIS_URL && process.env.REDIS_ENABLED !== 'false') {
      // Redis is optional - only load if explicitly enabled and available
      // In serverless environments like Vercel, this is typically disabled
      this.redis = null;
      console.warn('Redis support is disabled in this environment. Using memory store.');
    }
  }

  async has(tokenId: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const exists = await this.redis.get(`${this.keyPrefix}${tokenId}`);
      return exists !== null;
    } catch (error) {
      console.error('Redis error checking blacklist:', error);
      return false;
    }
  }

  async add(entry: BlacklistEntry): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `${this.keyPrefix}${entry.tokenId}`;
      const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);

      await this.redis.setEx(
        key,
        Math.max(1, ttl), // Redis requires TTL > 0
        JSON.stringify(entry)
      );
    } catch (error) {
      console.error('Redis error adding to blacklist:', error);
    }
  }

  async remove(tokenId: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(`${this.keyPrefix}${tokenId}`);
    } catch (error) {
      console.error('Redis error removing from blacklist:', error);
    }
  }

  async getEntry(tokenId: string): Promise<BlacklistEntry | null> {
    if (!this.redis) return null;

    try {
      const data = await this.redis.get(`${this.keyPrefix}${tokenId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis error getting blacklist entry:', error);
      return null;
    }
  }

  async size(): Promise<number> {
    if (!this.redis) return 0;

    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      return keys.length;
    } catch (error) {
      console.error('Redis error getting blacklist size:', error);
      return 0;
    }
  }

  async destroy(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Redis error during shutdown:', error);
    }
  }
}

/**
 * Token Blacklist Manager
 * Unified interface supporting both memory and Redis backends
 */
class TokenBlacklist {
  private memoryStore: MemoryBlacklistStore;
  private redisStore: RedisBlacklistStore | null;
  private useRedis: boolean;

  constructor(useRedis: boolean = process.env.REDIS_URL ? true : false) {
    this.memoryStore = new MemoryBlacklistStore();
    this.useRedis = useRedis;

    if (this.useRedis) {
      this.redisStore = new RedisBlacklistStore();
    } else {
      this.redisStore = null;
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    // Always check memory store first (faster)
    if (this.memoryStore.has(tokenId)) {
      return true;
    }

    // Check Redis if available
    if (this.redisStore && this.useRedis) {
      return await this.redisStore.has(tokenId);
    }

    return false;
  }

  /**
   * Add a token to the blacklist
   */
  async addToBlacklist(
    tokenId: string,
    userId: string,
    expiresAt: Date,
    reason: 'logout' | 'rotation' | 'security' | 'compromised' = 'logout'
  ): Promise<void> {
    const entry: BlacklistEntry = {
      tokenId,
      userId,
      revokedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
      reason,
    };

    // Always add to memory store
    this.memoryStore.add(entry);

    // Also add to Redis if available
    if (this.redisStore && this.useRedis) {
      await this.redisStore.add(entry);
    }
  }

  /**
   * Get blacklist entry details
   */
  async getBlacklistEntry(tokenId: string): Promise<BlacklistEntry | null> {
    let entry = null;

    // Try memory store first
    entry = this.memoryStore.getEntry(tokenId);
    if (entry) return entry;

    // Try Redis if available
    if (this.redisStore && this.useRedis) {
      entry = await this.redisStore.getEntry(tokenId);
    }

    return entry;
  }

  /**
   * Revoke all user tokens
   * Call this from database after revokeAllUserTokens
   */
  async revokeUserTokens(
    tokenIds: string[],
    userId: string,
    expiresAt: Date
  ): Promise<void> {
    const promises = tokenIds.map(tokenId =>
      this.addToBlacklist(tokenId, userId, expiresAt, 'logout')
    );
    await Promise.all(promises);
  }

  /**
   * Get current blacklist size (memory only)
   */
  getMemorySize(): number {
    return this.memoryStore.size();
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.memoryStore.destroy();
    if (this.redisStore) {
      await this.redisStore.destroy();
    }
  }

  /**
   * Enable or switch Redis store
   */
  setRedisStore(useRedis: boolean): void {
    this.useRedis = useRedis;
    if (useRedis && !this.redisStore) {
      this.redisStore = new RedisBlacklistStore();
    }
  }
}

// Singleton instance
let blacklistInstance: TokenBlacklist | null = null;

/**
 * Get singleton blacklist instance
 */
export function getTokenBlacklist(): TokenBlacklist {
  if (!blacklistInstance) {
    blacklistInstance = new TokenBlacklist();
  }
  return blacklistInstance;
}

/**
 * Initialize token blacklist (call on app startup)
 */
export function initializeTokenBlacklist(): TokenBlacklist {
  const useRedis = !!process.env.REDIS_URL;
  blacklistInstance = new TokenBlacklist(useRedis);
  return blacklistInstance;
}

// Export types
export type { BlacklistEntry };
export { TokenBlacklist, MemoryBlacklistStore, RedisBlacklistStore };
