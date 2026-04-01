'use client';

import { useRef, useEffect, useState } from 'react';
import { HeadingBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';
import { ChevronDown } from 'lucide-react';

interface HeadingBlockProps {
  block: ContentBlock & { data: HeadingBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function HeadingBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: HeadingBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const handleChange = (text: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, text }
      }
    });
  };

  const handleLevelChange = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, level }
      }
    });
    setShowLevelMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Create new paragraph block
      onAction({ 
        type: 'ADD_BLOCK_AFTER', 
        payload: { 
          afterId: block.id,
          block: {
            id: crypto.randomUUID(),
            type: 'paragraph' as any,
            data: { text: '' },
            position: block.position + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }
      });
    } else if (e.key === 'Backspace' && block.data.text === '' && state.content.blocks.length > 1) {
      e.preventDefault();
      onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
    }
  };

  const getHeadingStyles = () => {
    const baseStyles = "font-bold text-gray-900 leading-tight";
    switch (block.data.level) {
      case 1: return `${baseStyles} text-4xl`;
      case 2: return `${baseStyles} text-3xl`;
      case 3: return `${baseStyles} text-2xl`;
      case 4: return `${baseStyles} text-xl`;
      case 5: return `${baseStyles} text-lg`;
      case 6: return `${baseStyles} text-base`;
      default: return `${baseStyles} text-2xl`;
    }
  };

  if (readonly) {
    const Tag = `h${block.data.level}` as keyof JSX.IntrinsicElements;
    return (
      <div className="prose prose-lg max-w-none">
        <Tag className={getHeadingStyles()}>
          {block.data.text || <span className="text-gray-400 italic">Empty heading</span>}
        </Tag>
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
      <div className="flex items-center gap-2 group">
        {/* Heading Level Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLevelMenu(!showLevelMenu)}
            className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            H{block.data.level}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showLevelMenu && (
            <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <button
                  key={level}
                  onClick={() => handleLevelChange(level as 1 | 2 | 3 | 4 | 5 | 6)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    block.data.level === level ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <span className="font-bold">H{level}</span>
                  <span className="ml-2 text-gray-500">
                    {level === 1 && 'Title'}
                    {level === 2 && 'Section'}
                    {level === 3 && 'Subsection'}
                    {level === 4 && 'Paragraph'}
                    {level === 5 && 'Small'}
                    {level === 6 && 'Tiny'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Heading Input */}
        <input
          ref={inputRef}
          type="text"
          value={block.data.text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => onAction({ type: 'FOCUS_BLOCK', payload: { id: block.id } })}
          placeholder={`Heading ${block.data.level}`}
          className={`flex-1 bg-transparent border-none outline-none resize-none placeholder-gray-400 ${getHeadingStyles()}`}
        />
      </div>
    </BlockWrapper>
  );
}