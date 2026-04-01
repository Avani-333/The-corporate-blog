import { load } from 'cheerio';

export interface SchemaValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SchemaValidationResult {
  eligible: boolean;
  issues: SchemaValidationIssue[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseJsonLdScripts(html: string): any[] {
  const $ = load(html);
  const schemas: any[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '{}';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch {
      // Ignore invalid JSON-LD blocks; this validator only inspects valid JSON.
    }
  });

  return schemas;
}

export function validateFAQRichResultEligibility(html: string): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const schemas = parseJsonLdScripts(html);
  const faqSchema = schemas.find((schema) => schema?.['@type'] === 'FAQPage');

  if (!faqSchema) {
    issues.push({
      code: 'faq.schema.missing',
      message: 'No FAQPage schema found in JSON-LD.',
      severity: 'error',
    });
    return { eligible: false, issues };
  }

  const entities = Array.isArray(faqSchema.mainEntity) ? faqSchema.mainEntity : [];
  if (entities.length === 0) {
    issues.push({
      code: 'faq.schema.empty-main-entity',
      message: 'FAQPage.mainEntity must contain at least one Question.',
      severity: 'error',
    });
    return { eligible: false, issues };
  }

  if (entities.length > 50) {
    issues.push({
      code: 'faq.schema.too-many-items',
      message: 'FAQPage contains more than 50 Question items.',
      severity: 'error',
    });
  }

  const bodyText = normalizeText(load(html)('body').text() || '');

  entities.forEach((entity: any, index: number) => {
    const question = typeof entity?.name === 'string' ? entity.name.trim() : '';
    const answer = typeof entity?.acceptedAnswer?.text === 'string' ? entity.acceptedAnswer.text.trim() : '';

    if (entity?.['@type'] !== 'Question') {
      issues.push({
        code: 'faq.schema.invalid-question-type',
        message: `FAQ item ${index + 1} must have @type=Question.`,
        severity: 'error',
      });
    }

    if (!question) {
      issues.push({
        code: 'faq.schema.empty-question',
        message: `FAQ item ${index + 1} is missing Question.name.`,
        severity: 'error',
      });
    }

    if (!answer) {
      issues.push({
        code: 'faq.schema.empty-answer',
        message: `FAQ item ${index + 1} is missing acceptedAnswer.text.`,
        severity: 'error',
      });
    }

    if (question && !bodyText.includes(normalizeText(question))) {
      issues.push({
        code: 'faq.content.question-not-visible',
        message: `FAQ question ${index + 1} does not appear in visible page text.`,
        severity: 'warning',
      });
    }

    if (answer && !bodyText.includes(normalizeText(answer).slice(0, Math.min(50, answer.length)))) {
      issues.push({
        code: 'faq.content.answer-not-visible',
        message: `FAQ answer ${index + 1} may not be visible on-page.`,
        severity: 'warning',
      });
    }
  });

  const eligible = !issues.some((issue) => issue.severity === 'error');
  return { eligible, issues };
}

export function validateAuthorEEATSchemaIntegrity(html: string): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const schemas = parseJsonLdScripts(html);

  const articleSchema = schemas.find((schema) => schema?.['@type'] === 'Article');
  const personSchemas = schemas.filter((schema) => schema?.['@type'] === 'Person');

  if (!articleSchema) {
    issues.push({
      code: 'author.article-schema.missing',
      message: 'Article schema is missing, so author E-E-A-T signals cannot be evaluated.',
      severity: 'error',
    });
    return { eligible: false, issues };
  }

  const articleAuthor = articleSchema.author;
  const articleAuthorName = typeof articleAuthor?.name === 'string' ? articleAuthor.name.trim() : '';
  const articleAuthorId = typeof articleAuthor?.['@id'] === 'string' ? articleAuthor['@id'] : '';

  if (!articleAuthor || articleAuthor?.['@type'] !== 'Person') {
    issues.push({
      code: 'author.article-schema.invalid-author-type',
      message: 'Article.author must be a Person object.',
      severity: 'error',
    });
  }

  if (!articleAuthorName) {
    issues.push({
      code: 'author.article-schema.missing-name',
      message: 'Article.author.name is required.',
      severity: 'error',
    });
  }

  if (!articleAuthor?.url) {
    issues.push({
      code: 'author.article-schema.missing-url',
      message: 'Article.author.url is missing.',
      severity: 'warning',
    });
  }

  const matchingPerson = personSchemas.find((schema) => {
    if (articleAuthorId && schema?.['@id'] === articleAuthorId) return true;
    return articleAuthorName && schema?.name === articleAuthorName;
  });

  if (!matchingPerson) {
    issues.push({
      code: 'author.person-schema.missing',
      message: 'No standalone Person schema matches Article.author.',
      severity: 'warning',
    });
  } else {
    if (!matchingPerson.description) {
      issues.push({
        code: 'author.person-schema.missing-description',
        message: 'Person.description is missing for author expertise context.',
        severity: 'warning',
      });
    }

    if (!matchingPerson.image) {
      issues.push({
        code: 'author.person-schema.missing-image',
        message: 'Person.image is missing, reducing trust signals.',
        severity: 'warning',
      });
    }

    if (!Array.isArray(matchingPerson.sameAs) || matchingPerson.sameAs.length === 0) {
      issues.push({
        code: 'author.person-schema.missing-sameAs',
        message: 'Person.sameAs links are missing, reducing external entity corroboration.',
        severity: 'warning',
      });
    }

    if (!matchingPerson.knowsAbout) {
      issues.push({
        code: 'author.person-schema.missing-knowsAbout',
        message: 'Person.knowsAbout is missing for topical expertise cues.',
        severity: 'warning',
      });
    }
  }

  const eligible = !issues.some((issue) => issue.severity === 'error');
  return { eligible, issues };
}
