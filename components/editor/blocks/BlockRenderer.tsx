'use client';

import { ContentBlock, BlockType } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { ParagraphBlock } from './ParagraphBlock';
import { HeadingBlock } from './HeadingBlock';
import { ImageBlock } from './ImageBlock';
import { ListBlock } from './ListBlock';
import { QuoteBlock } from './QuoteBlock';
import { CodeBlock } from './CodeBlock';
import { EmbedBlock } from './EmbedBlock';
import { TableBlock } from './TableBlock';
import { FAQBlock } from './FAQBlock';
import { HighlightBlock } from './HighlightBlock';
import { DividerBlock } from './DividerBlock';
import { CTABlock } from './CTABlock';
import { GalleryBlock } from './GalleryBlock';

interface BlockRendererProps {
  block: ContentBlock;
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function BlockRenderer({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: BlockRendererProps) {
  const commonProps = {
    block,
    state,
    onAction,
    readonly,
    isSelected,
    isFocused
  };

  switch (block.type) {
    case BlockType.PARAGRAPH:
      return <ParagraphBlock {...commonProps} />;
    
    case BlockType.HEADING:
      return <HeadingBlock {...commonProps} />;
    
    case BlockType.IMAGE:
      return <ImageBlock {...commonProps} />;
    
    case BlockType.LIST:
    case BlockType.ORDERED_LIST:
      return <ListBlock {...commonProps} />;
    
    case BlockType.QUOTE:
      return <QuoteBlock {...commonProps} />;
    
    case BlockType.CODE:
      return <CodeBlock {...commonProps} />;
    
    case BlockType.EMBED:
      return <EmbedBlock {...commonProps} />;
    
    case BlockType.TABLE:
      return <TableBlock {...commonProps} />;
    
    case BlockType.FAQ:
      return <FAQBlock {...commonProps} />;
    
    case BlockType.HIGHLIGHT:
      return <HighlightBlock {...commonProps} />;
    
    case BlockType.DIVIDER:
      return <DividerBlock {...commonProps} />;
    
    case BlockType.CTA:
      return <CTABlock {...commonProps} />;
    
    case BlockType.GALLERY:
      return <GalleryBlock {...commonProps} />;
    
    default:
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700 font-medium">Unknown block type: {(block as any).type}</div>
          <div className="text-red-600 text-sm mt-1">
            This block type is not supported in the current editor version.
          </div>
        </div>
      );
  }
}