'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EditorState } from '@/types/blocks';
import { PostWithRelations } from '@/lib/database';

// ============================================================================
// TYPES
// ============================================================================

export interface CMSPostResult {
  success: boolean;
  data?: PostWithRelations;
  error?: string;
  errors?: string[];
  validationErrors?: any;
}

export interface SlugValidationResult {
  available: boolean;
  suggestion?: string;
  formatted: string;
  errors: string[];
}

export interface ContentValidationResult {
  isValid: boolean;
  cmsValidation: any;
  uniqueValidation: any;
  suggestedSlug?: string;
}

export interface UseCMSPostsOptions {
  postId?: string;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

// ============================================================================
// MAIN CMS HOOK
// ============================================================================

export function useCMSPosts(options: UseCMSPostsOptions = {}) {
  const { postId, autoSave = false, autoSaveDelay = 2000 } = options;

  // State management
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<any>(null);

  // Auto-save timer
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // ============================================================================
  // CORE CMS OPERATIONS
  // ============================================================================

  /**
   * Load post for editing
   */
  const loadPost = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cms/posts/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load post');
      }

      if (result.success) {
        setEditorState(result.data);
        setIsDirty(false);
        setValidationErrors(null);
      } else {
        throw new Error(result.error || 'Failed to load post');
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load post';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create new post
   */
  const createPost = useCallback(async (
    editorState: EditorState,
    publishNow = false
  ): Promise<CMSPostResult> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/cms/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'temp-user-id', // TODO: Replace with actual auth
        },
        body: JSON.stringify({
          editorState,
          publishNow,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.validationErrors) {
          setValidationErrors(result.validationErrors);
        }
        throw new Error(result.error || 'Failed to create post');
      }

      if (result.success) {
        setIsDirty(false);
        setLastSaved(new Date());
        setValidationErrors(null);
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create post';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Update existing post
   */
  const updatePost = useCallback(async (
    id: string,
    editorState: EditorState,
    publishNow = false
  ): Promise<CMSPostResult> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/cms/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editorState,
          publishNow,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.validationErrors) {
          setValidationErrors(result.validationErrors);
        }
        throw new Error(result.error || 'Failed to update post');
      }

      if (result.success) {
        setIsDirty(false);
        setLastSaved(new Date());
        setValidationErrors(null);
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update post';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ============================================================================
  // VALIDATION OPERATIONS
  // ============================================================================

  /**
   * Validate slug in real-time
   */
  const validateSlug = useCallback(async (
    slug: string,
    currentPostId?: string
  ): Promise<SlugValidationResult> => {
    try {
      const response = await fetch('/api/cms/posts/validate-slug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug,
          postId: currentPostId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        return {
          available: false,
          formatted: slug,
          errors: [result.error || 'Validation failed'],
        };
      }

    } catch (err) {
      return {
        available: false,
        formatted: slug,
        errors: ['Network error during validation'],
      };
    }
  }, []);

  /**
   * Generate slug from title
   */
  const generateSlug = useCallback(async (
    title: string,
    currentPostId?: string
  ): Promise<{ slug: string; validation: SlugValidationResult }> => {
    try {
      const response = await fetch('/api/cms/posts/generate-slug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          postId: currentPostId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to generate slug');
      }

    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate slug');
    }
  }, []);

  /**
   * Validate entire content without saving
   */
  const validateContent = useCallback(async (
    editorState: EditorState,
    currentPostId?: string
  ): Promise<ContentValidationResult> => {
    try {
      const response = await fetch('/api/cms/posts/validate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editorState,
          postId: currentPostId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Validation failed');
      }

    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Validation failed');
    }
  }, []);

  // ============================================================================
  // EDITOR STATE MANAGEMENT
  // ============================================================================

  /**
   * Update editor state with auto-save support
   */
  const updateEditorState = useCallback((
    updater: EditorState | ((current: EditorState | null) => EditorState | null)
  ) => {
    setEditorState(current => {
      const newState = typeof updater === 'function' ? updater(current) : updater;
      
      if (newState && newState !== current) {
        setIsDirty(true);
        
        // Clear existing auto-save timer
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }

        // Set new auto-save timer if enabled and we have a postId
        if (autoSave && postId) {
          const newTimer = setTimeout(() => {
            updatePost(postId, newState, false);
          }, autoSaveDelay);
          
          setAutoSaveTimer(newTimer);
        }
      }
      
      return newState;
    });
  }, [autoSave, autoSaveDelay, postId, autoSaveTimer, updatePost]);

  /**
   * Save current state
   */
  const save = useCallback(async (publishNow = false) => {
    if (!editorState) {
      throw new Error('No content to save');
    }

    if (postId) {
      return await updatePost(postId, editorState, publishNow);
    } else {
      return await createPost(editorState, publishNow);
    }
  }, [editorState, postId, updatePost, createPost]);

  /**
   * Reset dirty state
   */
  const resetDirty = useCallback(() => {
    setIsDirty(false);
    setLastSaved(new Date());
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load post on mount if postId provided
  useEffect(() => {
    if (postId) {
      loadPost(postId).catch(console.error);
    }
  }, [postId, loadPost]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    editorState,
    isLoading,
    isSaving,
    error,
    isDirty,
    lastSaved,
    validationErrors,

    // Core operations
    loadPost,
    createPost,
    updatePost,
    save,

    // Validation
    validateSlug,
    generateSlug,
    validateContent,

    // Editor state management
    updateEditorState,
    resetDirty,

    // Utils
    clearError: () => setError(null),
    clearValidationErrors: () => setValidationErrors(null),
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook for creating new posts
 */
export function useCreatePost() {
  return useCMSPosts({ autoSave: false });
}

/**
 * Hook for editing existing posts with auto-save
 */
export function useEditPost(postId: string, autoSave = true) {
  return useCMSPosts({ 
    postId, 
    autoSave, 
    autoSaveDelay: 2000 
  });
}

/**
 * Hook for draft management
 */
export function useDraftPost(autoSave = true) {
  // TODO: Implement draft persistence to localStorage
  return useCMSPosts({ 
    autoSave: false // Drafts save to localStorage, not server
  });
}