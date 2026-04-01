'use client';

import { useState, useRef } from 'react';
import { MoreVertical, Copy, Trash2, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { ContentBlock } from '@/types/blocks';
import { EditorAction } from '@/lib/editor-state';

interface BlockWrapperProps {
  block: ContentBlock;
  children: React.ReactNode;
  isSelected?: boolean;
  isFocused?: boolean;
  onAction: (action: EditorAction) => void;
  showActions?: boolean;
}

export function BlockWrapper({ 
  block, 
  children, 
  isSelected = false, 
  isFocused = false,
  onAction,
  showActions = true
}: BlockWrapperProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    onAction({ type: 'COPY_BLOCK', payload: { id: block.id } });
    setShowMenu(false);
  };

  const handleDelete = () => {
    onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
    setShowMenu(false);
  };

  const handleMoveUp = () => {
    onAction({ type: 'MOVE_BLOCK_UP', payload: { id: block.id } });
    setShowMenu(false);
  };

  const handleMoveDown = () => {
    onAction({ type: 'MOVE_BLOCK_DOWN', payload: { id: block.id } });
    setShowMenu(false);
  };

  const handleSettings = () => {
    onAction({ type: 'OPEN_BLOCK_SETTINGS', payload: { id: block.id } });
    setShowMenu(false);
  };

  return (
    <div 
      className={`relative group ${
        isSelected ? 'ring-2 ring-primary-500 ring-opacity-50' : ''
      } ${
        isFocused ? 'ring-2 ring-primary-400' : ''
      } rounded-lg transition-all duration-200`}
      onMouseEnter={() => isSelected && setShowMenu(false)}
    >
      {/* Block Actions */}
      {showActions && isSelected && (
        <div className="absolute -right-12 top-1 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Block options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate Block
                </button>
                <button
                  onClick={handleMoveUp}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                  Move Up
                </button>
                <button
                  onClick={handleMoveDown}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                  Move Down
                </button>
                <button
                  onClick={handleSettings}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Block Settings
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Block
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block Content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}