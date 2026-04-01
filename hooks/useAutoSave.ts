'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutoSaveOptions {
  /** Delay in ms before auto-saving after the last change (default: 3000) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Minimum interval between saves in ms (default: 5000) */
  minInterval?: number;
  /** Callback invoked on successful save; receives saved data */
  onSuccess?: (data: any) => void;
  /** Callback invoked on save error */
  onError?: (error: Error) => void;
}

export interface AutoSaveReturn {
  /** Current auto-save lifecycle status */
  status: AutoSaveStatus;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Timestamp of the last successful save */
  lastSavedAt: Date | null;
  /** Error message from the last failed save, if any */
  error: string | null;
  /** Number of consecutive save failures */
  failureCount: number;
  /** Mark content as changed — resets the debounce timer */
  markDirty: () => void;
  /** Manually trigger an immediate save */
  saveNow: () => Promise<void>;
  /** Reset dirty state without saving (e.g. after a manual save elsewhere) */
  clearDirty: () => void;
  /** Human-readable label for the current status */
  statusLabel: string;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Debounced auto-save hook.
 *
 * Call `markDirty()` every time the editor content changes.
 * The hook will coalesce changes and call `saveFn` after the debounce delay,
 * respecting the minimum interval between saves.
 *
 * @param saveFn  Async function that persists the current state. Receives no
 *                arguments — the caller should close over the data to save.
 * @param opts    Configuration options.
 */
export function useAutoSave(
  saveFn: () => Promise<any>,
  opts: AutoSaveOptions = {}
): AutoSaveReturn {
  const {
    delay = 3000,
    enabled = true,
    minInterval = 5000,
    onSuccess,
    onError,
  } = opts;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failureCount, setFailureCount] = useState(0);

  // Refs to hold stable references across renders
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const savingRef = useRef(false);
  const saveFnRef = useRef(saveFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Keep refs current
  useEffect(() => { saveFnRef.current = saveFn; }, [saveFn]);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // ------ Core save logic ------
  const executeSave = useCallback(async () => {
    if (savingRef.current) return; // prevent concurrent saves

    savingRef.current = true;
    setStatus('saving');
    setError(null);

    try {
      const result = await saveFnRef.current();
      const now = new Date();
      lastSaveTimeRef.current = now.getTime();
      setLastSavedAt(now);
      setIsDirty(false);
      setStatus('saved');
      setFailureCount(0);
      onSuccessRef.current?.(result);

      // Fade back to idle after 3 s so the UI doesn't stay on "Saved" forever
      setTimeout(() => {
        setStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-save failed';
      setError(msg);
      setStatus('error');
      setFailureCount((c) => c + 1);
      onErrorRef.current?.(err instanceof Error ? err : new Error(msg));
    } finally {
      savingRef.current = false;
    }
  }, []);

  // ------ Debounce scheduling ------
  useEffect(() => {
    if (!enabled || !isDirty) return;

    // Clear any pending timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Respect minimum interval
    const elapsed = Date.now() - lastSaveTimeRef.current;
    const effectiveDelay = Math.max(delay, minInterval - elapsed);

    setStatus('pending');

    timerRef.current = setTimeout(() => {
      executeSave();
    }, effectiveDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, enabled, delay, minInterval, executeSave]);

  // ------ Public methods ------
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await executeSave();
  }, [executeSave]);

  const clearDirty = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsDirty(false);
    setStatus('idle');
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ------ Warn on unsaved changes before navigation ------
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ------ Derived label ------
  const statusLabel = (() => {
    switch (status) {
      case 'pending': return 'Unsaved changes';
      case 'saving': return 'Saving…';
      case 'saved': return 'All changes saved';
      case 'error': return `Save failed${failureCount > 1 ? ` (${failureCount}×)` : ''}`;
      default: return isDirty ? 'Unsaved changes' : 'No changes';
    }
  })();

  return {
    status,
    isDirty,
    lastSavedAt,
    error,
    failureCount,
    markDirty,
    saveNow,
    clearDirty,
    statusLabel,
  };
}
