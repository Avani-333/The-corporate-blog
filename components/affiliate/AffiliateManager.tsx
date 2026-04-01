'use client';

import { useState } from 'react';
import { useCallback } from 'react';

interface AffiliateManageProps {
  postSlug: string;
  currentLink?: string | null;
  isSponsored?: boolean;
}

/**
 * Affiliate Link Manager Component
 *
 * For admin/editor dashboard to:
 * - Mark/unmark posts as sponsored
 * - Add/update/remove affiliate links
 * - View click statistics
 *
 * Usage:
 * ```tsx
 * <AffiliateManager postSlug="my-post" currentLink={post.affiliateLinkVia} isSponsored={post.is_sponsored} />
 * ```
 */
export function AffiliateManager({
  postSlug,
  currentLink = null,
  isSponsored = false,
}: AffiliateManageProps) {
  const [isSponsored_, setIsSponsored] = useState(isSponsored);
  const [affiliateLink, setAffiliateLink] = useState(currentLink || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);

  const handleMark = useCallback(async () => {
    if (!affiliateLink.trim()) {
      setError('Please enter an affiliate link');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/affiliate/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark',
          slug: postSlug,
          affiliateLinkVia: affiliateLink,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to mark post as sponsored');
        return;
      }

      setSuccess(data.message);
      setIsSponsored(true);
    } catch (err) {
      setError('Failed to mark post as sponsored');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [affiliateLink, postSlug]);

  const handleUnmark = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/affiliate/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unmark',
          slug: postSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to unmark post');
        return;
      }

      setSuccess(data.message);
      setIsSponsored(false);
      setAffiliateLink('');
    } catch (err) {
      setError('Failed to unmark post');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [postSlug]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/affiliate/stats?slug=${postSlug}&recentDetails=true`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch statistics');
        return;
      }

      setStats(data.data);
    } catch (err) {
      setError('Failed to fetch statistics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [postSlug]);

  const handleViewStats = useCallback(() => {
    if (!showStats) {
      fetchStats();
    }
    setShowStats(!showStats);
  }, [showStats, fetchStats]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Affiliate Management</h3>

        {/* Affiliate Link Input */}
        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Affiliate Link URL
          </label>
          <input
            type="url"
            value={affiliateLink}
            onChange={(e) => setAffiliateLink(e.target.value)}
            placeholder="https://example.com/affiliate?id=123"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || isSponsored_}
          />
          <p className="text-xs text-gray-500">
            Can be updated later. Include UTM parameters if desired.
          </p>
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          {isSponsored_ ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              ✓ Marked as Sponsored
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              Not Sponsored
            </span>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✓ {success}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isSponsored_ ? (
            <button
              onClick={handleMark}
              disabled={isLoading || !affiliateLink.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Processing...' : 'Mark as Sponsored'}
            </button>
          ) : (
            <button
              onClick={handleUnmark}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Processing...' : 'Unmark as Sponsored'}
            </button>
          )}

          {isSponsored_ && (
            <button
              onClick={handleViewStats}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {showStats ? 'Hide' : 'View'} Stats
            </button>
          )}
        </div>
      </div>

      {/* Statistics */}
      {showStats && stats && (
        <div className="border-t pt-6 space-y-4">
          <h4 className="font-semibold text-gray-900">Click Statistics</h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalClicks || 0}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Unique Visitors</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.uniqueVisitors || 0}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Last 7 Days</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.clicksLast7Days || 0}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Avg per Day</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.averageClicksPerDay || 0}
              </p>
            </div>
          </div>

          {/* Breakdown Tables */}
          {Object.keys(stats.clicksByDevice || {}).length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-gray-900 mb-2">By Device</h5>
              <div className="space-y-1">
                {Object.entries(stats.clicksByDevice).map(([device, count]) => (
                  <div key={device} className="flex justify-between text-sm">
                    <span className="text-gray-600">{device}</span>
                    <span className="font-medium text-gray-900">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(stats.clicksByCountry || {}).length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-gray-900 mb-2">Top Countries</h5>
              <div className="space-y-1">
                {Object.entries(stats.clicksByCountry)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 5)
                  .map(([country, count]) => (
                    <div key={country} className="flex justify-between text-sm">
                      <span className="text-gray-600">{country}</span>
                      <span className="font-medium text-gray-900">{count as number}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
