'use client';

import { useRef, useEffect } from 'react';
import { ParagraphBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface ParagraphBlockProps {
  block: ContentBlock & { data: ParagraphBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function ParagraphBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: ParagraphBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
      // Position cursor at end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isFocused]);

  const handleChange = (value: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { text: value }
      }
    });
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

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
          {block.data.text || <span className="text-gray-400 italic">Empty paragraph</span>}
        </p>
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
      <textarea
        ref={textareaRef}
        value={block.data.text}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => onAction({ type: 'FOCUS_BLOCK', payload: { id: block.id } })}
        placeholder="Type / for commands, or start writing..."
        className="w-full bg-transparent border-none outline-none resize-none text-gray-900 leading-relaxed placeholder-gray-400 text-base min-h-[1.5rem]"
        style={{ 
          minHeight: '1.5rem',
          maxHeight: '400px'
        }}
        onInput={(e) => {
          // Auto-resize textarea
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${target.scrollHeight}px`;
        }}
      />
    </BlockWrapper>
  );
}