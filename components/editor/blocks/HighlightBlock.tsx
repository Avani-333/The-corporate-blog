'use client';

import { useRef, useEffect, useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Info, 
  Lightbulb, 
  AlertTriangle,
  ChevronDown 
} from 'lucide-react';
import { HighlightBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface HighlightBlockProps {
  block: ContentBlock & { data: HighlightBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

const HIGHLIGHT_TYPES = [
  { 
    type: 'info' as const, 
    label: 'Info', 
    icon: Info, 
    bgColor: 'bg-blue-50', 
    borderColor: 'border-blue-200', 
    textColor: 'text-blue-900',
    iconColor: 'text-blue-600'
  },
  { 
    type: 'success' as const, 
    label: 'Success', 
    icon: CheckCircle, 
    bgColor: 'bg-green-50', 
    borderColor: 'border-green-200', 
    textColor: 'text-green-900',
    iconColor: 'text-green-600'
  },
  { 
    type: 'warning' as const, 
    label: 'Warning', 
    icon: AlertTriangle, 
    bgColor: 'bg-yellow-50', 
    borderColor: 'border-yellow-200', 
    textColor: 'text-yellow-900',
    iconColor: 'text-yellow-600'
  },
  { 
    type: 'error' as const, 
    label: 'Error', 
    icon: XCircle, 
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-200', 
    textColor: 'text-red-900',
    iconColor: 'text-red-600'
  },
  { 
    type: 'tip' as const, 
    label: 'Tip', 
    icon: Lightbulb, 
    bgColor: 'bg-purple-50', 
    borderColor: 'border-purple-200', 
    textColor: 'text-purple-900',
    iconColor: 'text-purple-600'
  }
];

export function HighlightBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: HighlightBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

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

  const handleTitleChange = (title: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, title }
      }
    });
  };

  const handleTypeChange = (type: 'info' | 'success' | 'warning' | 'error' | 'tip') => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, type }
      }
    });
    setShowTypeMenu(false);
  };

  const currentType = HIGHLIGHT_TYPES.find(t => t.type === block.data.type) || HIGHLIGHT_TYPES[0];
  const Icon = currentType.icon;

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        <div className={`p-4 rounded-lg border ${currentType.bgColor} ${currentType.borderColor}`}>
          <div className="flex items-start gap-3">
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${currentType.iconColor}`} />
            <div className="flex-1">
              {block.data.title && (
                <h4 className={`font-semibold mb-2 ${currentType.textColor} m-0`}>
                  {block.data.title}
                </h4>
              )}
              <div className={`${currentType.textColor} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}>
                {block.data.text || <span className="text-gray-400 italic">Empty highlight</span>}
              </div>
            </div>
          </div>
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
      <div className={`p-4 rounded-lg border ${currentType.bgColor} ${currentType.borderColor}`}>
        {/* Type Selector */}
        {isSelected && (
          <div className="relative mb-3">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
            >
              <Icon className={`w-4 h-4 ${currentType.iconColor}`} />
              {currentType.label}
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {showTypeMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                {HIGHLIGHT_TYPES.map((type) => {
                  const TypeIcon = type.icon;
                  return (
                    <button
                      key={type.type}
                      onClick={() => handleTypeChange(type.type)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        block.data.type === type.type ? 'bg-gray-50' : ''
                      }`}
                    >
                      <TypeIcon className={`w-4 h-4 ${type.iconColor}`} />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${currentType.iconColor}`} />
          <div className="flex-1 space-y-2">
            {/* Title */}
            <input
              type="text"
              value={block.data.title || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Add a title (optional)"
              className={`w-full bg-transparent border-none outline-none font-semibold ${currentType.textColor} placeholder-gray-400 focus:placeholder-gray-300`}
            />

            {/* Text */}
            <textarea
              ref={textareaRef}
              value={block.data.text}
              onChange={(e) => handleTextChange(e.target.value)}
              onFocus={() => onAction({ type: 'FOCUS_BLOCK', payload: { id: block.id } })}
              placeholder="Enter your highlight text..."
              className={`w-full bg-transparent border-none outline-none resize-none ${currentType.textColor} placeholder-gray-400 focus:placeholder-gray-300 leading-relaxed min-h-[2rem]`}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>
        </div>
      </div>
    </BlockWrapper>
  );
}