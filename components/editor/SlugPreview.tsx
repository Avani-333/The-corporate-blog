'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Globe,
  Check,
  AlertTriangle,
  Loader2,
  Link2,
  RefreshCw,
  Copy,
  ExternalLink,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type SlugStatus = 'idle' | 'generating' | 'validating' | 'available' | 'taken' | 'invalid' | 'error';

interface SlugPreviewProps {
  /** Current title — slug is auto‑generated from it */
  title: string;
  /** Current slug value (controlled) */
  slug: string;
  /** Post ID when editing (excluded from uniqueness checks) */
  postId?: string;
  /** Called when the slug value changes */
  onChange: (slug: string) => void;
  /** Base path shown before the slug (default: /blog/) */
  basePath?: string;
  /** Full site URL for the "copy link" feature */
  siteUrl?: string;
  /** Debounce delay in ms for validation (default: 500) */
  debounceMs?: number;
  /** Compact mode — hides some decorative chrome */
  compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SlugPreview({
  title,
  slug,
  postId,
  onChange,
  basePath = '/blog/',
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecorporateblog.com',
  debounceMs = 500,
  compact = false,
}: SlugPreviewProps) {
  const [status, setStatus] = useState<SlugStatus>('idle');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const prevTitleRef = useRef(title);

  // ------------------------------------------------------------------
  // Auto-generate slug from title when it changes
  // ------------------------------------------------------------------
  useEffect(() => {
    // Don't auto-generate if user is manually editing the slug
    if (isEditing) return;
    // Don't regenerate if title hasn't meaningfully changed
    if (title === prevTitleRef.current) return;
    prevTitleRef.current = title;

    if (!title.trim()) {
      onChange('');
      setStatus('idle');
      return;
    }

    if (generateTimer.current) clearTimeout(generateTimer.current);

    setStatus('generating');

    generateTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/posts/generate-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, postId }),
        });

        if (!res.ok) {
          // Fallback: simple client-side slugify
          onChange(clientSlugify(title));
          setStatus('idle');
          return;
        }

        const json = await res.json();
        if (json.success && json.data?.slug) {
          onChange(json.data.slug);
          setStatus('available');
          setErrors([]);
          setSuggestion(null);
        } else {
          onChange(clientSlugify(title));
          setStatus('idle');
        }
      } catch {
        // Network error — fall back to client-side slugify
        onChange(clientSlugify(title));
        setStatus('idle');
      }
    }, debounceMs);

    return () => {
      if (generateTimer.current) clearTimeout(generateTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, isEditing, postId, debounceMs]);

  // ------------------------------------------------------------------
  // Validate slug when user edits it manually
  // ------------------------------------------------------------------
  const validateSlug = useCallback(
    (value: string) => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
      if (abortCtrlRef.current) abortCtrlRef.current.abort();

      if (!value.trim()) {
        setStatus('idle');
        setErrors([]);
        setSuggestion(null);
        return;
      }

      setStatus('validating');

      validateTimer.current = setTimeout(async () => {
        const ctrl = new AbortController();
        abortCtrlRef.current = ctrl;

        try {
          const res = await fetch('/api/posts/validate-slug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: value, postId }),
            signal: ctrl.signal,
          });

          if (ctrl.signal.aborted) return;

          if (!res.ok) {
            setStatus('error');
            setErrors(['Validation service unavailable']);
            return;
          }

          const json = await res.json();

          if (json.success && json.data) {
            if (json.data.available) {
              setStatus('available');
              setErrors([]);
              setSuggestion(null);
            } else {
              setStatus('taken');
              setErrors(json.data.errors || ['This slug is already in use']);
              setSuggestion(json.data.suggestion || null);
            }
          } else {
            setStatus('invalid');
            setErrors(json.errors || json.data?.errors || ['Invalid slug']);
            setSuggestion(json.data?.suggestion || null);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          setStatus('error');
          setErrors(['Could not validate slug']);
        }
      }, debounceMs);
    },
    [postId, debounceMs]
  );

  // ------------------------------------------------------------------
  // Manual slug editing
  // ------------------------------------------------------------------
  const handleSlugChange = (value: string) => {
    // Normalise while typing: lowercase, hyphens only
    const normalised = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    onChange(normalised);
    validateSlug(normalised);
  };

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      onChange(suggestion);
      setSuggestion(null);
      setStatus('available');
      setErrors([]);
    }
  };

  const handleRegenerateFromTitle = () => {
    setIsEditing(false);
    prevTitleRef.current = ''; // Force regeneration
    // Trigger via title change effect
    setTimeout(() => {
      prevTitleRef.current = '';
    }, 0);
  };

  const handleCopyLink = async () => {
    const fullUrl = `${siteUrl}${basePath}${slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = fullUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ------------------------------------------------------------------
  // Status badge
  // ------------------------------------------------------------------
  const renderStatusBadge = () => {
    switch (status) {
      case 'generating':
      case 'validating':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            {status === 'generating' ? 'Generating…' : 'Checking…'}
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" />
            Available
          </span>
        );
      case 'taken':
      case 'invalid':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            {status === 'taken' ? 'Taken' : 'Invalid'}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const fullUrl = `${siteUrl}${basePath}${slug || 'your-post-slug'}`;
  const isSlugEmpty = !slug.trim();

  return (
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Link2 className="w-4 h-4" />
          URL Slug
        </label>
        {renderStatusBadge()}
      </div>

      {/* URL preview bar */}
      <div
        className={`flex items-center rounded-lg border transition-colors ${
          status === 'taken' || status === 'invalid'
            ? 'border-amber-300 bg-amber-50/50'
            : status === 'available'
            ? 'border-green-300 bg-green-50/30'
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        <span className="shrink-0 px-3 py-2 text-sm text-gray-500 select-none border-r border-gray-200">
          {basePath}
        </span>

        {isEditing ? (
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            onBlur={() => {
              if (!slug.trim()) setIsEditing(false);
            }}
            autoFocus
            className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
            placeholder="enter-slug-here"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex-1 px-3 py-2 text-left text-sm text-gray-900 hover:bg-white/60 transition-colors truncate"
            title="Click to edit slug"
          >
            {slug || (
              <span className="text-gray-400 italic">auto-generated from title</span>
            )}
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 px-1">
          {!compact && slug && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title={copied ? 'Copied!' : 'Copy full URL'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={handleRegenerateFromTitle}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Regenerate from title"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Full URL preview */}
      {!compact && (
        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
          <Globe className="w-3 h-3 shrink-0" />
          <span className="truncate">{fullUrl}</span>
          {slug && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary-600 hover:text-primary-700"
              title="Open in new tab (may 404 for drafts)"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-amber-700 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Suggestion */}
      {suggestion && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="flex-1 text-xs text-blue-700">
            Suggested: <span className="font-mono font-medium">{suggestion}</span>
          </p>
          <button
            type="button"
            onClick={handleAcceptSuggestion}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Use this
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CLIENT-SIDE FALLBACK SLUGIFY
// ============================================================================

function clientSlugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // remove non-word chars (except spaces & hyphens)
    .replace(/[\s_]+/g, '-')    // spaces & underscores → hyphens
    .replace(/-+/g, '-')        // collapse consecutive hyphens
    .replace(/^-|-$/g, '')      // trim leading/trailing hyphens
    .slice(0, 60);              // enforce max length
}
