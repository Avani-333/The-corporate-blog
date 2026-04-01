/**
 * Error tracking and monitoring types
 */

export interface ErrorReport {
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url: string;
  userAgent: string;
  timestamp: string;
}

export interface ErrorTrackingContext {
  [key: string]: unknown;
}

export interface ErrorResponse {
  success: boolean;
  tracked?: number;
  error?: string;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorAlert {
  id: string;
  type: string;
  message: string;
  severity: ErrorSeverity;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedUsers: number;
}
