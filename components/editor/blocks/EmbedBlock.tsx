'use client';

import { useState } from 'react';
import { Play, ExternalLink, Settings } from 'lucide-react';
import { EmbedBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface EmbedBlockProps {
  block: ContentBlock & { data: EmbedBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function EmbedBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: EmbedBlockProps) {
  const [tempUrl, setTempUrl] = useState(block.data.url || '');
  const [showSettings, setShowSettings] = useState(false);

  const handleUrlSubmit = () => {
    if (tempUrl) {
      onAction({
        type: 'UPDATE_BLOCK',
        payload: {
          id: block.id,
          data: {
            ...block.data,
            url: tempUrl,
            provider: detectProvider(tempUrl)
          }
        }
      });
    }
  };

  const detectProvider = (url: string): string => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('codepen.io')) return 'codepen';
    return 'generic';
  };

  const getEmbedHtml = () => {
    if (!block.data.url) return '';

    // For demo purposes - in production, use oEmbed API
    if (block.data.provider === 'youtube') {
      const videoId = extractYouTubeId(block.data.url);
      if (videoId) {
        return `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      }
    }

    return `<iframe src="${block.data.url}" width="100%" height="400" frameborder="0"></iframe>`;
  };

  const extractYouTubeId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  if (readonly) {
    if (!block.data.url) {
      return (
        <div className="prose prose-lg max-w-none">
          <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
            <Play className="w-8 h-8 mx-auto mb-2" />
            <p>Embed content not available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="prose prose-lg max-w-none">
        <div className="bg-gray-50 rounded-lg p-1">
          <div 
            className="w-full rounded overflow-hidden"
            dangerouslySetInnerHTML={{ __html: getEmbedHtml() }}
          />
          {block.data.caption && (
            <p className="text-center text-gray-600 mt-2 text-sm">
              {block.data.caption}
            </p>
          )}
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
        {!block.data.url ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50 transition-all duration-200">
            <Play className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Embed Content</h3>
            <p className="text-gray-500 mb-6">Add YouTube, Twitter, Instagram, or any embed URL</p>
            
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="url"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUrlSubmit();
                  }
                }}
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!tempUrl}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Embed
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Embed Preview */}
            <div className="relative group bg-gray-50 rounded-lg p-1">
              <div 
                className="w-full rounded overflow-hidden"
                dangerouslySetInnerHTML={{ __html: getEmbedHtml() }}
              />
              
              {/* Embed Actions Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(block.data.url, '_blank')}
                    className="px-3 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Original
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Embed URL
                  </label>
                  <input
                    type="url"
                    value={block.data.url}
                    onChange={(e) => onAction({
                      type: 'UPDATE_BLOCK',
                      payload: {
                        id: block.id,
                        data: { ...block.data, url: e.target.value, provider: detectProvider(e.target.value) }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            {/* Caption */}
            <input
              type="text"
              value={block.data.caption || ''}
              onChange={(e) => onAction({
                type: 'UPDATE_BLOCK',
                payload: {
                  id: block.id,
                  data: { ...block.data, caption: e.target.value }
                }
              })}
              placeholder="Add a caption (optional)"
              className="w-full px-0 py-2 text-center text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 text-sm focus:text-gray-900"
            />
          </div>
        )}
      </div>
    </BlockWrapper>
  );
}