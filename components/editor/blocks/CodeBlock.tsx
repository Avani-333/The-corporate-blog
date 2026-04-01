'use client';

import { useRef, useEffect, useState } from 'react';
import { Copy, Check, Code, ChevronDown } from 'lucide-react';
import { CodeBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';

interface CodeBlockProps {
  block: ContentBlock & { data: CodeBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

const POPULAR_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'php', label: 'PHP' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'dart', label: 'Dart' }
];

export function CodeBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: CodeBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFocused]);

  const handleCodeChange = (code: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, code }
      }
    });
  };

  const handleLanguageChange = (language: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, language }
      }
    });
    setShowLanguageMenu(false);
  };

  const handleFilenameChange = (filename: string) => {
    onAction({
      type: 'UPDATE_BLOCK',
      payload: {
        id: block.id,
        data: { ...block.data, filename }
      }
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = '  '; // 2 spaces for indentation

      const newCode = 
        block.data.code.substring(0, start) + 
        spaces + 
        block.data.code.substring(end);

      handleCodeChange(newCode);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
      }, 0);
    } else if (e.key === 'Backspace' && block.data.code === '' && state.content.blocks.length > 1) {
      e.preventDefault();
      onAction({ type: 'DELETE_BLOCK', payload: { id: block.id } });
    }
  };

  const getLanguageLabel = (lang: string) => {
    const found = POPULAR_LANGUAGES.find(l => l.value === lang);
    return found ? found.label : lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              {block.data.filename && (
                <span className="text-gray-300 text-sm font-medium">
                  {block.data.filename}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {block.data.language && (
                <span className="text-gray-400 text-xs uppercase tracking-wide">
                  {getLanguageLabel(block.data.language)}
                </span>
              )}
              <button
                onClick={handleCopy}
                className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
                title="Copy code"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Code Content */}
          <pre className="p-4 overflow-x-auto">
            <code className="text-gray-100 text-sm font-mono leading-relaxed whitespace-pre">
              {block.data.code || <span className="text-gray-500 italic">Empty code block</span>}
            </code>
          </pre>
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
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            
            <input
              type="text"
              value={block.data.filename || ''}
              onChange={(e) => handleFilenameChange(e.target.value)}
              placeholder="filename.ext"
              className="bg-transparent border-none outline-none text-gray-300 text-sm font-medium placeholder-gray-500 focus:text-white min-w-0 max-w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors uppercase tracking-wide"
              >
                {block.data.language ? getLanguageLabel(block.data.language) : 'Language'}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showLanguageMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 max-h-64 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Search languages..."
                    className="w-full px-3 py-2 text-sm border-b border-gray-100 outline-none"
                    onChange={(e) => {
                      // Filter languages - implement if needed
                    }}
                  />
                  {POPULAR_LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => handleLanguageChange(lang.value)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        block.data.language === lang.value ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleCopy}
              className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Code Editor */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={block.data.code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => onAction({ type: 'FOCUS_BLOCK', payload: { id: block.id } })}
            placeholder="// Start typing your code..."
            className="w-full bg-transparent border-none outline-none resize-none text-gray-100 font-mono text-sm leading-relaxed p-4 min-h-[8rem] placeholder-gray-500"
            style={{ 
              tabSize: 2,
              whiteSpace: 'pre'
            }}
            spellCheck={false}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.max(target.scrollHeight, 128)}px`;
            }}
          />
        </div>
      </div>
    </BlockWrapper>
  );
}