'use client';

import { Link2, Sparkles } from 'lucide-react';

export interface InternalLinkSuggestion {
  anchorText: string;
  href: string;
}

interface InternalLinkSuggestionPanelProps {
  suggestions: InternalLinkSuggestion[];
  selectedBlockLabel?: string;
  canInsert: boolean;
  onInsert: (suggestion: InternalLinkSuggestion) => void;
  highlightTerms?: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, terms: string[]): Array<{ text: string; highlighted: boolean }> {
  const normalizedTerms = terms
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 6);

  if (normalizedTerms.length === 0) {
    return [{ text, highlighted: false }];
  }

  const pattern = normalizedTerms.map((term) => escapeRegExp(term)).join('|');
  const regex = new RegExp(`(${pattern})`, 'ig');
  const parts = text.split(regex);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: regex.test(part),
    }));
}

export function InternalLinkSuggestionPanel({
  suggestions,
  selectedBlockLabel,
  canInsert,
  onInsert,
  highlightTerms = [],
}: InternalLinkSuggestionPanelProps) {
  return (
    <aside className="bg-white border border-gray-200 rounded-xl p-4 lg:sticky lg:top-20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Internal Link Suggestions</h3>
      </div>

      <p className="text-xs text-gray-600 mb-4">
        {canInsert
          ? `Insert links into ${selectedBlockLabel || 'selected block'} with one click.`
          : 'Select a paragraph or heading block to enable one-click insertion.'}
      </p>

      <div className="space-y-2">
        {suggestions.length === 0 && (
          <div className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg p-3">
            No suggestions available yet.
          </div>
        )}

        {suggestions.map((suggestion) => {
          const chunks = highlightText(suggestion.anchorText, highlightTerms);

          return (
            <button
              key={suggestion.href}
              onClick={() => onInsert(suggestion)}
              disabled={!canInsert}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title={canInsert ? 'Insert into selected block' : 'Select a compatible block first'}
            >
              <div className="flex items-start gap-2">
                <Link2 className="w-4 h-4 text-primary-600 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {chunks.map((chunk, index) =>
                      chunk.highlighted ? (
                        <mark key={`${suggestion.href}-${index}`} className="bg-yellow-200 text-gray-900 rounded px-0.5">
                          {chunk.text}
                        </mark>
                      ) : (
                        <span key={`${suggestion.href}-${index}`}>{chunk.text}</span>
                      )
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-1">{suggestion.href}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
