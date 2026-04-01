/**
 * Structured Block Validation
 *
 * Production-grade validation for every editor block type.
 * Works with the flat `block.data` shape used by editor components and
 * the richer `block.content` shape defined in types/blocks.ts.
 *
 * Entry points:
 *   validateBlock(block)          – validate a single block
 *   validateAllBlocks(blocks)     – validate an array of blocks
 *   validatePostForPublish(post)  – full pre-publish validation
 */

import { BlockType } from '@/types/blocks';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface BlockValidationIssue {
  /** Block ID that has the issue (empty string for post-level issues) */
  blockId: string;
  /** Index of the block in the content array (-1 for post-level) */
  blockIndex: number;
  /** Human-friendly block type label, e.g. "Heading" */
  blockLabel: string;
  /** The field within the block that triggered the issue */
  field: string;
  /** Human-readable message */
  message: string;
  severity: ValidationSeverity;
  /** Machine-readable rule code for programmatic handling */
  rule: string;
}

export interface BlockValidationResult {
  /** Is the content valid for saving? (no errors, warnings OK) */
  isValid: boolean;
  /** Is the content valid for publishing? (no errors AND passes publish rules) */
  isPublishReady: boolean;
  /** All issues found */
  issues: BlockValidationIssue[];
  /** Issues grouped by block ID for the UI error map */
  issuesByBlock: Record<string, BlockValidationIssue[]>;
  /** Summary counts */
  counts: {
    errors: number;
    warnings: number;
    info: number;
  };
}

interface PostMeta {
  title?: string;
  slug?: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  status?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const BLOCK_LABELS: Record<string, string> = {
  [BlockType.PARAGRAPH]: 'Paragraph',
  [BlockType.HEADING]: 'Heading',
  [BlockType.IMAGE]: 'Image',
  [BlockType.LIST]: 'List',
  [BlockType.QUOTE]: 'Quote',
  [BlockType.CODE]: 'Code',
  [BlockType.EMBED]: 'Embed',
  [BlockType.TABLE]: 'Table',
  [BlockType.FAQ]: 'FAQ',
  [BlockType.HIGHLIGHT]: 'Highlight',
  [BlockType.DIVIDER]: 'Divider',
  [BlockType.CTA]: 'Call to Action',
  [BlockType.GALLERY]: 'Gallery',
};

function label(type: string): string {
  return BLOCK_LABELS[type] || type;
}

function issue(
  blockId: string,
  blockIndex: number,
  blockType: string,
  field: string,
  message: string,
  rule: string,
  severity: ValidationSeverity = 'error',
): BlockValidationIssue {
  return { blockId, blockIndex, blockLabel: label(blockType), field, message, severity, rule };
}

/** Get text content from a block – handles both `data.text` and `content.text` patterns. */
function getBlockText(block: any): string {
  const data = block.data ?? block.content ?? {};
  if (typeof data.text === 'string') return data.text;
  // TextNode[] pattern
  if (Array.isArray(data.text)) {
    return data.text.map((n: any) => (typeof n === 'string' ? n : n?.text ?? '')).join('');
  }
  return '';
}

function isUrl(val: string): boolean {
  if (!val) return false;
  try {
    new URL(val);
    return true;
  } catch {
    // Allow relative paths and blob URLs
    return val.startsWith('/') || val.startsWith('blob:');
  }
}

function isNonEmpty(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

// ============================================================================
// PER-BLOCK VALIDATORS
// ============================================================================

type BlockValidator = (block: any, index: number) => BlockValidationIssue[];

const validators: Record<string, BlockValidator> = {
  // ---- Paragraph ----
  [BlockType.PARAGRAPH]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};
    const text = getBlockText(block);

    // An empty paragraph is just a warning (might be intentional spacing)
    if (!text.trim()) {
      issues.push(issue(block.id, index, block.type, 'text', 'Paragraph is empty', 'paragraph.empty', 'warning'));
    }

    // Excessively long paragraph
    if (text.length > 5000) {
      issues.push(issue(block.id, index, block.type, 'text', 'Paragraph exceeds 5 000 characters — consider splitting', 'paragraph.too-long', 'warning'));
    }

    // Validate alignment if present
    if (data.alignment && !['left', 'center', 'right', 'justify'].includes(data.alignment)) {
      issues.push(issue(block.id, index, block.type, 'alignment', `Invalid alignment: "${data.alignment}"`, 'paragraph.invalid-alignment'));
    }

    return issues;
  },

  // ---- Heading ----
  [BlockType.HEADING]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};
    const text = getBlockText(block);

    if (!text.trim()) {
      issues.push(issue(block.id, index, block.type, 'text', 'Heading text is required', 'heading.empty'));
    }

    const level = data.level;
    if (level === undefined || level === null) {
      issues.push(issue(block.id, index, block.type, 'level', 'Heading level is required', 'heading.no-level'));
    } else if (typeof level !== 'number' || level < 1 || level > 6) {
      issues.push(issue(block.id, index, block.type, 'level', `Heading level must be 1-6, got ${level}`, 'heading.invalid-level'));
    }

    if (text.length > 200) {
      issues.push(issue(block.id, index, block.type, 'text', 'Heading text is too long (> 200 chars)', 'heading.too-long', 'warning'));
    }

    return issues;
  },

  // ---- Image ----
  [BlockType.IMAGE]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!isNonEmpty(data.src)) {
      issues.push(issue(block.id, index, block.type, 'src', 'Image source URL is required', 'image.no-src'));
    } else if (!isUrl(data.src)) {
      issues.push(issue(block.id, index, block.type, 'src', 'Image source is not a valid URL', 'image.invalid-src'));
    }

    if (!isNonEmpty(data.alt)) {
      issues.push(issue(block.id, index, block.type, 'alt', 'Alt text is required for accessibility and SEO', 'image.no-alt'));
    } else if (data.alt.length > 300) {
      issues.push(issue(block.id, index, block.type, 'alt', 'Alt text is too long (> 300 chars)', 'image.alt-too-long', 'warning'));
    }

    if (data.alignment && !['left', 'center', 'right', 'full'].includes(data.alignment)) {
      issues.push(issue(block.id, index, block.type, 'alignment', `Invalid alignment: "${data.alignment}"`, 'image.invalid-alignment'));
    }

    return issues;
  },

  // ---- List ----
  [BlockType.LIST]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!Array.isArray(data.items) || data.items.length === 0) {
      issues.push(issue(block.id, index, block.type, 'items', 'List must have at least one item', 'list.empty'));
      return issues;
    }

    const emptyItems = data.items.filter((item: any) => {
      const text = typeof item.text === 'string' ? item.text : '';
      return !text.trim();
    });

    if (emptyItems.length > 0) {
      issues.push(issue(
        block.id, index, block.type, 'items',
        `${emptyItems.length} list item${emptyItems.length > 1 ? 's are' : ' is'} empty`,
        'list.empty-items', 'warning',
      ));
    }

    if (data.items.length > 50) {
      issues.push(issue(block.id, index, block.type, 'items', 'List has more than 50 items — consider breaking it up', 'list.too-many', 'warning'));
    }

    return issues;
  },

  // ---- Quote ----
  [BlockType.QUOTE]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};
    const text = typeof data.text === 'string' ? data.text : getBlockText(block);

    if (!text.trim()) {
      issues.push(issue(block.id, index, block.type, 'text', 'Quote text is required', 'quote.empty'));
    }

    // Citation URL validation
    const citation = data.citation ?? data.citation?.url;
    if (citation && typeof citation === 'string' && citation.startsWith('http') && !isUrl(citation)) {
      issues.push(issue(block.id, index, block.type, 'citation', 'Citation URL is invalid', 'quote.invalid-citation-url', 'warning'));
    }

    return issues;
  },

  // ---- Code ----
  [BlockType.CODE]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!isNonEmpty(data.code)) {
      issues.push(issue(block.id, index, block.type, 'code', 'Code block is empty', 'code.empty', 'warning'));
    }

    if (!isNonEmpty(data.language)) {
      issues.push(issue(block.id, index, block.type, 'language', 'Language is not specified — syntax highlighting may not work', 'code.no-language', 'info'));
    }

    if (typeof data.code === 'string' && data.code.length > 50_000) {
      issues.push(issue(block.id, index, block.type, 'code', 'Code block exceeds 50 000 characters', 'code.too-long', 'warning'));
    }

    return issues;
  },

  // ---- Embed ----
  [BlockType.EMBED]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!isNonEmpty(data.url)) {
      issues.push(issue(block.id, index, block.type, 'url', 'Embed URL is required', 'embed.no-url'));
    } else if (!isUrl(data.url)) {
      issues.push(issue(block.id, index, block.type, 'url', 'Embed URL is not valid', 'embed.invalid-url'));
    }

    return issues;
  },

  // ---- Table ----
  [BlockType.TABLE]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!Array.isArray(data.rows) || data.rows.length === 0) {
      issues.push(issue(block.id, index, block.type, 'rows', 'Table must have at least one row', 'table.empty'));
      return issues;
    }

    // Check for inconsistent column counts
    const colCounts = data.rows.map((r: any) => (Array.isArray(r.cells) ? r.cells.length : Array.isArray(r) ? r.length : 0));
    const uniqueCounts = [...new Set(colCounts)];
    if (uniqueCounts.length > 1) {
      issues.push(issue(block.id, index, block.type, 'rows', 'Table rows have inconsistent column counts', 'table.inconsistent-columns', 'warning'));
    }

    // Check for totally empty table
    const allEmpty = data.rows.every((r: any) => {
      const cells = r.cells ?? r;
      return Array.isArray(cells) && cells.every((c: any) => !c || (typeof c === 'string' && !c.trim()));
    });
    if (allEmpty) {
      issues.push(issue(block.id, index, block.type, 'rows', 'All table cells are empty', 'table.all-empty', 'warning'));
    }

    return issues;
  },

  // ---- FAQ ----
  [BlockType.FAQ]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!Array.isArray(data.items) || data.items.length === 0) {
      issues.push(issue(block.id, index, block.type, 'items', 'FAQ must have at least one question', 'faq.empty'));
      return issues;
    }

    if (data.items.length > 50) {
      issues.push(issue(block.id, index, block.type, 'items', 'FAQ block exceeds 50 items (schema constraint)', 'faq.too-many-items'));
    }

    const seenQuestions = new Set<string>();

    data.items.forEach((item: any, i: number) => {
      const q = typeof item.question === 'string' ? item.question : '';
      const a = typeof item.answer === 'string' ? item.answer : '';

      if (!q.trim()) {
        issues.push(issue(block.id, index, block.type, `items[${i}].question`, `FAQ item ${i + 1} has no question`, 'faq.empty-question'));
      }
      if (!a.trim()) {
        issues.push(issue(block.id, index, block.type, `items[${i}].answer`, `FAQ item ${i + 1} has no answer`, 'faq.empty-answer'));
      }

      const normalizedQuestion = q.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalizedQuestion) {
        if (seenQuestions.has(normalizedQuestion)) {
          issues.push(issue(block.id, index, block.type, `items[${i}].question`, `FAQ item ${i + 1} duplicates a previous question`, 'faq.duplicate-question', 'warning'));
        }
        seenQuestions.add(normalizedQuestion);
      }

      if (q.length > 300) {
        issues.push(issue(block.id, index, block.type, `items[${i}].question`, `FAQ item ${i + 1} question exceeds 300 characters`, 'faq.question-too-long', 'warning'));
      }

      if (a.length > 5000) {
        issues.push(issue(block.id, index, block.type, `items[${i}].answer`, `FAQ item ${i + 1} answer exceeds 5000 characters`, 'faq.answer-too-long', 'warning'));
      }
    });

    return issues;
  },

  // ---- Highlight ----
  [BlockType.HIGHLIGHT]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};
    const text = typeof data.text === 'string' ? data.text : getBlockText(block);

    if (!text.trim()) {
      issues.push(issue(block.id, index, block.type, 'text', 'Highlight block text is required', 'highlight.empty'));
    }

    const validTypes = ['info', 'success', 'warning', 'error', 'tip', 'note'];
    if (data.type && !validTypes.includes(data.type) && data.style && !validTypes.includes(data.style)) {
      issues.push(issue(block.id, index, block.type, 'type', `Invalid highlight type: "${data.type || data.style}"`, 'highlight.invalid-type'));
    }

    return issues;
  },

  // ---- Divider ----
  [BlockType.DIVIDER]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    const validStyles = ['line', 'dots', 'asterisks', 'wave', 'custom'];
    if (data.style && !validStyles.includes(data.style)) {
      issues.push(issue(block.id, index, block.type, 'style', `Invalid divider style: "${data.style}"`, 'divider.invalid-style'));
    }

    return issues;
  },

  // ---- CTA ----
  [BlockType.CTA]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!isNonEmpty(data.title)) {
      issues.push(issue(block.id, index, block.type, 'title', 'CTA title is required', 'cta.no-title'));
    }

    // Flat shape: buttonText / buttonUrl
    if (data.buttonText !== undefined || data.buttonUrl !== undefined) {
      if (!isNonEmpty(data.buttonText)) {
        issues.push(issue(block.id, index, block.type, 'buttonText', 'CTA button text is required', 'cta.no-button-text'));
      }
      if (!isNonEmpty(data.buttonUrl)) {
        issues.push(issue(block.id, index, block.type, 'buttonUrl', 'CTA button URL is required', 'cta.no-button-url'));
      } else if (!isUrl(data.buttonUrl)) {
        issues.push(issue(block.id, index, block.type, 'buttonUrl', 'CTA button URL is invalid', 'cta.invalid-button-url'));
      }
    }

    // Rich shape: buttons[]
    if (Array.isArray(data.buttons)) {
      if (data.buttons.length === 0) {
        issues.push(issue(block.id, index, block.type, 'buttons', 'CTA must have at least one button', 'cta.no-buttons'));
      }
      data.buttons.forEach((btn: any, i: number) => {
        if (!isNonEmpty(btn.text)) {
          issues.push(issue(block.id, index, block.type, `buttons[${i}].text`, `Button ${i + 1} text is required`, 'cta.button-no-text'));
        }
        if (!isNonEmpty(btn.url)) {
          issues.push(issue(block.id, index, block.type, `buttons[${i}].url`, `Button ${i + 1} URL is required`, 'cta.button-no-url'));
        } else if (!isUrl(btn.url)) {
          issues.push(issue(block.id, index, block.type, `buttons[${i}].url`, `Button ${i + 1} URL is invalid`, 'cta.button-invalid-url'));
        }
      });
    }

    return issues;
  },

  // ---- Gallery ----
  [BlockType.GALLERY]: (block, index) => {
    const issues: BlockValidationIssue[] = [];
    const data = block.data ?? block.content ?? {};

    if (!Array.isArray(data.images) || data.images.length === 0) {
      issues.push(issue(block.id, index, block.type, 'images', 'Gallery must have at least one image', 'gallery.empty'));
      return issues;
    }

    data.images.forEach((img: any, i: number) => {
      if (!isNonEmpty(img.src)) {
        issues.push(issue(block.id, index, block.type, `images[${i}].src`, `Image ${i + 1} has no source URL`, 'gallery.image-no-src'));
      }
      if (!isNonEmpty(img.alt)) {
        issues.push(issue(block.id, index, block.type, `images[${i}].alt`, `Image ${i + 1} is missing alt text`, 'gallery.image-no-alt', 'warning'));
      }
    });

    return issues;
  },
};

// ============================================================================
// STRUCTURAL VALIDATORS (cross-block)
// ============================================================================

function validateStructure(blocks: any[]): BlockValidationIssue[] {
  const issues: BlockValidationIssue[] = [];

  // 1. No content at all
  if (blocks.length === 0) {
    issues.push(issue('', -1, '', 'blocks', 'Post has no content blocks', 'structure.empty'));
    return issues;
  }

  // 2. Heading hierarchy — H1 should appear at most once, levels shouldn't skip
  const headings = blocks
    .map((b, i) => ({ block: b, index: i }))
    .filter((b) => b.block.type === BlockType.HEADING || b.block.type === 'heading');

  const h1s = headings.filter((h) => (h.block.data ?? h.block.content)?.level === 1);
  if (h1s.length > 1) {
    h1s.slice(1).forEach((h) => {
      issues.push(issue(h.block.id, h.index, 'heading', 'level', 'Multiple H1 headings — use only one H1 per post', 'structure.multiple-h1', 'warning'));
    });
  }

  let prevLevel = 0;
  for (const h of headings) {
    const level = (h.block.data ?? h.block.content)?.level ?? 2;
    if (prevLevel > 0 && level > prevLevel + 1) {
      issues.push(issue(
        h.block.id, h.index, 'heading', 'level',
        `Heading level skipped from H${prevLevel} to H${level}`,
        'structure.heading-skip', 'warning',
      ));
    }
    prevLevel = level;
  }

  // 3. Consecutive dividers
  for (let i = 1; i < blocks.length; i++) {
    const curr = blocks[i].type;
    const prev = blocks[i - 1].type;
    if ((curr === BlockType.DIVIDER || curr === 'divider') && (prev === BlockType.DIVIDER || prev === 'divider')) {
      issues.push(issue(blocks[i].id, i, 'divider', '', 'Consecutive dividers detected', 'structure.consecutive-dividers', 'warning'));
    }
  }

  // 4. Excessive empty paragraphs in a row
  let emptyStreak = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const isParagraph = b.type === BlockType.PARAGRAPH || b.type === 'paragraph';
    const text = isParagraph ? getBlockText(b) : 'x';
    if (isParagraph && !text.trim()) {
      emptyStreak++;
      if (emptyStreak >= 3) {
        issues.push(issue(b.id, i, 'paragraph', 'text', 'Multiple consecutive empty paragraphs', 'structure.excessive-empty-paragraphs', 'info'));
        emptyStreak = 0; // Only warn once per streak
      }
    } else {
      emptyStreak = 0;
    }
  }

  // 5. FAQ schema cap (FAQPage supports up to 50 Q/A items per page)
  const faqBlocks = blocks
    .map((b, i) => ({ block: b, index: i }))
    .filter((entry) => entry.block.type === BlockType.FAQ || entry.block.type === 'faq');

  const totalFaqItems = faqBlocks.reduce((count, entry) => {
    const data = entry.block.data ?? entry.block.content ?? {};
    return count + (Array.isArray(data.items) ? data.items.length : 0);
  }, 0);

  if (totalFaqItems > 50) {
    const firstFaq = faqBlocks[0];
    issues.push(issue(
      firstFaq?.block?.id ?? '',
      firstFaq?.index ?? -1,
      BlockType.FAQ,
      'items',
      `Total FAQ items (${totalFaqItems}) exceed schema limit of 50 per page`,
      'faq.schema-max-items',
    ));
  }

  return issues;
}

// ============================================================================
// POST-LEVEL VALIDATORS (for publish readiness)
// ============================================================================

function validatePostMeta(meta: PostMeta): BlockValidationIssue[] {
  const issues: BlockValidationIssue[] = [];

  if (!isNonEmpty(meta.title)) {
    issues.push(issue('', -1, '', 'title', 'Post title is required', 'post.no-title'));
  } else if (meta.title!.length > 100) {
    issues.push(issue('', -1, '', 'title', 'Post title is too long (> 100 chars)', 'post.title-too-long', 'warning'));
  }

  if (!isNonEmpty(meta.slug)) {
    issues.push(issue('', -1, '', 'slug', 'Post URL slug is required', 'post.no-slug'));
  }

  if (!isNonEmpty(meta.excerpt)) {
    issues.push(issue('', -1, '', 'excerpt', 'Post excerpt is recommended for SEO', 'post.no-excerpt', 'warning'));
  } else if (meta.excerpt!.length > 300) {
    issues.push(issue('', -1, '', 'excerpt', 'Excerpt exceeds 300 characters', 'post.excerpt-too-long', 'warning'));
  }

  // SEO checks
  if (meta.seoTitle && meta.seoTitle.length > 60) {
    issues.push(issue('', -1, '', 'seoTitle', 'SEO title exceeds 60 characters', 'seo.title-too-long', 'warning'));
  }

  if (meta.seoDescription && meta.seoDescription.length > 160) {
    issues.push(issue('', -1, '', 'seoDescription', 'Meta description exceeds 160 characters', 'seo.description-too-long', 'warning'));
  }

  if (!isNonEmpty(meta.featuredImage)) {
    issues.push(issue('', -1, '', 'featuredImage', 'Featured image is recommended', 'post.no-featured-image', 'info'));
  } else if (meta.featuredImage && !isNonEmpty(meta.featuredImageAlt)) {
    issues.push(issue('', -1, '', 'featuredImageAlt', 'Featured image alt text is missing', 'post.no-featured-image-alt', 'warning'));
  }

  return issues;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validate a single block.
 */
export function validateBlock(block: any, index = 0): BlockValidationIssue[] {
  const type = block?.type;
  if (!type) {
    return [issue(block?.id ?? '', index, 'unknown', 'type', 'Block has no type', 'block.no-type')];
  }

  const validator = validators[type];
  if (!validator) {
    // Unknown type — not necessarily an error (extensibility), but warn
    return [issue(block.id, index, type, 'type', `No validator for block type "${type}"`, 'block.unknown-type', 'info')];
  }

  return validator(block, index);
}

/**
 * Validate an array of blocks, including per-block and structural checks.
 */
export function validateAllBlocks(blocks: any[]): BlockValidationResult {
  const issues: BlockValidationIssue[] = [];

  // Per-block
  for (let i = 0; i < blocks.length; i++) {
    issues.push(...validateBlock(blocks[i], i));
  }

  // Structural
  issues.push(...validateStructure(blocks));

  return buildResult(issues);
}

/**
 * Full pre-publish validation: blocks + structure + post metadata.
 */
export function validatePostForPublish(
  blocks: any[],
  meta: PostMeta,
): BlockValidationResult {
  const issues: BlockValidationIssue[] = [];

  // Per-block
  for (let i = 0; i < blocks.length; i++) {
    issues.push(...validateBlock(blocks[i], i));
  }

  // Structural
  issues.push(...validateStructure(blocks));

  // Post meta
  issues.push(...validatePostMeta(meta));

  return buildResult(issues);
}

/**
 * Lightweight check – returns true when there are no errors (warnings OK).
 */
export function isContentValid(blocks: any[]): boolean {
  return validateAllBlocks(blocks).isValid;
}

// ============================================================================
// INTERNAL
// ============================================================================

function buildResult(issues: BlockValidationIssue[]): BlockValidationResult {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;

  const issuesByBlock: Record<string, BlockValidationIssue[]> = {};
  for (const i of issues) {
    const key = i.blockId || '__post__';
    if (!issuesByBlock[key]) issuesByBlock[key] = [];
    issuesByBlock[key].push(i);
  }

  return {
    isValid: errors === 0,
    isPublishReady: errors === 0 && !issues.some((i) => i.rule.startsWith('post.no-')),
    issues,
    issuesByBlock,
    counts: { errors, warnings, info },
  };
}
