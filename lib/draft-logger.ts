/**
 * Draft Operations Logger
 *
 * Centralized logging for all draft-related operations including:
 * - Creating drafts
 * - Updating/saving drafts
 * - Auto-saving drafts
 * - Deleting drafts
 * - Publishing drafts (status transitions)
 * - Archiving drafts
 *
 * Logs are written to console in development and can be extended
 * to external services (e.g., CloudWatch, Datadog) in production.
 */

export type DraftOperation =
  | 'DRAFT_CREATED'
  | 'DRAFT_UPDATED'
  | 'DRAFT_AUTO_SAVED'
  | 'DRAFT_DELETED'
  | 'DRAFT_PUBLISHED'
  | 'DRAFT_SCHEDULED'
  | 'DRAFT_ARCHIVED'
  | 'DRAFT_RESTORED'
  | 'DRAFT_STATUS_CHANGED'
  | 'DRAFT_LOADED'
  | 'DRAFT_VALIDATION_FAILED';

export interface DraftLogEntry {
  timestamp: string;
  operation: DraftOperation;
  postId?: string;
  userId?: string;
  authorId?: string;
  slug?: string;
  title?: string;
  previousStatus?: string;
  newStatus?: string;
  contentBlockCount?: number;
  wordCount?: number;
  source?: 'api' | 'cms' | 'editor' | 'auto-save' | 'scheduler';
  metadata?: Record<string, unknown>;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const config = {
  enabled: process.env.NODE_ENV !== 'test',
  minLevel: (process.env.DRAFT_LOG_LEVEL as LogLevel) || 'INFO',
  includeTimestamp: true,
  logToConsole: true,
  logToFile: process.env.NODE_ENV === 'production',
};

// ============================================================================
// LOG STORAGE (in-memory for development, can be extended)
// ============================================================================

const MAX_LOG_ENTRIES = 1000;
const logBuffer: DraftLogEntry[] = [];

function addToBuffer(entry: DraftLogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
}

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

function formatLogMessage(entry: DraftLogEntry): string {
  const parts = [
    `[DRAFT] ${entry.operation}`,
    entry.postId ? `postId=${entry.postId}` : null,
    entry.userId ? `userId=${entry.userId}` : null,
    entry.slug ? `slug="${entry.slug}"` : null,
    entry.previousStatus && entry.newStatus
      ? `status: ${entry.previousStatus} → ${entry.newStatus}`
      : entry.newStatus
        ? `status=${entry.newStatus}`
        : null,
    entry.source ? `source=${entry.source}` : null,
    entry.durationMs !== undefined ? `duration=${entry.durationMs}ms` : null,
    !entry.success ? `ERROR: ${entry.errorMessage}` : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

function getLogLevel(operation: DraftOperation, success: boolean): LogLevel {
  if (!success) return 'ERROR';

  switch (operation) {
    case 'DRAFT_AUTO_SAVED':
    case 'DRAFT_LOADED':
      return 'DEBUG';
    case 'DRAFT_VALIDATION_FAILED':
      return 'WARN';
    default:
      return 'INFO';
  }
}

function shouldLog(level: LogLevel): boolean {
  return config.enabled && LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

function writeLog(level: LogLevel, message: string, entry: DraftLogEntry): void {
  if (!config.logToConsole) return;

  const timestamp = config.includeTimestamp ? `[${entry.timestamp}] ` : '';
  const fullMessage = `${timestamp}${message}`;

  switch (level) {
    case 'DEBUG':
      console.debug(fullMessage);
      break;
    case 'INFO':
      console.info(fullMessage);
      break;
    case 'WARN':
      console.warn(fullMessage);
      break;
    case 'ERROR':
      console.error(fullMessage, entry.metadata);
      break;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Log a draft operation
 */
export function logDraftOperation(entry: Omit<DraftLogEntry, 'timestamp'>): void {
  const fullEntry: DraftLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const level = getLogLevel(entry.operation, entry.success);

  if (shouldLog(level)) {
    const message = formatLogMessage(fullEntry);
    writeLog(level, message, fullEntry);
  }

  // Always add to buffer for retrieval
  addToBuffer(fullEntry);
}

/**
 * Log draft creation
 */
export function logDraftCreated(params: {
  postId: string;
  userId: string;
  slug?: string;
  title?: string;
  source?: DraftLogEntry['source'];
  durationMs?: number;
}): void {
  logDraftOperation({
    operation: 'DRAFT_CREATED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    title: params.title,
    newStatus: 'DRAFT',
    source: params.source || 'api',
    durationMs: params.durationMs,
    success: true,
  });
}

/**
 * Log draft update/save
 */
export function logDraftUpdated(params: {
  postId: string;
  userId?: string;
  slug?: string;
  title?: string;
  contentBlockCount?: number;
  wordCount?: number;
  source?: DraftLogEntry['source'];
  durationMs?: number;
}): void {
  logDraftOperation({
    operation: 'DRAFT_UPDATED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    title: params.title,
    contentBlockCount: params.contentBlockCount,
    wordCount: params.wordCount,
    source: params.source || 'api',
    durationMs: params.durationMs,
    success: true,
  });
}

/**
 * Log draft auto-save
 */
export function logDraftAutoSaved(params: {
  postId: string;
  userId?: string;
  contentBlockCount?: number;
  durationMs?: number;
}): void {
  logDraftOperation({
    operation: 'DRAFT_AUTO_SAVED',
    postId: params.postId,
    userId: params.userId,
    contentBlockCount: params.contentBlockCount,
    source: 'auto-save',
    durationMs: params.durationMs,
    success: true,
  });
}

/**
 * Log draft deletion
 */
export function logDraftDeleted(params: {
  postId: string;
  userId: string;
  slug?: string;
  title?: string;
  source?: DraftLogEntry['source'];
}): void {
  logDraftOperation({
    operation: 'DRAFT_DELETED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    title: params.title,
    source: params.source || 'api',
    success: true,
  });
}

/**
 * Log draft publication (DRAFT → PUBLISHED)
 */
export function logDraftPublished(params: {
  postId: string;
  userId: string;
  slug?: string;
  title?: string;
  source?: DraftLogEntry['source'];
  durationMs?: number;
}): void {
  logDraftOperation({
    operation: 'DRAFT_PUBLISHED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    title: params.title,
    previousStatus: 'DRAFT',
    newStatus: 'PUBLISHED',
    source: params.source || 'api',
    durationMs: params.durationMs,
    success: true,
  });
}

/**
 * Log draft scheduling (DRAFT → SCHEDULED)
 */
export function logDraftScheduled(params: {
  postId: string;
  userId: string;
  slug?: string;
  scheduledFor?: string;
  source?: DraftLogEntry['source'];
}): void {
  logDraftOperation({
    operation: 'DRAFT_SCHEDULED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    previousStatus: 'DRAFT',
    newStatus: 'SCHEDULED',
    source: params.source || 'api',
    metadata: params.scheduledFor ? { scheduledFor: params.scheduledFor } : undefined,
    success: true,
  });
}

/**
 * Log status change
 */
export function logDraftStatusChanged(params: {
  postId: string;
  userId: string;
  previousStatus: string;
  newStatus: string;
  slug?: string;
  source?: DraftLogEntry['source'];
}): void {
  logDraftOperation({
    operation: 'DRAFT_STATUS_CHANGED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    source: params.source || 'api',
    success: true,
  });
}

/**
 * Log draft archived
 */
export function logDraftArchived(params: {
  postId: string;
  userId: string;
  previousStatus: string;
  slug?: string;
  source?: DraftLogEntry['source'];
}): void {
  logDraftOperation({
    operation: 'DRAFT_ARCHIVED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    previousStatus: params.previousStatus,
    newStatus: 'ARCHIVED',
    source: params.source || 'api',
    success: true,
  });
}

/**
 * Log draft restored
 */
export function logDraftRestored(params: {
  postId: string;
  userId: string;
  previousStatus: string;
  newStatus: string;
  slug?: string;
  source?: DraftLogEntry['source'];
}): void {
  logDraftOperation({
    operation: 'DRAFT_RESTORED',
    postId: params.postId,
    userId: params.userId,
    slug: params.slug,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    source: params.source || 'api',
    success: true,
  });
}

/**
 * Log draft validation failure
 */
export function logDraftValidationFailed(params: {
  postId?: string;
  userId?: string;
  errorMessage: string;
  source?: DraftLogEntry['source'];
  metadata?: Record<string, unknown>;
}): void {
  logDraftOperation({
    operation: 'DRAFT_VALIDATION_FAILED',
    postId: params.postId,
    userId: params.userId,
    source: params.source || 'api',
    success: false,
    errorMessage: params.errorMessage,
    metadata: params.metadata,
  });
}

/**
 * Log draft operation error
 */
export function logDraftError(params: {
  operation: DraftOperation;
  postId?: string;
  userId?: string;
  errorMessage: string;
  source?: DraftLogEntry['source'];
  metadata?: Record<string, unknown>;
}): void {
  logDraftOperation({
    operation: params.operation,
    postId: params.postId,
    userId: params.userId,
    source: params.source || 'api',
    success: false,
    errorMessage: params.errorMessage,
    metadata: params.metadata,
  });
}

// ============================================================================
// LOG RETRIEVAL (for debugging/admin)
// ============================================================================

/**
 * Get recent draft operation logs
 */
export function getRecentDraftLogs(limit = 100): DraftLogEntry[] {
  return logBuffer.slice(-limit);
}

/**
 * Get draft logs for a specific post
 */
export function getDraftLogsByPostId(postId: string): DraftLogEntry[] {
  return logBuffer.filter((entry) => entry.postId === postId);
}

/**
 * Get draft logs for a specific user
 */
export function getDraftLogsByUserId(userId: string): DraftLogEntry[] {
  return logBuffer.filter((entry) => entry.userId === userId);
}

/**
 * Get draft logs by operation type
 */
export function getDraftLogsByOperation(operation: DraftOperation): DraftLogEntry[] {
  return logBuffer.filter((entry) => entry.operation === operation);
}

/**
 * Clear log buffer (for testing)
 */
export function clearDraftLogs(): void {
  logBuffer.length = 0;
}

/**
 * Get log statistics
 */
export function getDraftLogStats(): {
  total: number;
  byOperation: Record<string, number>;
  successRate: number;
  recentErrors: DraftLogEntry[];
} {
  const byOperation: Record<string, number> = {};
  let successCount = 0;
  const recentErrors: DraftLogEntry[] = [];

  for (const entry of logBuffer) {
    byOperation[entry.operation] = (byOperation[entry.operation] || 0) + 1;
    if (entry.success) {
      successCount++;
    } else {
      recentErrors.push(entry);
    }
  }

  return {
    total: logBuffer.length,
    byOperation,
    successRate: logBuffer.length > 0 ? successCount / logBuffer.length : 1,
    recentErrors: recentErrors.slice(-10),
  };
}
