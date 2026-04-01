'use client';

import { useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { ContentBlock, BlockType, createParagraphBlock, createHeadingBlock } from '@/types/blocks';
import { BlockRenderer } from './blocks/BlockRenderer';
import { BlockAddMenu } from './BlockAddMenu';
import { getInternalLinkSuggestions } from '@/lib/internal-linking';
import {
  InternalLinkSuggestion,
  InternalLinkSuggestionPanel,
} from './InternalLinkSuggestionPanel';

interface BlockCanvasProps {
  state: EditorState;
  onAction: (action: EditorAction) => void;
}

export function BlockCanvas({ state, onAction }: BlockCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectedBlock = state.content.blocks.find((block) => block.id === state.selectedBlockId);

  const selectedBlockText = (() => {
    if (!selectedBlock) return '';

    const dataText = (selectedBlock as any).data?.text;
    if (typeof dataText === 'string') return dataText;

    const contentText = (selectedBlock as any).content?.text;
    if (Array.isArray(contentText)) {
      return contentText
        .map((node: any) => (typeof node?.text === 'string' ? node.text : ''))
        .join(' ')
        .trim();
    }

    return '';
  })();

  const suggestionSeed = `${state.post.title} ${state.post.excerpt} ${selectedBlockText}`.trim();

  const linkSuggestions = getInternalLinkSuggestions(
    {
      title: state.post.title,
      excerpt: suggestionSeed,
      tags: state.post.tags,
    },
    6
  );

  const canInsertIntoSelectedBlock = Boolean(
    selectedBlock &&
      (
        typeof (selectedBlock as any).data?.text === 'string' ||
        Array.isArray((selectedBlock as any).content?.text)
      )
  );

  const handleInsertInternalLink = useCallback(
    (suggestion: InternalLinkSuggestion) => {
      if (!selectedBlock) return;

      // Support both editor block shapes: data.text and content.text[]
      const asAny = selectedBlock as any;

      if (typeof asAny.data?.text === 'string') {
        const baseText = asAny.data.text.trim();
        const separator = baseText.length > 0 ? ' ' : '';
        const appended = `${baseText}${separator}[${suggestion.anchorText}](${suggestion.href})`;

        onAction({
          type: 'UPDATE_BLOCK',
          payload: {
            id: selectedBlock.id,
            updates: {
              ...(selectedBlock as any),
              data: {
                ...asAny.data,
                text: appended,
              },
            },
          },
        });

        return;
      }

      if (Array.isArray(asAny.content?.text)) {
        const updatedText = [
          ...asAny.content.text,
          { text: asAny.content.text.length > 0 ? ' ' : '' },
          {
            text: suggestion.anchorText,
            formats: {
              link: {
                url: suggestion.href,
                target: '_self',
              },
            },
          },
        ];

        onAction({
          type: 'UPDATE_BLOCK',
          payload: {
            id: selectedBlock.id,
            updates: {
              content: {
                ...asAny.content,
                text: updatedText,
              },
            },
          },
        });
      }
    },
    [onAction, selectedBlock]
  );
  
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;
    
    const blockId = result.draggableId;
    onAction({
      type: 'MOVE_BLOCK',
      payload: { id: blockId, newIndex: destination.index }
    });
  }, [onAction]);

  const handleAddBlock = useCallback((type: BlockType, index?: number) => {
    let newBlock: ContentBlock;
    
    switch (type) {
      case BlockType.PARAGRAPH:
        newBlock = createParagraphBlock('', index || state.content.blocks.length);
        break;
      case BlockType.HEADING:
        newBlock = createHeadingBlock('', 2, index || state.content.blocks.length);
        break;
      default:
        // For now, default to paragraph
        newBlock = createParagraphBlock('', index || state.content.blocks.length);
    }
    
    onAction({
      type: 'ADD_BLOCK',
      payload: { block: newBlock, index }
    });
  }, [state.content.blocks.length, onAction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Add new paragraph block
      handleAddBlock(BlockType.PARAGRAPH);
    }
  }, [handleAddBlock]);

  const getCanvasWidth = () => {
    switch (state.viewMode) {
      case 'tablet': return 'max-w-3xl';
      case 'mobile': return 'max-w-sm';
      default: return 'max-w-4xl';
    }
  };

  const renderCanvas = () => {
    if (state.mode === 'source') {
      return (
        <div className="h-full p-6">
          <div className={`mx-auto ${getCanvasWidth()}`}>
            <textarea
              value={JSON.stringify(state.content, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onAction({ type: 'SET_CONTENT', payload: parsed });
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              className="w-full h-full font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded-lg border-0 outline-none resize-none"
              placeholder="JSON content..."
            />
          </div>
        </div>
      );
    }

    if (state.mode === 'preview') {
      return (
        <div className="h-full p-6 bg-white">
          <div className={`mx-auto ${getCanvasWidth()}`}>
            <article className="prose prose-lg max-w-none">
              {state.content.blocks.map((block) => (
                <BlockRenderer 
                  key={block.id} 
                  block={block} 
                  readonly 
                  state={state}
                  onAction={onAction}
                />
              ))}
            </article>
          </div>
        </div>
      );
    }

    // Edit mode
    return (
      <div 
        ref={canvasRef}
        className="h-full overflow-y-auto"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="min-h-full p-6">
          <div className={`mx-auto ${getCanvasWidth()}`}>
            {/* Post Header */}
            <div className="mb-12">
              <input
                type="text"
                placeholder="Enter post title..."
                value={state.post.title}
                onChange={(e) => onAction({
                  type: 'UPDATE_POST_METADATA',
                  payload: { title: e.target.value }
                })}
                className="text-4xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-400 w-full mb-4 focus:ring-2 focus:ring-primary-500 rounded p-2"
              />
              
              <textarea
                placeholder="Write an excerpt that describes your post..."
                value={state.post.excerpt}
                onChange={(e) => onAction({
                  type: 'UPDATE_POST_METADATA',
                  payload: { excerpt: e.target.value }
                })}
                className="text-xl text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 w-full resize-none focus:ring-2 focus:ring-primary-500 rounded p-2"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
              <div>
                {/* Block Editor */}
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="blocks">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-64 ${snapshot.isDraggingOver ? 'bg-primary-50 rounded-lg' : ''}`}
                      >
                        {state.content.blocks.length === 0 && (
                          <div className="text-center py-16">
                            <div className="text-gray-400 mb-4">
                              <div className="text-6xl mb-4">✍️</div>
                              <h3 className="text-xl font-semibold mb-2">Start writing your story</h3>
                              <p className="text-gray-500">Click the + button below to add your first block</p>
                            </div>

                            <BlockAddMenu
                              onAddBlock={(type) => handleAddBlock(type, 0)}
                              position="center"
                            />
                          </div>
                        )}

                        {state.content.blocks.map((block, index) => (
                          <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group relative mb-4 ${
                                  snapshot.isDragging ? 'bg-white shadow-lg rounded-lg' : ''
                                } ${
                                  state.selectedBlockId === block.id ? 'ring-2 ring-primary-500 rounded-lg' : ''
                                }`}
                                onClick={() => onAction({ type: 'SELECT_BLOCK', payload: { id: block.id } })}
                              >
                                {/* Drag Handle */}
                                <div
                                  {...provided.dragHandleProps}
                                  className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                {/* Block Content */}
                                <BlockRenderer
                                  block={block}
                                  state={state}
                                  onAction={onAction}
                                  isSelected={state.selectedBlockId === block.id}
                                  isFocused={state.focusedBlockId === block.id}
                                />

                                {/* Add Block Button */}
                                {state.selectedBlockId === block.id && (
                                  <div className="flex justify-center mt-4">
                                    <BlockAddMenu
                                      onAddBlock={(type) => handleAddBlock(type, index + 1)}
                                      position="inline"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}

                        {/* Final Add Block Button */}
                        {state.content.blocks.length > 0 && (
                          <div className="flex justify-center mt-8">
                            <BlockAddMenu
                              onAddBlock={(type) => handleAddBlock(type)}
                              position="bottom"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>

              <InternalLinkSuggestionPanel
                suggestions={linkSuggestions}
                canInsert={canInsertIntoSelectedBlock}
                selectedBlockLabel={selectedBlock ? `block ${selectedBlock.order + 1}` : undefined}
                onInsert={handleInsertInternalLink}
                highlightTerms={selectedBlockText.split(/\s+/).slice(0, 6)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-50 relative">
      {/* Canvas Ruler (for design reference) */}
      {state.mode === 'edit' && (
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 opacity-50">
          <div className={`mx-auto ${getCanvasWidth()} h-full bg-white/50`} />
        </div>
      )}
      
      {renderCanvas()}
    </div>
  );
}