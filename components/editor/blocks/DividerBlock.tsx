'use client';

import { DividerBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';
import { Minus, MoreHorizontal, Sparkles } from 'lucide-react';

interface DividerBlockProps {
  block: ContentBlock & { data: DividerBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function DividerBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: DividerBlockProps) {
  const handleStyleChange = (style: 'line' | 'dots' | 'asterisks') => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, style }
      }
    });
  };

  const renderDivider = () => {
    switch (block.data.style) {
      case 'dots':
        return (
          <div className="flex justify-center items-center space-x-2 py-8">
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          </div>
        );
      case 'asterisks':
        return (
          <div className="text-center py-8 text-gray-400 text-2xl font-light tracking-widest">
            * * *
          </div>
        );
      default:
        return (
          <div className="py-8">
            <hr className="border-gray-300" />
          </div>
        );
    }
  };

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        {renderDivider()}
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
      <div className="group">
        {renderDivider()}
        
        {/* Style Options (shown when selected) */}
        {isSelected && (
          <div className="flex justify-center -mt-4 mb-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
              <span className="text-xs text-gray-500 font-medium px-2">Style:</span>
              
              <button
                onClick={() => handleStyleChange('line')}
                className={`p-2 rounded transition-colors ${
                  block.data.style === 'line' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Line"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleStyleChange('dots')}
                className={`p-2 rounded transition-colors ${
                  block.data.style === 'dots' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Dots"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleStyleChange('asterisks')}
                className={`p-2 rounded transition-colors ${
                  block.data.style === 'asterisks' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Asterisks"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
}