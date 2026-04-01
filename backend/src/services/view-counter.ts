import Redis from 'ioredis';
import { prisma } from '@/config/database';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export type ViewCounterMode = 'db' | 'redis';

export interface ViewCounterResult {
  mode: ViewCounterMode;
  persisted: boolean;
  buffered: boolean;
  incrementBy: number;
  bufferValue?: number;
}

interface ViewCounter {
  increment(postId: string, incrementBy?: number): Promise<ViewCounterResult>;
}

class DatabaseViewCounter implements ViewCounter {
  async increment(postId: string, incrementBy = 1): Promise<ViewCounterResult> {
    await prisma.post.update({
      where: { id: postId },
      data: {
        viewCount: {
          increment: incrementBy,
        },
      },
    });

    return {
      mode: 'db',
      persisted: true,
      buffered: false,
      incrementBy,
    };
  }
}

class RedisViewCounter implements ViewCounter {
  private readonly redis: Redis;
  private readonly writeThrough: boolean;

  constructor(redisUrl: string, redisPassword?: string, writeThrough = true) {
    this.redis = new Redis(redisUrl, {
      password: redisPassword,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });

    this.writeThrough = writeThrough;

    this.redis.on('error', (error: unknown) => {
      logger.warn(`Redis view counter error: ${String(error)}`);
    });
  }

  async increment(postId: string, incrementBy = 1): Promise<ViewCounterResult> {
    const key = `counter:post:view:${postId}`;
    const bufferValue = await this.redis.incrby(key, incrementBy);
    await this.redis.expire(key, 60 * 60 * 24 * 2);

    if (this.writeThrough) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          viewCount: {
            increment: incrementBy,
          },
        },
      });
    }

    return {
      mode: 'redis',
      persisted: this.writeThrough,
      buffered: true,
      incrementBy,
      bufferValue,
    };
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;
  return value.toLowerCase() === 'true';
}

function createCounter(): ViewCounter {
  const mode = (process.env.VIEW_COUNTER_MODE || 'db').toLowerCase();
  const writeThrough = parseBoolean(process.env.VIEW_COUNTER_WRITE_THROUGH, true);

  if (mode === 'redis' && config.redis.url) {
    return new RedisViewCounter(config.redis.url, config.redis.password, writeThrough);
  }

  return new DatabaseViewCounter();
}

const counter = createCounter();

export async function incrementPostViewCount(postId: string, incrementBy = 1): Promise<ViewCounterResult> {
  try {
    return await counter.increment(postId, incrementBy);
  } catch (error) {
    logger.warn(`View counter abstraction fallback to DB for post ${postId}: ${String(error)}`);
    const fallback = new DatabaseViewCounter();
    return fallback.increment(postId, incrementBy);
  }
}
