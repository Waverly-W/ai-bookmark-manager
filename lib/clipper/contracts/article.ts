import { z } from 'zod';
import {
  MAX_ARTICLE_BYLINE_UTF8_BYTES,
  MAX_ARTICLE_EXCERPT_UTF8_BYTES,
  MAX_ARTICLE_LANG_UTF8_BYTES,
  MAX_ARTICLE_PUBLISHED_UTF8_BYTES,
  MAX_ARTICLE_SITE_NAME_UTF8_BYTES,
  MAX_ARTICLE_TITLE_UTF8_BYTES,
  MAX_ARTICLE_URL_UTF8_BYTES,
  dataUrlDecodedUpperBound,
  MAX_IMAGE_ALT_UTF8_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_FILENAME_UTF8_BYTES,
  MAX_IMAGE_REFERENCES,
  MAX_IMAGE_REFERENCES_UTF8_BYTES,
  MAX_PREPARED_CLIP_UTF8_BYTES,
  withinJsonStringWireLimit,
  withinJsonValueWireLimit,
} from './limits';

function boundedString(maximum: number, message: string) {
  return z.string().refine((value) => withinJsonStringWireLimit(value, maximum), message);
}

const httpUrlSchema = boundedString(
  MAX_ARTICLE_URL_UTF8_BYTES,
  'URL exceeds the article field size limit',
).pipe(z.url({ protocol: /^https?$/ }));

function isValidImageDataUrl(value: string): boolean {
  if (!value.startsWith('data:')) return false;
  const comma = value.indexOf(',');
  if (comma < 0) return false;
  const [rawMime, ...parameters] = value.slice(5, comma).split(';');
  const mime = (rawMime ?? '').toLowerCase();
  const payload = value.slice(comma + 1);
  if (!payload || parameters.at(-1)?.toLowerCase() !== 'base64') {
    return false;
  }
  if (dataUrlDecodedUpperBound(payload) > MAX_IMAGE_BYTES) return false;

  if (!/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(payload)) {
    return false;
  }

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
  } catch {
    return false;
  }

  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (mime === 'image/png') return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mime === 'image/jpeg') return startsWith(0xff, 0xd8, 0xff);
  if (mime === 'image/gif') {
    return startsWith(0x47, 0x49, 0x46, 0x38, 0x37, 0x61)
      || startsWith(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
  }
  if (mime === 'image/webp') {
    return startsWith(0x52, 0x49, 0x46, 0x46)
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

export const imageSourceUrlSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
    return url.protocol === 'data:' && isValidImageDataUrl(value);
  } catch {
    return false;
  }
}, 'Image source must use HTTP(S) or an image data URL');

export const articleMetadataSchema = z.object({
  title: boundedString(MAX_ARTICLE_TITLE_UTF8_BYTES, 'Article title exceeds the size limit'),
  sourceUrl: httpUrlSchema,
  byline: boundedString(
    MAX_ARTICLE_BYLINE_UTF8_BYTES,
    'Article byline exceeds the size limit',
  ).nullable(),
  excerpt: boundedString(
    MAX_ARTICLE_EXCERPT_UTF8_BYTES,
    'Article excerpt exceeds the size limit',
  ).nullable(),
  siteName: boundedString(
    MAX_ARTICLE_SITE_NAME_UTF8_BYTES,
    'Article site name exceeds the size limit',
  ).nullable(),
  lang: boundedString(
    MAX_ARTICLE_LANG_UTF8_BYTES,
    'Article language exceeds the size limit',
  ).nullable(),
  published: boundedString(
    MAX_ARTICLE_PUBLISHED_UTF8_BYTES,
    'Article publication date exceeds the size limit',
  ).nullable(),
  canonicalUrl: httpUrlSchema.nullable(),
});

export type ArticleMetadata = z.infer<typeof articleMetadataSchema>;

export const imageReferenceSchema = z.object({
  token: z.string().regex(/^__W2O_IMAGE_[0-9a-f]{16,64}__$/),
  sourceUrl: imageSourceUrlSchema,
  alt: boundedString(MAX_IMAGE_ALT_UTF8_BYTES, 'Image alt text exceeds the size limit'),
  suggestedFilename: boundedString(
    MAX_IMAGE_FILENAME_UTF8_BYTES,
    'Image filename exceeds the size limit',
  ).pipe(z.string().min(1)),
});

export type ImageReference = z.infer<typeof imageReferenceSchema>;

export const imageReferencesSchema = z.unknown().superRefine((value, context) => {
  if (!Array.isArray(value)) return;
  if (value.length > MAX_IMAGE_REFERENCES) {
    context.addIssue({ code: 'custom', message: 'Too many image references' });
    return;
  }
  if (!withinJsonValueWireLimit(value, MAX_IMAGE_REFERENCES_UTF8_BYTES)) {
    context.addIssue({
      code: 'custom',
      message: 'Image references exceed the aggregate size limit',
    });
  }
}).pipe(z.array(imageReferenceSchema).max(MAX_IMAGE_REFERENCES));

export const extractedArticleSchema = articleMetadataSchema.extend({
  contentHtml: z.string().refine(
    (value) => withinJsonStringWireLimit(value, MAX_PREPARED_CLIP_UTF8_BYTES),
    'Article HTML exceeds the prepared clip size limit',
  ),
  textLength: z.int().nonnegative(),
});

export type ExtractedArticle = z.infer<typeof extractedArticleSchema>;

// Compatibility name for extraction implementations introduced in Task 3.
export const articleExtractionResultSchema = extractedArticleSchema;
export type ArticleExtractionResult = ExtractedArticle;
