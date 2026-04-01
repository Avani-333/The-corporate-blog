import { Request, Response, NextFunction } from 'express';
import { recordHttpMetric } from '@/services/metrics';

export const metricsCollector = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    // Avoid self-observation noise for metrics scraping.
    if (req.originalUrl.startsWith('/metrics')) return;

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    recordHttpMetric(req.method, res.statusCode, durationMs, req.originalUrl || req.path);
  });

  next();
};
