import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '@/utils/requestContext';

export const requestTracing = (req: Request, res: Response, next: NextFunction): void => {
  const incomingRequestId = req.header('x-request-id');
  const requestId = incomingRequestId && incomingRequestId.trim().length > 0
    ? incomingRequestId.trim()
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  runWithRequestContext(
    {
      requestId,
      startedAt: Date.now(),
      dbQueryTimeMs: 0,
      dbQueryCount: 0,
    },
    () => {
      next();
    },
  );
};
