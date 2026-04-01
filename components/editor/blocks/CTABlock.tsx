'use client';

import { useState } from 'react';
import { ExternalLink, Settings } from 'lucide-react';
import { CTABlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface CTABlockProps {
  block: ContentBlock & { data: CTABlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function CTABlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: CTABlockProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleUpdate = (field: keyof CTABlockData, value: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, [field]: value }
      }
    });
  };

  const getButtonStyles = () => {
    const style = block.data.style || 'primary';
    const size = block.data.size || 'medium';

    const styleClasses = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 border-primary-600',
      secondary: 'bg-white text-gray-900 hover:bg-gray-50 border-gray-300',
      outline: 'bg-transparent text-primary-600 hover:bg-primary-50 border-primary-600'
    };

    const sizeClasses = {
      small: 'px-4 py-2 text-sm',
      medium: 'px-6 py-3 text-base',
      large: 'px-8 py-4 text-lg'
    };

    return `${styleClasses[style]} ${sizeClasses[size]} border rounded-lg font-medium transition-all duration-200 inline-flex items-center gap-2`;
  };

  const getAlignment = () => {
    const alignment = block.data.alignment || 'center';
    return {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right'
    }[alignment];
  };

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        <div className={`py-6 ${getAlignment()}`}>
          {block.data.title && (
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {block.data.title}
            </h3>
          )}
          {block.data.description && (
            <p className="text-gray-600 mb-4">
              {block.data.description}
            </p>
          )}
          <a
            href={block.data.url || '#'}
            target={block.data.openInNewTab ? '_blank' : '_self'}
            rel={block.data.openInNewTab ? 'noopener noreferrer' : undefined}
            className={getButtonStyles()}
          >
            {block.data.buttonText || 'Click Here'}
            {block.data.openInNewTab && <ExternalLink className="w-4 h-4" />}
          </a>
        </div>
      </div>
    );
  }

  return (
    <BlockWrapper
      block={block}
      isSelected={isSelected}
      isFocused={isFocused}
      onAction={onAction}
    >
      <div className="space-y-4">
        <div className={`py-6 px-4 bg-gray-50 rounded-lg ${getAlignment()}`}>
          {/* Title */}
          <input
            type="text"
            value={block.data.title || ''}
            onChange={(e) => handleUpdate('title', e.target.value)}
            placeholder="Add a compelling title..."
            className="w-full bg-transparent border-none outline-none text-xl font-bold text-gray-900 placeholder-gray-400 text-center mb-2"
          />

          {/* Description */}
          <textarea
            value={block.data.description || ''}
            onChange={(e) => handleUpdate('description', e.target.value)}
            placeholder="Add a description to explain your offer..."
            className="w-full bg-transparent border-none outline-none text-gray-600 placeholder-gray-400 text-center resize-none mb-4 leading-relaxed"
            rows={2}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />

          {/* Button */}
          <div className="inline-block">
            <input
              type="text"
              value={block.data.buttonText || ''}
              onChange={(e) => handleUpdate('buttonText', e.target.value)}
              placeholder="Button text"
              className={`${getButtonStyles()} bg-opacity-90 placeholder-opacity-60 text-center min-w-[120px]`}
            />
          </div>
        </div>

        {/* Settings Panel */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            <Settings className="w-3 h-3" />
            Settings
          </button>
        </div>

        {showSettings && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Button URL
                </label>
                <input
                  type="url"
                  value={block.data.url || ''}
                  onChange={(e) => handleUpdate('url', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Button Style
                </label>
                <select
                  value={block.data.style || 'primary'}
                  onChange={(e) => handleUpdate('style', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="outline">Outline</option>
                </select>
              </div>

              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Button Size
                </label>
                <select
                  value={block.data.size || 'medium'}
                  onChange={(e) => handleUpdate('size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              {/* Alignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alignment
                </label>
                <select
                  value={block.data.alignment || 'center'}
                  onChange={(e) => handleUpdate('alignment', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            {/* Open in New Tab */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={block.data.openInNewTab || false}
                onChange={(e) => handleUpdate('openInNewTab', e.target.checked.toString())}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Open link in new tab</span>
            </label>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
}