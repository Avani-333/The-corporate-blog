/**
 * Audit Tracking Middleware
 * Captures request context for audit logging (user, IP, user-agent, session)
 * Attaches audit context to request object for use in route handlers
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface AuditRequest extends Request {
  auditContext?: {
    requestId: string;
    sessionId: string;
    userId?: string;
    userEmail?: string;
    username?: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
  };
}

/**
 * Middleware to capture and attach audit context to requests
 */
export function auditTrackingMiddleware(
  req: AuditRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract user information from JWT or session
  const userId = (req as any).user?.id;
  const userEmail = (req as any).user?.email;
  const username = (req as any).user?.username;

  // Extract IP address
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  // Extract user agent
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Generate or retrieve request ID
  const requestId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    uuidv4();

  // Get or create session ID (can be from cookie or header)
  let sessionId = (req.headers['x-session-id'] as string);
  if (!sessionId && req.cookies?.sessionId) {
    sessionId = req.cookies.sessionId;
  }
  if (!sessionId) {
    sessionId = uuidv4();
  }

  // Attach audit context to request
  req.auditContext = {
    requestId,
    sessionId,
    userId,
    userEmail,
    username,
    ipAddress,
    userAgent,
    timestamp: new Date(),
  };

  next();
}

/**
 * Middleware to capture request/response for audit purposes
 * Useful for tracking API changes
 */
export function auditRequestCaptureMiddleware(
  req: AuditRequest,
  res: Response,
  next: NextFunction
): void {
  // Store original response methods
  const originalJson = res.json;
  const originalSend = res.send;

  // Create a variable to store the response body
  let resBody = '';

  // Override res.json to capture response
  res.json = function (body: any) {
    resBody = JSON.stringify(body);
    return originalJson.call(this, body);
  };

  // Override res.send to capture response
  res.send = function (body: any) {
    resBody = typeof body === 'string' ? body : JSON.stringify(body);
    return originalSend.call(this, body);
  };

  // Store response body in request for later access
  (req as any).auditResponseBody = resBody;

  next();
}

/**
 * Middleware to audit data modifications
 * Automatically logs changes to monitored entities
 */
export function createAuditLogMiddleware(
  auditLogger: any,
  monitoredRoutes: { path: string; entity: string }[] = []
) {
  return async (
    req: AuditRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Check if this is a monitored route
    const monitoredRoute = monitoredRoutes.find((route) => {
      const regex = new RegExp(`^${route.path}$`);
      return regex.test(req.path);
    });

    if (!monitoredRoute) {
      return next();
    }

    // Only audit write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Store original response methods
    const originalJson = res.json;
    const originalStatus = res.status;

    // Track response status and body
    let responseStatus = 200;
    let responseBody: any = null;

    // Override status to track response code
    res.status = function (code: number) {
      responseStatus = code;
      return originalStatus.call(this, code);
    };

    // Override json to capture response and log audit
    res.json = function (body: any) {
      responseBody = body;

      // Log audit entry if response is successful (2xx)
      if (responseStatus >= 200 && responseStatus < 300 && req.auditContext) {
        const result = originalJson.call(this, body);

        // Determine action based on HTTP method
        let action = 'UPDATE';
        if (req.method === 'POST') action = 'CREATE';
        if (req.method === 'DELETE') action = 'DELETE';

        // Log the action asynchronously
        setImmediate(() => {
          auditLogger
            .log({
              action,
              entity: monitoredRoute.entity,
              entityId: (req as any).params?.id || 'unknown',
              newData: req.body,
              context: {
                userId: req.auditContext?.userId,
                userEmail: req.auditContext?.userEmail,
                username: req.auditContext?.username,
                ipAddress: req.auditContext?.ipAddress,
                userAgent: req.auditContext?.userAgent,
                requestId: req.auditContext?.requestId,
                sessionId: req.auditContext?.sessionId,
              },
              status:
                responseStatus >= 200 && responseStatus < 300
                  ? 'SUCCESS'
                  : 'FAILED',
              changedFields: Object.keys(req.body || {}),
            })
            .catch((error) => {
              console.error('Audit log creation failed:', error);
            });
        });

        return result;
      }

      const result = originalJson.call(this, body);
      return result;
    };

    next();
  };
}

/**
 * Helper function to extract audit context from request
 */
export function getAuditContext(req: AuditRequest): {
  userId?: string;
  userEmail?: string;
  username?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  sessionId: string;
} | null {
  return (
    req.auditContext || {
      ipAddress: 'unknown',
      userAgent: 'unknown',
      requestId: uuidv4(),
      sessionId: uuidv4(),
    }
  );
}

export default {
  auditTrackingMiddleware,
  auditRequestCaptureMiddleware,
  createAuditLogMiddleware,
  getAuditContext,
};
