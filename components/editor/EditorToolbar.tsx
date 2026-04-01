'use client';

import { useState } from 'react';
import { 
  Save, 
  Eye, 
  Code, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Undo, 
  Redo,
  Settings,
  MoreHorizontal,
  Share,
  Download,
  Upload,
  ChevronDown
} from 'lucide-react';
import { EditorState, EditorAction, editorSelectors } from '@/lib/editor-state';

interface EditorToolbarProps {
  state: EditorState;
  onAction: (action: EditorAction) => void;
  onSave?: () => void;
  onPublish?: () => void;
}

export function EditorToolbar({ state, onAction, onSave, onPublish }: EditorToolbarProps) {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const canUndo = editorSelectors.canUndo(state);
  const canRedo = editorSelectors.canRedo(state);
  const wordCount = editorSelectors.getWordCount(state);

  const viewModeIcons = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone,
  };

  const ViewIcon = viewModeIcons[state.viewMode];

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* Left Section - Main Actions */}
      <div className="flex items-center space-x-2">
        {/* Post Title */}
        <div className="min-w-0 flex-1 mr-6">
          <input
            type="text"
            placeholder="Post title..."
            value={state.post.title}
            onChange={(e) => onAction({
              type: 'UPDATE_POST_METADATA',
              payload: { title: e.target.value }
            })}
            className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 py-1 w-full max-w-md"
          />
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onAction({ type: 'UNDO' })}
            disabled={!canUndo}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 rounded hover:bg-gray-100 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAction({ type: 'REDO' })}
            disabled={!canRedo}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 rounded hover:bg-gray-100 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Mode Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onAction({ type: 'SET_MODE', payload: { mode: 'edit' } })}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              state.mode === 'edit'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => onAction({ type: 'SET_MODE', payload: { mode: 'preview' } })}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center space-x-1 ${
              state.mode === 'preview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </button>
          <button
            onClick={() => onAction({ type: 'SET_MODE', payload: { mode: 'source' } })}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center space-x-1 ${
              state.mode === 'source'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Source</span>
          </button>
        </div>

        {/* View Mode */}
        <div className="relative">
          <button
            onClick={() => setShowViewMenu(!showViewMenu)}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <ViewIcon className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
          
          {showViewMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-32">
              {Object.entries(viewModeIcons).map(([mode, Icon]) => (
                <button
                  key={mode}
                  onClick={() => {
                    onAction({ type: 'SET_VIEW_MODE', payload: { viewMode: mode as any } });
                    setShowViewMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 capitalize"
                >
                  <Icon className="w-4 h-4" />
                  <span>{mode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Section - Status */}
      <div className="flex items-center space-x-4 text-sm text-gray-500">
        {state.isSaving && (
          <span className="flex items-center space-x-1">
            <div className="w-3 h-3 border border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Saving...</span>
          </span>
        )}
        
        {!state.isSaving && state.hasUnsavedChanges && (
          <span className="text-orange-600">Unsaved changes</span>
        )}
        
        {!state.isSaving && !state.hasUnsavedChanges && (
          <span className="text-green-600">All changes saved</span>
        )}

        <span>
          {wordCount} word{wordCount !== 1 ? 's' : ''}
        </span>
        
        <span>
          {state.content.blocks.length} block{state.content.blocks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center space-x-2">
        {/* More Actions */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {showMoreMenu && (
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-48">
              <button
                onClick={() => {
                  // Export content
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Download className="w-4 h-4" />
                <span>Export Content</span>
              </button>
              <button
                onClick={() => {
                  // Import content
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Upload className="w-4 h-4" />
                <span>Import Content</span>
              </button>
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={() => {
                  // Share post
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Share className="w-4 h-4" />
                <span>Share Preview</span>
              </button>
              <button
                onClick={() => {
                  onAction({ type: 'SET_SIDEBAR_TAB', payload: { tab: 'settings' } });
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Settings className="w-4 h-4" />
                <span>Post Settings</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Save Draft */}
        <button
          onClick={onSave}
          disabled={state.isSaving || !state.hasUnsavedChanges}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-1" />
          {state.isSaving ? 'Saving...' : 'Save Draft'}
        </button>

        {/* Publish */}
        <button
          onClick={onPublish}
          disabled={state.isPublishing}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {state.isPublishing ? 'Publishing...' : 
           state.post.status === 'published' ? 'Update' : 'Publish'}
        </button>
      </div>

      {/* Dropdown backgrounds - close when clicking outside */}
      {(showViewMenu || showMoreMenu) && (
        <div 
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowViewMenu(false);
            setShowMoreMenu(false);
          }}
        />
      )}
    </div>
  );
}