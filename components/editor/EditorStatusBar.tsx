'use client';

import { 
  Save, 
  Clock, 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  Users,
  Zap
} from 'lucide-react';
import { EditorState, EditorAction } from '@/lib/editor-state';

interface EditorStatusBarProps {
  state: EditorState;
  onAction: (action: EditorAction) => void;
}

export function EditorStatusBar({ state, onAction }: EditorStatusBarProps) {
  const getStatusColor = () => {
    switch (state.saveStatus) {
      case 'saving': return 'text-yellow-600 bg-yellow-50';
      case 'saved': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = () => {
    switch (state.saveStatus) {
      case 'saving':
        return <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />;
      case 'saved':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (state.saveStatus) {
      case 'saving': return 'Saving...';
      case 'saved': return 'All changes saved';
      case 'error': return 'Failed to save';
      default: return 'Unsaved changes';
    }
  };

  const formatLastSaved = () => {
    if (!state.metadata.lastSaved) return 'Never';
    
    const now = new Date();
    const saved = new Date(state.metadata.lastSaved);
    const diff = Math.floor((now.getTime() - saved.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
    return saved.toLocaleDateString();
  };

  const handleManualSave = () => {
    onAction({ type: 'SAVE_DRAFT' });
  };

  return (
    <div className="h-8 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-xs">
      {/* Left Side - Status */}
      <div className="flex items-center gap-4">
        {/* Save Status */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 text-gray-500">
          {navigator.onLine ? (
            <>
              <Wifi className="w-3 h-3" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Last Saved */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Last saved: {formatLastSaved()}</span>
        </div>

        {/* Manual Save Button */}
        {state.saveStatus === 'unsaved' && (
          <button
            onClick={handleManualSave}
            className="flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100 transition-colors"
          >
            <Save className="w-3 h-3" />
            Save now
          </button>
        )}
      </div>

      {/* Center - Statistics */}
      <div className="flex items-center gap-6 text-gray-500">
        <div className="flex items-center gap-1">
          <span>{state.content.blocks.length} blocks</span>
        </div>
        
        <div className="flex items-center gap-1">
          <span>{state.metadata.wordCount || 0} words</span>
        </div>

        <div className="flex items-center gap-1">
          <span>~{Math.ceil((state.metadata.wordCount || 0) / 200)} min read</span>
        </div>
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-3">
        {/* Collaboration Indicator */}
        <div className="flex items-center gap-1 text-gray-500">
          <Users className="w-3 h-3" />
          <span>Just you</span>
        </div>

        {/* Performance Indicator */}
        {state.metadata.wordCount && state.metadata.wordCount > 2000 && (
          <div className="flex items-center gap-1 text-amber-600">
            <Zap className="w-3 h-3" />
            <span>Long post</span>
          </div>
        )}

        {/* Preview Mode Indicator */}
        {state.mode === 'preview' && (
          <div className="flex items-center gap-1 text-blue-600">
            <Eye className="w-3 h-3" />
            <span>Preview mode</span>
          </div>
        )}

        {/* View Mode */}
        <div className="text-gray-500">
          <span>{state.viewMode === 'desktop' ? 'Desktop' : state.viewMode === 'tablet' ? 'Tablet' : 'Mobile'} view</span>
        </div>
      </div>
    </div>
  );
}