import type { ArticleMetadata } from '../contracts/article';

function contentOf(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const content = document.querySelector(selector)?.getAttribute('content')?.trim();
    if (content) {
      return content;
    }
  }
  return null;
}

function resolveHttpUrl(value: string | null, baseUrl: URL): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function metadataBaseUrl(document: Document, pageUrl: string): URL {
  const fallback = new URL(pageUrl);
  const baseHref =
    document.querySelector('base[href]')?.getAttribute('href') ?? null;
  return new URL(resolveHttpUrl(baseHref, fallback) ?? fallback.href);
}

export function collectMetadata(
  document: Document,
  pageUrl: string,
): ArticleMetadata {
  const sourceUrl = new URL(pageUrl);
  const baseUrl = metadataBaseUrl(document, pageUrl);
  const canonicalHref =
    document
      .querySelector('link[rel~="canonical" i]')
      ?.getAttribute('href') ?? null;
  const publishedTime = document
    .querySelector('time[datetime]')
    ?.getAttribute('datetime')
    ?.trim();

  return {
    title:
      contentOf(document, [
        'meta[property="og:title" i]',
        'meta[name="twitter:title" i]',
      ]) ?? document.title.trim(),
    sourceUrl: sourceUrl.href,
    byline: contentOf(document, [
      'meta[name="author" i]',
      'meta[property="article:author" i]',
    ]),
    excerpt: contentOf(document, [
      'meta[property="og:description" i]',
      'meta[name="description" i]',
      'meta[name="twitter:description" i]',
    ]),
    siteName: contentOf(document, [
      'meta[property="og:site_name" i]',
      'meta[name="application-name" i]',
    ]),
    lang: document.documentElement.lang.trim() || null,
    published:
      contentOf(document, [
        'meta[property="article:published_time" i]',
        'meta[name="date" i]',
        'meta[name="datePublished" i]',
      ]) ?? publishedTime ?? null,
    canonicalUrl: resolveHttpUrl(canonicalHref, baseUrl),
  };
}
