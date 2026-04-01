'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Type, 
  Heading1, 
  Heading2, 
  Image, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Video, 
  Table,
  HelpCircle,
  Highlighter,
  Minus,
  Zap,
  ImageIcon
} from 'lucide-react';
import { BlockType } from '@/types/blocks';

interface BlockAddMenuProps {
  onAddBlock: (type: BlockType) => void;
  position: 'center' | 'inline' | 'bottom';
}

const BLOCK_TYPES = [
  { type: BlockType.PARAGRAPH, icon: Type, label: 'Paragraph', description: 'Start writing with plain text' },
  { type: BlockType.HEADING, icon: Heading1, label: 'Heading', description: 'Section heading' },
  { type: BlockType.IMAGE, icon: Image, label: 'Image', description: 'Upload or embed an image' },
  { type: BlockType.LIST, icon: List, label: 'Bullet List', description: 'Create a simple list' },
  { type: BlockType.ORDERED_LIST, icon: ListOrdered, label: 'Numbered List', description: 'Create a numbered list' },
  { type: BlockType.QUOTE, icon: Quote, label: 'Quote', description: 'Capture a quote or citation' },
  { type: BlockType.CODE, icon: Code, label: 'Code', description: 'Add a code snippet' },
  { type: BlockType.EMBED, icon: Video, label: 'Embed', description: 'Embed YouTube, Twitter, etc.' },
  { type: BlockType.TABLE, icon: Table, label: 'Table', description: 'Create a data table' },
  { type: BlockType.FAQ, icon: HelpCircle, label: 'FAQ', description: 'Question and answer format' },
  { type: BlockType.HIGHLIGHT, icon: Highlighter, label: 'Highlight', description: 'Important callout box' },
  { type: BlockType.DIVIDER, icon: Minus, label: 'Divider', description: 'Visual section break' },
  { type: BlockType.CTA, icon: Zap, label: 'Call to Action', description: 'Button or link highlight' },
  { type: BlockType.GALLERY, icon: ImageIcon, label: 'Gallery', description: 'Multiple images layout' }
];

export function BlockAddMenu({ onAddBlock, position }: BlockAddMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when menu opens
      setTimeout(() => searchRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredBlocks = BLOCK_TYPES.filter(block =>
    block.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddBlock = (type: BlockType) => {
    onAddBlock(type);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getButtonStyles = () => {
    const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200";
    
    switch (position) {
      case 'center':
        return `${base} bg-primary-600 text-white hover:bg-primary-700 shadow-lg`;
      case 'inline':
        return `${base} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-primary-300 shadow-sm`;
      case 'bottom':
        return `${base} bg-gray-100 text-gray-500 hover:bg-gray-200 border-2 border-dashed border-gray-300 hover:border-primary-400`;
      default:
        return base;
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={getButtonStyles()}
        aria-label="Add block"
      >
        <Plus className="w-4 h-4" />
        {position === 'center' ? 'Add your first block' : 'Add block'}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 ${
          position === 'center' ? 'left-1/2 transform -translate-x-1/2' : 'left-0'
        }`}>
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search for blocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Block List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredBlocks.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-sm">No blocks found matching "{searchTerm}"</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredBlocks.map((block) => {
                  const Icon = block.icon;
                  return (
                    <button
                      key={block.type}
                      onClick={() => handleAddBlock(block.type)}
                      className="w-full flex items-start gap-3 p-3 rounded-md hover:bg-gray-50 text-left transition-colors duration-150"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-md flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">{block.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{block.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Press / to search blocks</span>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">↵</kbd>
                <span>to add</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}