const MIME_EXTENSIONS = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/bmp': ['bmp'],
  'image/avif': ['avif'],
} as const;

type SupportedImageMime = keyof typeof MIME_EXTENSIONS;

export function normalizeImageContentType(contentType: string): SupportedImageMime {
  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized || !(normalized in MIME_EXTENSIONS)) {
    throw new Error('Unsupported image content type');
  }
  return normalized as SupportedImageMime;
}

export function validatedImageExtension(
  filename: string,
  contentType: string,
): string {
  const mime = normalizeImageContentType(contentType);
  const supplied = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  const allowed = MIME_EXTENSIONS[mime];
  return supplied && (allowed as readonly string[]).includes(supplied)
    ? supplied
    : allowed[0];
}

export function sanitizeImageFilename(
  filename: string,
  contentType: string,
): string {
  const extension = validatedImageExtension(filename, contentType);
  const withoutExtension = filename.replace(/\.[a-z0-9]+$/i, '');
  const stem = withoutExtension
    .normalize('NFKC')
    .replace(/[\\/\0-\x1f\x7f]+/g, '-')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 120)
    .replace(/[. ]+$/g, '');
  return `${stem || 'image'}.${extension}`;
}

export function deriveImageFilename(
  sourceUrl: string,
  contentType: string,
): string {
  let candidate = 'image';
  try {
    const url = new URL(sourceUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const lastSegment = url.pathname.split('/').filter(Boolean).at(-1);
      if (lastSegment) {
        try {
          candidate = decodeURIComponent(lastSegment);
        } catch {
          candidate = lastSegment;
        }
      }
    }
  } catch {
    // A safe fallback is preferable to reflecting an untrusted malformed URL.
  }
  return sanitizeImageFilename(candidate, contentType);
}
