'use client';

import { useRef, useEffect, useState } from 'react';
import { ListBlockData, ContentBlock, BlockType } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';
import { MoreVertical, Plus, X } from 'lucide-react';

interface ListBlockProps {
  block: ContentBlock & { data: ListBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function ListBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: ListBlockProps) {
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    if (focusedItemIndex !== null && itemRefs.current[focusedItemIndex]) {
      itemRefs.current[focusedItemIndex]?.focus();
    }
  }, [focusedItemIndex]);

  const handleItemChange = (index: number, text: string) => {
    const newItems = [...block.data.items];
    newItems[index] = { ...newItems[index], text };
    
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, items: newItems }
      }
    });
  };

  const handleAddItem = (index?: number) => {
    const newItems = [...block.data.items];
    const insertIndex = index !== undefined ? index + 1 : newItems.length;
    
    newItems.splice(insertIndex, 0, {
      id: crypto.randomUUID(),
      text: '',
      checked: block.type === BlockType.LIST ? block.data.items[0]?.checked : undefined
    });
    
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, items: newItems }
      }
    });
    
    // Focus the new item
    setTimeout(() => setFocusedItemIndex(insertIndex), 50);
  };

  const handleDeleteItem = (index: number) => {
    if (block.data.items.length === 1) {
      // Delete the entire block if it's the last item
      onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
      return;
    }
    
    const newItems = block.data.items.filter((_, i) => i !== index);
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, items: newItems }
      }
    });
    
    // Focus previous item or next item
    const newFocusIndex = index > 0 ? index - 1 : 0;
    setFocusedItemIndex(newFocusIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem(index);
    } else if (e.key === 'Backspace' && block.data.items[index].text === '') {
      e.preventDefault();
      handleDeleteItem(index);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      setFocusedItemIndex(index - 1);
    } else if (e.key === 'ArrowDown' && index < block.data.items.length - 1) {
      e.preventDefault();
      setFocusedItemIndex(index + 1);
    }
  };

  const handleCheckboxChange = (index: number, checked: boolean) => {
    const newItems = [...block.data.items];
    newItems[index] = { ...newItems[index], checked };
    
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, items: newItems }
      }
    });
  };

  const isCheckList = block.data.items.some(item => item.checked !== undefined);
  const isOrdered = block.type === BlockType.ORDERED_LIST;

  if (readonly) {
    if (isCheckList) {
      return (
        <div className="prose prose-lg max-w-none">
          <ul className="space-y-2">
            {block.data.items.map((item, index) => (
              <li key={item.id} className="flex items-start gap-3 list-none">
                <input
                  type="checkbox"
                  checked={item.checked || false}
                  readOnly
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className={item.checked ? 'line-through text-gray-500' : 'text-gray-900'}>
                  {item.text || <span className="text-gray-400 italic">Empty item</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    const Tag = isOrdered ? 'ol' : 'ul';
    return (
      <div className="prose prose-lg max-w-none">
        <Tag className={isOrdered ? 'list-decimal list-inside space-y-1' : 'list-disc list-inside space-y-1'}>
          {block.data.items.map((item, index) => (
            <li key={item.id} className="text-gray-900">
              {item.text || <span className="text-gray-400 italic">Empty item</span>}
            </li>
          ))}
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
      <div className="space-y-2">
        {block.data.items.map((item, index) => (
          <div key={item.id} className="flex items-start gap-3 group">
            {/* List Marker */}
            <div className="flex-shrink-0 pt-2">
              {isCheckList ? (
                <input
                  type="checkbox"
                  checked={item.checked || false}
                  onChange={(e) => handleCheckboxChange(index, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              ) : isOrdered ? (
                <span className="text-gray-500 font-medium min-w-[1.5rem] text-right">
                  {index + 1}.
                </span>
              ) : (
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
              )}
            </div>

            {/* Item Content */}
            <div className="flex-1 min-w-0">
              <textarea
                ref={(el) => (itemRefs.current[index] = el)}
                value={item.text}
                onChange={(e) => handleItemChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={() => {
                  setFocusedItemIndex(index);
                  onAction({ type: 'FOCUS_BLOCK', payload: { id: block.id } });
                }}
                placeholder={`List item ${index + 1}`}
                className={`w-full bg-transparent border-none outline-none resize-none text-gray-900 placeholder-gray-400 text-base min-h-[1.5rem] ${
                  item.checked ? 'line-through text-gray-500' : ''
                }`}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>

            {/* Item Actions */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleAddItem(index)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Add item"
              >
                <Plus className="w-4 h-4" />
              </button>
              {block.data.items.length > 1 && (
                <button
                  onClick={() => handleDeleteItem(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete item"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add New Item Button */}
        <button
          onClick={() => handleAddItem()}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>
    </BlockWrapper>
  );
}