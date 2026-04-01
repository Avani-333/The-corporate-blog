'use client';

import { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { FAQBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface FAQBlockProps {
  block: ContentBlock & { data: FAQBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function FAQBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: FAQBlockProps) {
  // openItems is only used for the editor (non-readonly) view
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  // Initialize with one FAQ item if empty
  if (!block.data.items || block.data.items.length === 0) {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: {
          ...block.data,
          items: [{
            id: crypto.randomUUID(),
            question: '',
            answer: ''
          }]
        }
      }
    });
    return null;
  }

  const toggleItem = (itemId: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(itemId)) {
      newOpenItems.delete(itemId);
    } else {
      newOpenItems.add(itemId);
    }
    setOpenItems(newOpenItems);
  };

  const updateItem = (itemId: string, field: 'question' | 'answer', value: string) => {
    const newItems = block.data.items.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    );
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, items: newItems }
      }
    });
  };

  const addItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      question: '',
      answer: ''
    };
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: {
          ...block.data,
          items: [...block.data.items, newItem]
        }
      }
    });
  };

  const removeItem = (itemId: string) => {
    if (block.data.items.length === 1) {
      onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
      return;
    }
    
    const newItems = block.data.items.filter(item => item.id !== itemId);
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, items: newItems }
      }
    });
  };

  if (readonly) {
    // Use native <details>/<summary> for zero-CLS collapsible FAQ.
    // The browser handles open/close state natively — no JS toggle needed,
    // no hydration mismatch, and the initial closed state is painted before
    // any JavaScript executes, so there is no layout shift.
    return (
      <div className="not-prose space-y-3 my-6">
        {block.data.items.map((item) => (
          <details
            key={item.id}
            className="group border border-gray-200 rounded-lg overflow-hidden bg-white"
          >
            {/*
              list-none + [&::-webkit-details-marker]:hidden removes the
              default browser triangle so we can use our own ChevronDown icon.
            */}
            <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer
                                 select-none hover:bg-gray-50 transition-colors
                                 list-none [&::-webkit-details-marker]:hidden">
              <span className="font-medium text-gray-900 leading-snug">
                {item.question || <span className="text-gray-400 italic">Empty question</span>}
              </span>
              {/* Rotates 180° when <details> is open via Tailwind group-open variant */}
              <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0
                                      transition-transform duration-200 ease-in-out
                                      group-open:rotate-180" />
            </summary>

            {/*
              Grid-rows trick: 0fr → 1fr animates height from 0 to auto-height
              without CLS because the collapsed state is rendered at 0-height
              by the browser before paint.
            */}
            <div className="grid grid-rows-[0fr] group-open:grid-rows-[1fr]
                            transition-[grid-template-rows] duration-200 ease-in-out">
              <div className="overflow-hidden">
                <div className="px-5 pb-5 text-gray-700 leading-relaxed border-t border-gray-100 pt-4">
                  {item.answer || <span className="text-gray-400 italic">Empty answer</span>}
                </div>
              </div>
            </div>
          </details>
        ))}
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
      <div className="space-y-3">
        {block.data.items.map((item, index) => (
          <div key={item.id} className="border border-gray-200 rounded-lg group">
            {/* Question */}
            <div className="flex items-center gap-2 p-4">
              <input
                type="text"
                value={item.question}
                onChange={(e) => updateItem(item.id, 'question', e.target.value)}
                placeholder={`Question ${index + 1}`}
                className="flex-1 bg-transparent border-none outline-none font-medium text-gray-900 placeholder-gray-400 focus:text-gray-900"
              />
              
              <button
                onClick={() => toggleItem(item.id)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronDown 
                  className={`w-4 h-4 transition-transform ${
                    openItems.has(item.id) ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              <button
                onClick={() => removeItem(item.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Answer */}
            {(openItems.has(item.id) || (!readonly && (item.answer || isSelected))) && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <textarea
                  value={item.answer}
                  onChange={(e) => updateItem(item.id, 'answer', e.target.value)}
                  placeholder="Enter the answer..."
                  className="w-full bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[3rem] leading-relaxed"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Add FAQ Item */}
        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add FAQ Item
        </button>
      </div>
    </BlockWrapper>
  );
}