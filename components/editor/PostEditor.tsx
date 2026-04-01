'use client';

import { useReducer, useEffect, useRef } from 'react';
import { EditorState, EditorAction, editorReducer, createInitialEditorState } from '@/lib/editor-state';
import { EditorToolbar } from './EditorToolbar';
import { BlockCanvas } from './BlockCanvas';
import { EditorSidebar } from './EditorSidebar';
import { EditorStatusBar } from './EditorStatusBar';
import { PublishPanel } from './PublishPanel';

interface PostEditorProps {
  postId?: string;
  initialState?: Partial<EditorState>;
  onSave?: (state: EditorState) => Promise<void>;
  onPublish?: (state: EditorState) => Promise<void>;
  onAutoSave?: (state: EditorState) => Promise<void>;
}

export function PostEditor({ 
  postId, 
  initialState, 
  onSave, 
  onPublish, 
  onAutoSave 
}: PostEditorProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    { ...createInitialEditorState(postId), ...initialState }
  );
  
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const lastAutoSave = useRef<Date>(new Date());

  // Auto-save functionality
  useEffect(() => {
    if (!state.preferences.autoSave || !state.hasUnsavedChanges || !onAutoSave) {
      return;
    }

    const saveInterval = state.preferences.autoSaveInterval * 1000;
    
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const timeSinceLastSave = Date.now() - lastAutoSave.current.getTime();
      if (timeSinceLastSave >= saveInterval) {
        onAutoSave(state);
        lastAutoSave.current = new Date();
      }
    }, saveInterval);

    return () => clearTimeout(autoSaveTimer.current);
  }, [state.hasUnsavedChanges, state.preferences.autoSave, state.preferences.autoSaveInterval, onAutoSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            onSave?.(state);
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              dispatch({ type: 'REDO' });
            } else {
              dispatch({ type: 'UNDO' });
            }
            break;
          case 'Enter':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              onPublish?.(state);
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [state, onSave, onPublish]);

  const handleAction = (action: EditorAction) => {
    dispatch(action);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Toolbar */}
      <EditorToolbar
        state={state}
        onAction={handleAction}
        onSave={() => onSave?.(state)}
        onPublish={() => onPublish?.(state)}
      />

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <EditorSidebar
          state={state}
          onAction={handleAction}
        />

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col">
          <BlockCanvas
            state={state}
            onAction={handleAction}
          />
        </div>

        {/* Right Panel (Publish/Settings) */}
        <PublishPanel
          state={state}
          onAction={handleAction}
          onPublish={() => onPublish?.(state)}
        />
      </div>

      {/* Bottom Status Bar */}
      <EditorStatusBar
        state={state}
        onAction={handleAction}
      />
    </div>
  );
}