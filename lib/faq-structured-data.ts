interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQSchemaValidationIssue {
  code: string;
  message: string;
  itemIndex?: number;
}

export interface FAQSchemaValidationResult {
  isValid: boolean;
  errors: FAQSchemaValidationIssue[];
  validItems: FAQItem[];
}

const MAX_FAQ_ITEMS_PER_PAGE = 50;
const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 5000;

function toPlainText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((node) => {
        if (typeof node === 'string') return node;
        if (node && typeof node === 'object' && 'text' in node && typeof (node as any).text === 'string') {
          return (node as any).text;
        }
        return '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}

export function extractFAQItemsFromContent(content: any): FAQItem[] {
  if (!content || !Array.isArray(content.blocks)) {
    return [];
  }

  const items: FAQItem[] = [];

  for (const block of content.blocks) {
    if (!block || block.type !== 'faq') {
      continue;
    }

    const blockData = block.data ?? block.content ?? {};
    if (!Array.isArray(blockData.items)) {
      continue;
    }

    for (const item of blockData.items) {
      items.push({
        question: toPlainText(item?.question),
        answer: toPlainText(item?.answer),
      });
    }
  }

  return items;
}

export function validateFAQSchemaConstraints(content: any): FAQSchemaValidationResult {
  const rawItems = extractFAQItemsFromContent(content);
  const errors: FAQSchemaValidationIssue[] = [];
  const validItems: FAQItem[] = [];
  const seenQuestions = new Set<string>();

  if (rawItems.length > MAX_FAQ_ITEMS_PER_PAGE) {
    errors.push({
      code: 'faq.schema.max-items',
      message: `FAQ schema supports at most ${MAX_FAQ_ITEMS_PER_PAGE} items per page; received ${rawItems.length}.`,
    });
  }

  rawItems.forEach((item, index) => {
    if (!item.question) {
      errors.push({
        code: 'faq.schema.empty-question',
        message: `FAQ item ${index + 1} is missing a question.`,
        itemIndex: index,
      });
      return;
    }

    if (!item.answer) {
      errors.push({
        code: 'faq.schema.empty-answer',
        message: `FAQ item ${index + 1} is missing an answer.`,
        itemIndex: index,
      });
      return;
    }

    if (item.question.length > MAX_QUESTION_LENGTH) {
      errors.push({
        code: 'faq.schema.question-too-long',
        message: `FAQ item ${index + 1} question exceeds ${MAX_QUESTION_LENGTH} characters.`,
        itemIndex: index,
      });
      return;
    }

    if (item.answer.length > MAX_ANSWER_LENGTH) {
      errors.push({
        code: 'faq.schema.answer-too-long',
        message: `FAQ item ${index + 1} answer exceeds ${MAX_ANSWER_LENGTH} characters.`,
        itemIndex: index,
      });
      return;
    }

    const normalizedQuestion = item.question.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenQuestions.has(normalizedQuestion)) {
      errors.push({
        code: 'faq.schema.duplicate-question',
        message: `FAQ item ${index + 1} duplicates a previous question.`,
        itemIndex: index,
      });
      return;
    }

    seenQuestions.add(normalizedQuestion);
    validItems.push(item);
  });

  return {
    isValid: errors.length === 0,
    errors,
    validItems,
  };
}

export function buildFAQStructuredData(items: FAQItem[]): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function attachFAQStructuredDataToContent(content: any): any {
  if (!content || !Array.isArray(content.blocks)) {
    return content;
  }

  const { validItems } = validateFAQSchemaConstraints(content);
  if (validItems.length === 0) {
    return content;
  }

  const faqSchema = buildFAQStructuredData(validItems);
  const metadata = content.metadata ?? {};
  const structuredData = metadata.structuredData ?? {};

  return {
    ...content,
    metadata: {
      ...metadata,
      structuredData: {
        ...structuredData,
        faq: faqSchema,
      },
    },
  };
}