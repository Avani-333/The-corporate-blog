import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { addDbQueryTiming } from '@/utils/requestContext';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

const attachPrismaTimingMiddleware = (client: PrismaClient): PrismaClient => {
  client.$use(async (params: unknown, next: (args: unknown) => Promise<unknown>) => {
    const startNs = process.hrtime.bigint();

    try {
      return await next(params);
    } finally {
      const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      addDbQueryTiming(durationMs);
    }
  });

  return client;
};

if (process.env.NODE_ENV === 'production') {
  prisma = attachPrismaTimingMiddleware(new PrismaClient({
    log: ['error'],
  }));
} else {
  if (!global.__prisma) {
    global.__prisma = attachPrismaTimingMiddleware(new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    }));
  }
  prisma = global.__prisma;
}

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('database.connected', { status: 'ok' });
  } catch (error) {
    logger.error('database.connection_failed', { error });
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('database.disconnected', { status: 'ok' });
  } catch (error) {
    logger.error('database.disconnection_failed', { error });
    throw error;
  }
}

export { prisma };