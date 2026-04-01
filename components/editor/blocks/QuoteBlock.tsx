'use client';

import { useRef, useEffect } from 'react';
import { QuoteBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';
import { Quote } from 'lucide-react';

interface QuoteBlockProps {
  block: ContentBlock & { data: QuoteBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function QuoteBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: QuoteBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFocused]);

  const handleTextChange = (text: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, text }
      }
    });
  };

  const handleAuthorChange = (author: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, author }
      }
    });
  };

  const handleCitationChange = (citation: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, citation }
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // Focus author field or create new paragraph
      if (authorRef.current) {
        authorRef.current.focus();
      }
    } else if (e.key === 'Backspace' && block.data.text === '' && !block.data.author && state.content.blocks.length > 1) {
      e.preventDefault();
      onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
    }
  };

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        <blockquote className="border-l-4 border-primary-500 pl-6 py-4 bg-gray-50 rounded-r-lg">
          <div className="text-lg text-gray-900 italic font-medium leading-relaxed">
            {block.data.text || <span className="text-gray-400 not-italic">Empty quote</span>}
          </div>
          {(block.data.author || block.data.citation) && (
            <footer className="mt-3 text-gray-600">
              {block.data.author && (
                <span className="font-semibold">— {block.data.author}</span>
              )}
              {block.data.citation && (
                <cite className={`${block.data.author ? 'ml-2' : ''} text-sm`}>
                  {block.data.citation}
                </cite>
              )}
            </footer>
          )}
        </blockquote>
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
      <div className="border-l-4 border-primary-500 pl-6 py-4 bg-gray-50 rounded-r-lg">
        {/* Quote Icon */}
        <div className="flex items-start gap-3">
          <Quote className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
          
          <div className="flex-1 space-y-3">
            {/* Quote Text */}
            <textarea
              ref={textareaRef}
              value={block.data.text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => onAction({ type: 'FOCUS_BLOCK', payload: { id: block.id } })}
              placeholder="Enter a quote..."
              className="w-full bg-transparent border-none outline-none resize-none text-lg text-gray-900 placeholder-gray-400 font-medium leading-relaxed italic min-h-[2rem]"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />

            {/* Author and Citation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 font-medium">—</span>
                <input
                  ref={authorRef}
                  type="text"
                  value={block.data.author || ''}
                  onChange={(e) => handleAuthorChange(e.target.value)}
                  placeholder="Author name (optional)"
                  className="flex-1 bg-transparent border-none outline-none text-gray-600 placeholder-gray-400 font-semibold focus:text-gray-900"
                />
              </div>
              
              <input
                type="text"
                value={block.data.citation || ''}
                onChange={(e) => handleCitationChange(e.target.value)}
                placeholder="Source or citation (optional)"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-600 placeholder-gray-400 focus:text-gray-900"
              />
            </div>
          </div>
        </div>
      </div>
    </BlockWrapper>
  );
}