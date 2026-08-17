import { Readability } from '@mozilla/readability';

import {
  extractedArticleSchema,
  type ExtractedArticle,
} from '../contracts/article';
import { collectMetadata } from './metadata';
import { normalizeDocument } from './normalize-document';

export const CONTENT_MIN_LENGTH = 200;

export type ExtractionErrorCode = 'READABILITY_EMPTY' | 'CONTENT_TOO_SHORT';

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

function cleanedTextLength(document: Document, contentHtml: string): number {
  const container = document.createElement('div');
  container.innerHTML = contentHtml;
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim().length;
}

function readableValue(
  primary: string | null | undefined,
  fallback: string | null,
): string | null {
  const cleanedPrimary = primary?.trim();
  return cleanedPrimary || fallback;
}

export function extractArticle(
  document: Document,
  pageUrl: string,
): ExtractedArticle {
  const metadata = collectMetadata(document, pageUrl);
  const clone = normalizeDocument(document, pageUrl);
  const parsed = new Readability(clone, { keepClasses: false }).parse();

  if (!parsed?.content) {
    throw new ExtractionError(
      'READABILITY_EMPTY',
      'Readability did not return article content.',
    );
  }

  const textLength = cleanedTextLength(clone, parsed.content);
  if (textLength === 0) {
    throw new ExtractionError(
      'READABILITY_EMPTY',
      'Readability returned article content without text.',
    );
  }
  if (textLength < CONTENT_MIN_LENGTH) {
    throw new ExtractionError(
      'CONTENT_TOO_SHORT',
      `Extracted article text is shorter than ${CONTENT_MIN_LENGTH} characters.`,
    );
  }

  return extractedArticleSchema.parse({
    title: readableValue(parsed.title, metadata.title) ?? '',
    sourceUrl: metadata.sourceUrl,
    byline: readableValue(parsed.byline, metadata.byline),
    excerpt: readableValue(parsed.excerpt, metadata.excerpt),
    siteName: readableValue(parsed.siteName, metadata.siteName),
    lang: readableValue(parsed.lang, metadata.lang),
    published: readableValue(parsed.publishedTime, metadata.published),
    canonicalUrl: metadata.canonicalUrl,
    contentHtml: parsed.content,
    textLength,
  });
}
