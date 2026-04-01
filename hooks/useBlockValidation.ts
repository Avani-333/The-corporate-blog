/**
 * useBlockValidation
 *
 * React hook that runs structured block validation whenever content
 * changes (debounced to avoid excessive computation) and exposes
 * per-block error maps, publish-readiness, and manual re-validation.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockValidationResult,
  BlockValidationIssue,
  ValidationSeverity,
  validateAllBlocks,
  validatePostForPublish,
} from '@/lib/block-validation';

// ============================================================================
// TYPES
// ============================================================================

interface PostMeta {
  title?: string;
  slug?: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  status?: string;
}

export interface UseBlockValidationOptions {
  /** Blocks array from editor state / DraftPost */
  blocks: any[];
  /** Post metadata for publish-readiness checks */
  meta?: PostMeta;
  /** Debounce delay in ms (default 500) */
  debounceMs?: number;
  /** Only validate when enabled (default true) */
  enabled?: boolean;
  /** Minimum severity to show (default 'warning') — 'error' | 'warning' | 'info' */
  minSeverity?: ValidationSeverity;
}

export interface UseBlockValidationReturn {
  /** Full validation result (null until first run) */
  result: BlockValidationResult | null;
  /** True when there are no errors (warnings allowed) */
  isValid: boolean;
  /** True when content + metadata pass all publish checks */
  isPublishReady: boolean;
  /** Errors for a specific block ID */
  getBlockIssues: (blockId: string) => BlockValidationIssue[];
  /** Whether a specific block has errors */
  hasBlockErrors: (blockId: string) => boolean;
  /** Post-level issues (title, slug, SEO, etc.) */
  postIssues: BlockValidationIssue[];
  /** Filtered issues based on minSeverity */
  visibleIssues: BlockValidationIssue[];
  /** Counts by severity */
  counts: { errors: number; warnings: number; info: number };
  /** Re-run validation immediately */
  revalidate: () => void;
  /** Run full publish-readiness check (includes post meta) */
  validateForPublish: () => BlockValidationResult;
  /** Whether validation is currently running (debounced) */
  isPending: boolean;
}

// ============================================================================
// SEVERITY ORDERING
// ============================================================================

const SEVERITY_ORDER: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 };

function filterBySeverity(issues: BlockValidationIssue[], min: ValidationSeverity): BlockValidationIssue[] {
  const threshold = SEVERITY_ORDER[min];
  return issues.filter((i) => SEVERITY_ORDER[i.severity] <= threshold);
}

// ============================================================================
// HOOK
// ============================================================================

export function useBlockValidation({
  blocks,
  meta,
  debounceMs = 500,
  enabled = true,
  minSeverity = 'warning',
}: UseBlockValidationOptions): UseBlockValidationReturn {
  const [result, setResult] = useState<BlockValidationResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const blocksRef = useRef(blocks);
  const metaRef = useRef(meta);
  blocksRef.current = blocks;
  metaRef.current = meta;

  // ---- Run validation (debounced) ----
  useEffect(() => {
    if (!enabled) return;

    setIsPending(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const res = validateAllBlocks(blocksRef.current);
      setResult(res);
      setIsPending(false);
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
  }, [blocks, enabled, debounceMs]);

  // ---- Manual revalidate (immediate) ----
  const revalidate = useCallback(() => {
    clearTimeout(timerRef.current);
    const res = validateAllBlocks(blocksRef.current);
    setResult(res);
    setIsPending(false);
  }, []);

  // ---- Publish check ----
  const validateForPublish = useCallback(() => {
    clearTimeout(timerRef.current);
    const res = validatePostForPublish(blocksRef.current, metaRef.current ?? {});
    setResult(res);
    setIsPending(false);
    return res;
  }, []);

  // ---- Derived helpers ----
  const getBlockIssues = useCallback(
    (blockId: string): BlockValidationIssue[] => {
      if (!result) return [];
      return result.issuesByBlock[blockId] ?? [];
    },
    [result],
  );

  const hasBlockErrors = useCallback(
    (blockId: string): boolean => {
      if (!result) return false;
      const issues = result.issuesByBlock[blockId];
      return !!issues && issues.some((i) => i.severity === 'error');
    },
    [result],
  );

  const postIssues = useMemo(() => {
    if (!result) return [];
    return result.issuesByBlock['__post__'] ?? [];
  }, [result]);

  const visibleIssues = useMemo(() => {
    if (!result) return [];
    return filterBySeverity(result.issues, minSeverity);
  }, [result, minSeverity]);

  return {
    result,
    isValid: result?.isValid ?? true,
    isPublishReady: result?.isPublishReady ?? false,
    getBlockIssues,
    hasBlockErrors,
    postIssues,
    visibleIssues,
    counts: result?.counts ?? { errors: 0, warnings: 0, info: 0 },
    revalidate,
    validateForPublish,
    isPending,
  };
}
