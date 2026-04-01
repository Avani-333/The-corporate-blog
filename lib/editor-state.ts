import { ContentBlock, BlockType, ArticleContent } from '@/types/blocks';

// Editor state interface
export interface EditorState {
  // Content
  content: ArticleContent;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  hasUnsavedChanges: boolean;
  
  // Selection state
  selectedBlockId: string | null;
  focusedBlockId: string | null;
  
  // Editor modes
  mode: 'edit' | 'preview' | 'source';
  viewMode: 'desktop' | 'tablet' | 'mobile';
  
  // Sidebar state
  sidebarOpen: boolean;
  activeSidebarTab: 'blocks' | 'settings' | 'seo' | 'media';
  
  // History for undo/redo
  history: ArticleContent[];
  historyIndex: number;
  maxHistorySize: number;
  
  // Post metadata
  post: {
    id?: string;
    title: string;
    slug: string;
    excerpt: string;
    status: 'draft' | 'published' | 'scheduled' | 'archived';
    publishedAt?: Date;
    scheduledAt?: Date;
    categories: string[];
    tags: string[];
    featuredImage?: string;
    seoTitle?: string;
    seoDescription?: string;
    allowComments: boolean;
    isSticky: boolean;
  };
  
  // User preferences
  preferences: {
    autoSave: boolean;
    autoSaveInterval: number; // seconds
    showWordCount: boolean;
    showReadingTime: boolean;
    theme: 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large';
  };
  
  // Errors and validation
  errors: {
    [blockId: string]: string[];
  };
  validationErrors: string[];
}

// Editor actions
export type EditorAction =
  // Content actions
  | { type: 'SET_CONTENT'; payload: ArticleContent }
  | { type: 'ADD_BLOCK'; payload: { block: ContentBlock; index?: number } }
  | { type: 'UPDATE_BLOCK'; payload: { id: string; updates: Partial<ContentBlock> } }
  | { type: 'REMOVE_BLOCK'; payload: { id: string } }
  | { type: 'MOVE_BLOCK'; payload: { id: string; newIndex: number } }
  | { type: 'DUPLICATE_BLOCK'; payload: { id: string } }
  
  // Selection actions
  | { type: 'SELECT_BLOCK'; payload: { id: string | null } }
  | { type: 'FOCUS_BLOCK'; payload: { id: string | null } }
  
  // UI actions
  | { type: 'SET_MODE'; payload: { mode: EditorState['mode'] } }
  | { type: 'SET_VIEW_MODE'; payload: { viewMode: EditorState['viewMode'] } }
  | { type: 'TOGGLE_SIDEBAR'; payload?: { open?: boolean } }
  | { type: 'SET_SIDEBAR_TAB'; payload: { tab: EditorState['activeSidebarTab'] } }
  
  // Loading states
  | { type: 'SET_LOADING'; payload: { loading: boolean } }
  | { type: 'SET_SAVING'; payload: { saving: boolean } }
  | { type: 'SET_PUBLISHING'; payload: { publishing: boolean } }
  
  // History actions
  | { type: 'ADD_TO_HISTORY'; payload: { content: ArticleContent } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' }
  
  // Post metadata actions
  | { type: 'UPDATE_POST_METADATA'; payload: Partial<EditorState['post']> }
  | { type: 'SET_POST_STATUS'; payload: { status: EditorState['post']['status'] } }
  
  // Preferences actions
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<EditorState['preferences']> }
  
  // Error actions
  | { type: 'SET_BLOCK_ERRORS'; payload: { blockId: string; errors: string[] } }
  | { type: 'CLEAR_BLOCK_ERRORS'; payload: { blockId: string } }
  | { type: 'SET_VALIDATION_ERRORS'; payload: { errors: string[] } }
  | { type: 'CLEAR_ALL_ERRORS' };

// Initial editor state factory
export const createInitialEditorState = (postId?: string): EditorState => ({
  content: {
    version: '1.0.0',
    blocks: [],
    metadata: {
      wordCount: 0,
      readingTime: 0,
      lastModified: new Date(),
      revision: 1,
    },
  },
  
  isLoading: false,
  isSaving: false,
  isPublishing: false,
  hasUnsavedChanges: false,
  
  selectedBlockId: null,
  focusedBlockId: null,
  
  mode: 'edit',
  viewMode: 'desktop',
  
  sidebarOpen: true,
  activeSidebarTab: 'blocks',
  
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  
  post: {
    id: postId,
    title: '',
    slug: '',
    excerpt: '',
    status: 'draft',
    categories: [],
    tags: [],
    allowComments: true,
    isSticky: false,
  },
  
  preferences: {
    autoSave: true,
    autoSaveInterval: 30,
    showWordCount: true,
    showReadingTime: true,
    theme: 'light',
    fontSize: 'medium',
  },
  
  errors: {},
  validationErrors: [],
});

// Editor reducer
export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'SET_CONTENT':
      return {
        ...state,
        content: action.payload,
        hasUnsavedChanges: true,
      };

    case 'ADD_BLOCK':
      const newBlocks = [...state.content.blocks];
      const insertIndex = action.payload.index ?? newBlocks.length;
      newBlocks.splice(insertIndex, 0, action.payload.block);
      
      // Reorder blocks
      const reorderedBlocks = newBlocks.map((block, index) => ({
        ...block,
        order: index,
        updatedAt: new Date(),
      }));

      return {
        ...state,
        content: {
          ...state.content,
          blocks: reorderedBlocks,
          metadata: {
            ...state.content.metadata,
            lastModified: new Date(),
            revision: state.content.metadata.revision + 1,
          },
        },
        selectedBlockId: action.payload.block.id,
        hasUnsavedChanges: true,
      };

    case 'UPDATE_BLOCK':
      const updatedBlocks = state.content.blocks.map(block =>
        block.id === action.payload.id
          ? { ...block, ...action.payload.updates, updatedAt: new Date() }
          : block
      );

      return {
        ...state,
        content: {
          ...state.content,
          blocks: updatedBlocks,
          metadata: {
            ...state.content.metadata,
            lastModified: new Date(),
          },
        },
        hasUnsavedChanges: true,
      };

    case 'REMOVE_BLOCK':
      const filteredBlocks = state.content.blocks
        .filter(block => block.id !== action.payload.id)
        .map((block, index) => ({ ...block, order: index }));

      return {
        ...state,
        content: {
          ...state.content,
          blocks: filteredBlocks,
          metadata: {
            ...state.content.metadata,
            lastModified: new Date(),
          },
        },
        selectedBlockId: state.selectedBlockId === action.payload.id ? null : state.selectedBlockId,
        focusedBlockId: state.focusedBlockId === action.payload.id ? null : state.focusedBlockId,
        hasUnsavedChanges: true,
      };

    case 'MOVE_BLOCK':
      const blockToMove = state.content.blocks.find(block => block.id === action.payload.id);
      if (!blockToMove) return state;

      const blocksWithoutMoved = state.content.blocks.filter(block => block.id !== action.payload.id);
      blocksWithoutMoved.splice(action.payload.newIndex, 0, blockToMove);
      
      const reindexedBlocks = blocksWithoutMoved.map((block, index) => ({
        ...block,
        order: index,
      }));

      return {
        ...state,
        content: {
          ...state.content,
          blocks: reindexedBlocks,
        },
        hasUnsavedChanges: true,
      };

    case 'SELECT_BLOCK':
      return {
        ...state,
        selectedBlockId: action.payload.id,
      };

    case 'FOCUS_BLOCK':
      return {
        ...state,
        focusedBlockId: action.payload.id,
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload.mode,
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.payload.viewMode,
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: action.payload?.open ?? !state.sidebarOpen,
      };

    case 'SET_SIDEBAR_TAB':
      return {
        ...state,
        activeSidebarTab: action.payload.tab,
        sidebarOpen: true,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.loading,
      };

    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload.saving,
        ...(action.payload.saving === false && { hasUnsavedChanges: false }),
      };

    case 'ADD_TO_HISTORY':
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action.payload.content);
      
      // Keep history size manageable
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      }

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };

    case 'UNDO':
      if (state.historyIndex > 0) {
        return {
          ...state,
          content: state.history[state.historyIndex - 1],
          historyIndex: state.historyIndex - 1,
          hasUnsavedChanges: true,
        };
      }
      return state;

    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          content: state.history[state.historyIndex + 1],
          historyIndex: state.historyIndex + 1,
          hasUnsavedChanges: true,
        };
      }
      return state;

    case 'UPDATE_POST_METADATA':
      return {
        ...state,
        post: {
          ...state.post,
          ...action.payload,
        },
        hasUnsavedChanges: true,
      };

    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };

    case 'SET_BLOCK_ERRORS':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.blockId]: action.payload.errors,
        },
      };

    case 'CLEAR_BLOCK_ERRORS':
      const { [action.payload.blockId]: removed, ...remainingErrors } = state.errors;
      return {
        ...state,
        errors: remainingErrors,
      };

    case 'SET_VALIDATION_ERRORS':
      return {
        ...state,
        validationErrors: action.payload.errors,
      };

    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        errors: {},
        validationErrors: [],
      };

    default:
      return state;
  }
};

// Selector functions for derived state
export const editorSelectors = {
  getSelectedBlock: (state: EditorState): ContentBlock | null => {
    if (!state.selectedBlockId) return null;
    return state.content.blocks.find(block => block.id === state.selectedBlockId) || null;
  },

  getFocusedBlock: (state: EditorState): ContentBlock | null => {
    if (!state.focusedBlockId) return null;
    return state.content.blocks.find(block => block.id === state.focusedBlockId) || null;
  },

  getBlockById: (state: EditorState, id: string): ContentBlock | null => {
    return state.content.blocks.find(block => block.id === id) || null;
  },

  getBlockIndex: (state: EditorState, id: string): number => {
    return state.content.blocks.findIndex(block => block.id === id);
  },

  canUndo: (state: EditorState): boolean => {
    return state.historyIndex > 0;
  },

  canRedo: (state: EditorState): boolean => {
    return state.historyIndex < state.history.length - 1;
  },

  getWordCount: (state: EditorState): number => {
    // Calculate word count from all text blocks
    return state.content.blocks.reduce((count, block) => {
      // This is a simplified version - implement based on block types
      if (block.type === BlockType.PARAGRAPH || block.type === BlockType.HEADING) {
        const textContent = (block as any).content.text
          .map((node: any) => node.text)
          .join(' ');
        return count + textContent.split(/\s+/).filter(word => word.length > 0).length;
      }
      return count;
    }, 0);
  },

  hasBlockErrors: (state: EditorState, blockId: string): boolean => {
    return Boolean(state.errors[blockId]?.length);
  },

  hasAnyErrors: (state: EditorState): boolean => {
    return Object.keys(state.errors).length > 0 || state.validationErrors.length > 0;
  },
};