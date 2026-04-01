'use client';

import { useState } from 'react';
import { AlertCircle, Link as LinkIcon, Copy, Check } from 'lucide-react';

interface SponsorshipPanelProps {
  isSponsored: boolean;
  affiliateLinkVia: string | null;
  enforceDisclosureBanner: boolean;
  highlightAffiliateLinks: boolean;
  onToggleSponsored: (value: boolean) => void;
  onAffiliateLinkChange: (value: string) => void;
  onToggleDisclosureBanner: (value: boolean) => void;
  onToggleHighlightLinks: (value: boolean) => void;
  postSlug: string;
}

/**
 * Sponsorship Panel for CMS Editor
 *
 * Allows editors to:
 * - Mark posts as sponsored
 * - Add/manage affiliate links
 * - Enforce disclosure banner
 * - Highlight affiliate links in content
 *
 * Usage:
 * ```tsx
 * <SponsorshipPanel
 *   isSponsored={post.is_sponsored}
 *   affiliateLinkVia={post.affiliateLinkVia}
 *   enforceDisclosureBanner={post.enforceDisclosureBanner}
 *   highlightAffiliateLinks={post.highlightAffiliateLinks}
 *   onToggleSponsored={...}
 *   onAffiliateLinkChange={...}
 *   onToggleDisclosureBanner={...}
 *   onToggleHighlightLinks={...}
 *   postSlug={post.slug}
 * />
 * ```
 */
export function SponsorshipPanel({
  isSponsored,
  affiliateLinkVia,
  enforceDisclosureBanner,
  highlightAffiliateLinks,
  onToggleSponsored,
  onAffiliateLinkChange,
  onToggleDisclosureBanner,
  onToggleHighlightLinks,
  postSlug,
}: SponsorshipPanelProps) {
  const [copied, setCopied] = useState(false);

  // Get redirect URL
  const redirectUrl = postSlug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/r/${postSlug}` : '';

  const handleCopyRedirectUrl = () => {
    if (redirectUrl) {
      navigator.clipboard.writeText(redirectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Toggle: Mark as Sponsored */}
      <div className="border-b pb-6">
        <div className="flex items-start justify-between">
          <div>
            <label className="flex items-center cursor-pointer">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">📌 Sponsored Post</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Mark this post as sponsored content with affiliate tracking
                </p>
              </div>
            </label>
          </div>
          <button
            onClick={() => onToggleSponsored(!isSponsored)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isSponsored ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={isSponsored}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSponsored ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Sponsorship Info */}
        {isSponsored && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
            <p className="font-medium">✓ Post is marked as sponsored</p>
            <p>Click tracking via: <code className="bg-blue-100 px-2 py-1 rounded text-xs">/api/r/{postSlug}</code></p>
          </div>
        )}
      </div>

      {/* Conditional Sections (Only show if sponsored) */}
      {isSponsored && (
        <>
          {/* Affiliate Link */}
          <div className="border-b pb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <LinkIcon className="w-4 h-4 inline mr-2" />
              Affiliate Link
            </label>
            <p className="text-xs text-gray-600 mb-3">
              The URL to redirect when users click the sponsor CTA or affiliate link
            </p>
            <input
              type="url"
              value={affiliateLinkVia || ''}
              onChange={(e) => onAffiliateLinkChange(e.target.value)}
              placeholder="https://example.com/affiliate?id=123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Redirect URL */}
            {postSlug && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">Redirect endpoint:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white px-2 py-1.5 border border-gray-200 rounded text-gray-900 break-all">
                    /api/r/{postSlug}
                  </code>
                  <button
                    onClick={handleCopyRedirectUrl}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    title="Copy redirect URL"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {!affiliateLinkVia && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>⚠️ No affiliate link configured. Users will see an error if they click.</span>
              </div>
            )}
          </div>

          {/* Enforce Disclosure Banner */}
          <div className="border-b pb-6">
            <div className="flex items-start justify-between mb-2">
              <label className="flex-1 cursor-pointer">
                <h4 className="text-sm font-medium text-gray-900">Enforce Disclosure Banner</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Always show the sponsored disclosure at the top of the post
                </p>
              </label>
              <button
                onClick={() => onToggleDisclosureBanner(!enforceDisclosureBanner)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  enforceDisclosureBanner ? 'bg-green-600' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={enforceDisclosureBanner}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enforceDisclosureBanner ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2">
              <p className="text-gray-700">
                {enforceDisclosureBanner ? (
                  <>✓ Banner will be displayed at post start</>
                ) : (
                  <>📌 Banner will only show if toggled in post content</>
                )}
              </p>
              <p className="text-gray-600">
                The banner displays: "📌 Sponsored" with a "Learn More" button
              </p>
            </div>
          </div>

          {/* Highlight Affiliate Links */}
          <div className="pb-6">
            <div className="flex items-start justify-between mb-2">
              <label className="flex-1 cursor-pointer">
                <h4 className="text-sm font-medium text-gray-900">Highlight Affiliate Links</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Visually distinguish affiliate links with a badge in the post
                </p>
              </label>
              <button
                onClick={() => onToggleHighlightLinks(!highlightAffiliateLinks)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  highlightAffiliateLinks ? 'bg-amber-600' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={highlightAffiliateLinks}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    highlightAffiliateLinks ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2">
              <p className="text-gray-700">
                {highlightAffiliateLinks ? (
                  <>✓ Affiliate links will display with a visual badge</>
                ) : (
                  <>Links will appear as regular hyperlinks</>
                )}
              </p>
              <p className="text-gray-600">
                Example: <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-300">
                  Link <span className="inline-block px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">affiliate</span>
                </span>
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Sponsorship Configuration</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✓ Post is marked as <strong>sponsored</strong></li>
              <li>✓ Affiliate link: <code className="bg-white px-1 rounded text-xs">{affiliateLinkVia ? '✓ Set' : '✗ Not set'}</code></li>
              <li>✓ Disclosure banner: <code className="bg-white px-1 rounded text-xs">{enforceDisclosureBanner ? '✓ Enforced' : '○ Optional'}</code></li>
              <li>✓ Link highlighting: <code className="bg-white px-1 rounded text-xs">{highlightAffiliateLinks ? '✓ Enabled' : '✗ Disabled'}</code></li>
            </ul>
          </div>
        </>
      )}

      {/* Empty State */}
      {!isSponsored && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-sm text-gray-600">
            Enable "Sponsored Post" above to configure affiliate tracking and disclosure
          </p>
        </div>
      )}
    </div>
  );
}
