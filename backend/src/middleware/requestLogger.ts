import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { getRequestContext } from '@/utils/requestContext';

const getUserRole = (req: Request): string => {
  if (req.user?.role) {
    return req.user.role;
  }

  const roleHeader = req.header('x-user-role');
  return roleHeader && roleHeader.trim().length > 0 ? roleHeader : 'anonymous';
};

const getRoutePattern = (req: Request): string => {
  const routePath = (req.route as { path?: string } | undefined)?.path;
  if (!routePath) {
    return req.originalUrl;
  }

  return `${req.baseUrl || ''}${routePath}`;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startNs = process.hrtime.bigint();
  const requestId = req.requestId ?? getRequestContext()?.requestId;

  logger.info('request.received', {
    requestId,
    method: req.method,
    route: req.originalUrl,
    userRole: getUserRole(req),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const { statusCode } = res;

    const context = getRequestContext();
    const dbQueryTimeMs = Number((context?.dbQueryTimeMs ?? 0).toFixed(2));
    const dbQueryCount = context?.dbQueryCount ?? 0;

    req.dbQueryTimeMs = dbQueryTimeMs;
    req.dbQueryCount = dbQueryCount;

    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('request.completed', {
      requestId: req.requestId ?? context?.requestId,
      method: req.method,
      route: getRoutePattern(req),
      userRole: getUserRole(req),
      statusCode,
      responseTimeMs: Number(durationMs.toFixed(2)),
      dbQueryTimeMs,
      dbQueryCount,
      contentLength: res.get('Content-Length'),
    });
  });

  next();
};