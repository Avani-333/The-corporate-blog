import { Router } from 'express';
import { Request, Response } from 'express';
import { getHttpMetricsSnapshot } from '@/services/metrics';

const router = Router();

function normalizeIp(ip: string): string {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = normalizeIp(ip);

  return (
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function isInternalRequest(req: Request): boolean {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  const candidateIp = forwardedFor || realIp || req.ip || req.socket.remoteAddress || '';

  return isPrivateOrLocalIp(candidateIp);
}

// GET /metrics
// Internal-only operational metrics endpoint.
router.get('/', (req: Request, res: Response) => {
  if (!isInternalRequest(req)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Metrics endpoint is restricted to internal network access.',
    });
  }

  return res.status(200).json({
    success: true,
    data: getHttpMetricsSnapshot(),
  });
});

export default router;
