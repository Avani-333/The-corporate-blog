import { z } from 'zod';

// Base block interface
export interface BaseBlock {
  id: string;
  type: BlockType;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Block types enum
export enum BlockType {
  PARAGRAPH = 'paragraph',
  HEADING = 'heading',
  IMAGE = 'image',
  LIST = 'list',
  QUOTE = 'quote',
  CODE = 'code',
  EMBED = 'embed',
  TABLE = 'table',
  FAQ = 'faq',
  HIGHLIGHT = 'highlight',
  DIVIDER = 'divider',
  CTA = 'cta',
  GALLERY = 'gallery',
}

// Text formatting options
export interface TextFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  link?: {
    url: string;
    title?: string;
    target?: '_blank' | '_self';
  };
}

// Rich text node for inline formatting
export interface TextNode {
  text: string;
  formats?: TextFormat;
}

// Paragraph block
export interface ParagraphBlock extends BaseBlock {
  type: BlockType.PARAGRAPH;
  content: {
    text: TextNode[];
    alignment?: 'left' | 'center' | 'right' | 'justify';
    size?: 'small' | 'normal' | 'large';
  };
}

// Heading block
export interface HeadingBlock extends BaseBlock {
  type: BlockType.HEADING;
  content: {
    text: TextNode[];
    level: 1 | 2 | 3 | 4 | 5 | 6;
    alignment?: 'left' | 'center' | 'right';
    anchor?: string; // For SEO anchors
  };
}

// Image block
export interface ImageBlock extends BaseBlock {
  type: BlockType.IMAGE;
  content: {
    src: string;
    alt: string;
    caption?: TextNode[];
    width?: number;
    height?: number;
    alignment?: 'left' | 'center' | 'right' | 'full';
    lazy?: boolean;
    aspectRatio?: string;
    cloudinaryId?: string; // For Cloudinary integration
  };
}

// List block
export interface ListBlock extends BaseBlock {
  type: BlockType.LIST;
  content: {
    style: 'ordered' | 'unordered' | 'checklist';
    items: Array<{
      id: string;
      text: TextNode[];
      checked?: boolean; // For checklist items
      nested?: ListBlock['content']['items'];
    }>;
  };
}

// Quote block
export interface QuoteBlock extends BaseBlock {
  type: BlockType.QUOTE;
  content: {
    text: TextNode[];
    citation?: {
      author?: string;
      source?: string;
      url?: string;
    };
    style?: 'default' | 'large' | 'bordered';
  };
}

// Code block
export interface CodeBlock extends BaseBlock {
  type: BlockType.CODE;
  content: {
    code: string;
    language?: string;
    filename?: string;
    showLineNumbers?: boolean;
    highlightLines?: number[];
    theme?: 'dark' | 'light';
  };
}

// Embed block (YouTube, Twitter, etc.)
export interface EmbedBlock extends BaseBlock {
  type: BlockType.EMBED;
  content: {
    url: string;
    provider: 'youtube' | 'vimeo' | 'twitter' | 'codepen' | 'github' | 'figma' | 'custom';
    embedCode?: string; // For custom embeds
    title?: string;
    thumbnail?: string;
    aspectRatio?: string;
    autoplay?: boolean;
  };
}

// Table block
export interface TableBlock extends BaseBlock {
  type: BlockType.TABLE;
  content: {
    headers: TextNode[][];
    rows: TextNode[][][];
    caption?: string;
    striped?: boolean;
    bordered?: boolean;
    responsive?: boolean;
  };
}

// FAQ block
export interface FAQBlock extends BaseBlock {
  type: BlockType.FAQ;
  content: {
    items: Array<{
      id: string;
      question: TextNode[];
      answer: TextNode[];
      expanded?: boolean;
    }>;
    style?: 'accordion' | 'cards';
    allowMultiple?: boolean; // Allow multiple items to be expanded
  };
}

// Highlight block
export interface HighlightBlock extends BaseBlock {
  type: BlockType.HIGHLIGHT;
  content: {
    text: TextNode[];
    style: 'info' | 'warning' | 'success' | 'error' | 'note';
    title?: string;
    icon?: string;
  };
}

// Divider block
export interface DividerBlock extends BaseBlock {
  type: BlockType.DIVIDER;
  content: {
    style: 'line' | 'dots' | 'wave' | 'custom';
    thickness?: number;
    color?: string;
    spacing?: 'small' | 'medium' | 'large';
  };
}

// CTA (Call to Action) block
export interface CTABlock extends BaseBlock {
  type: BlockType.CTA;
  content: {
    title: TextNode[];
    description?: TextNode[];
    buttons: Array<{
      id: string;
      text: string;
      url: string;
      style: 'primary' | 'secondary' | 'outline';
      target?: '_blank' | '_self';
    }>;
    backgroundColor?: string;
    alignment?: 'left' | 'center' | 'right';
  };
}

// Gallery block
export interface GalleryBlock extends BaseBlock {
  type: BlockType.GALLERY;
  content: {
    images: Array<{
      id: string;
      src: string;
      alt: string;
      caption?: string;
      cloudinaryId?: string;
    }>;
    layout: 'grid' | 'carousel' | 'masonry';
    columns?: number;
    spacing?: number;
    lightbox?: boolean;
  };
}

// ============================================================================
// Block Data types (flat data shapes used by editor components via block.data)
// ============================================================================

export interface ParagraphBlockData {
  text: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

export interface HeadingBlockData {
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  alignment?: 'left' | 'center' | 'right';
}

export interface ImageBlockData {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  alignment?: 'left' | 'center' | 'right' | 'full';
}

export interface ListBlockData {
  items: Array<{
    id: string;
    text: string;
    checked?: boolean;
  }>;
  ordered?: boolean;
}

export interface QuoteBlockData {
  text: string;
  author?: string;
  citation?: string;
}

export interface CodeBlockData {
  code: string;
  language?: string;
  filename?: string;
}

export interface EmbedBlockData {
  url: string;
  provider?: string;
  caption?: string;
}

export interface TableBlockData {
  rows: Array<{ cells: string[] }>;
  hasHeader?: boolean;
  caption?: string;
}

export interface FAQBlockData {
  items: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

export interface HighlightBlockData {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'tip';
  title?: string;
}

export interface DividerBlockData {
  style: 'line' | 'dots' | 'asterisks';
}

export interface CTABlockData {
  title: string;
  description?: string;
  buttonText: string;
  buttonUrl: string;
  style?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  alignment?: 'left' | 'center' | 'right';
}

export interface GalleryBlockData {
  images: Array<{
    id: string;
    src: string;
    alt?: string;
    caption?: string;
  }>;
  layout?: 'grid' | 'carousel' | 'masonry';
  columns?: number;
}

export type AnyBlockData =
  | ParagraphBlockData
  | HeadingBlockData
  | ImageBlockData
  | ListBlockData
  | QuoteBlockData
  | CodeBlockData
  | EmbedBlockData
  | TableBlockData
  | FAQBlockData
  | HighlightBlockData
  | DividerBlockData
  | CTABlockData
  | GalleryBlockData;

// Union type for all blocks
export type ContentBlock = 
  | ParagraphBlock
  | HeadingBlock
  | ImageBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | EmbedBlock
  | TableBlock
  | FAQBlock
  | HighlightBlock
  | DividerBlock
  | CTABlock
  | GalleryBlock;

// Complete article/post content structure
export interface ArticleContent {
  version: string; // Schema version for migrations
  blocks: ContentBlock[];
  metadata: {
    wordCount: number;
    readingTime: number;
    lastModified: Date;
    revision: number;
  };
}

// Zod schemas for validation
export const TextNodeSchema = z.object({
  text: z.string(),
  formats: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    code: z.boolean().optional(),
    link: z.object({
      url: z.string().url(),
      title: z.string().optional(),
      target: z.enum(['_blank', '_self']).optional(),
    }).optional(),
  }).optional(),
});

export const ParagraphBlockSchema = z.object({
  id: z.string().cuid(),
  type: z.literal(BlockType.PARAGRAPH),
  order: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  content: z.object({
    text: z.array(TextNodeSchema),
    alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
    size: z.enum(['small', 'normal', 'large']).optional(),
  }),
});

export const HeadingBlockSchema = z.object({
  id: z.string().cuid(),
  type: z.literal(BlockType.HEADING),
  order: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  content: z.object({
    text: z.array(TextNodeSchema),
    level: z.number().int().min(1).max(6),
    alignment: z.enum(['left', 'center', 'right']).optional(),
    anchor: z.string().optional(),
  }),
});

export const ImageBlockSchema = z.object({
  id: z.string().cuid(),
  type: z.literal(BlockType.IMAGE),
  order: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  content: z.object({
    src: z.string().url(),
    alt: z.string().min(1, 'Alt text is required'),
    caption: z.array(TextNodeSchema).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    alignment: z.enum(['left', 'center', 'right', 'full']).optional(),
    lazy: z.boolean().optional(),
    aspectRatio: z.string().optional(),
    cloudinaryId: z.string().optional(),
  }),
});

// Content block factory functions
export const createParagraphBlock = (text: string = '', order: number = 0): ParagraphBlock => ({
  id: crypto.randomUUID(),
  type: BlockType.PARAGRAPH,
  order,
  createdAt: new Date(),
  updatedAt: new Date(),
  content: {
    text: [{ text }],
    alignment: 'left',
    size: 'normal',
  },
});

export const createHeadingBlock = (text: string = '', level: 1 | 2 | 3 | 4 | 5 | 6 = 2, order: number = 0): HeadingBlock => ({
  id: crypto.randomUUID(),
  type: BlockType.HEADING,
  order,
  createdAt: new Date(),
  updatedAt: new Date(),
  content: {
    text: [{ text }],
    level,
    alignment: 'left',
  },
});

export const createImageBlock = (src: string, alt: string, order: number = 0): ImageBlock => ({
  id: crypto.randomUUID(),
  type: BlockType.IMAGE,
  order,
  createdAt: new Date(),
  updatedAt: new Date(),
  content: {
    src,
    alt,
    alignment: 'center',
    lazy: true,
  },
});

// Utility functions
export const getBlockSchema = (type: BlockType) => {
  switch (type) {
    case BlockType.PARAGRAPH:
      return ParagraphBlockSchema;
    case BlockType.HEADING:
      return HeadingBlockSchema;
    case BlockType.IMAGE:
      return ImageBlockSchema;
    default:
      throw new Error(`Schema not implemented for block type: ${type}`);
  }
};

export const validateBlock = (block: any): boolean => {
  try {
    const schema = getBlockSchema(block.type);
    schema.parse(block);
    return true;
  } catch {
    return false;
  }
};

export const serializeContent = (content: ArticleContent): string => {
  return JSON.stringify(content, null, 2);
};

export const deserializeContent = (json: string): ArticleContent => {
  const parsed = JSON.parse(json);
  // Add validation here
  return parsed;
};