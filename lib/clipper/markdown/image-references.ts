import { imageSourceUrlSchema, type ImageReference } from '../contracts/article';

export interface TokenizedImages {
  html: string;
  imageReferences: ImageReference[];
}

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
};

function resolveImageSource(source: string, baseUrl?: string): string | undefined {
  const trimmed = source.trim();
  if (!trimmed) return undefined;

  try {
    const resolved = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    return imageSourceUrlSchema.safeParse(resolved.href).success ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

async function sha256(sourceUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(sourceUrl);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class ImageTokenCollisionError extends Error {
  constructor(sourceUrl: string) {
    super(`Unable to create a collision-free image token for ${sourceUrl}`);
    this.name = 'ImageTokenCollisionError';
  }
}

function stableToken(
  sourceUrl: string,
  digest: string,
  collisionSources: readonly string[],
  occupiedTokens: ReadonlySet<string>,
): string {
  for (let prefixLength = 16; prefixLength <= 64; prefixLength += 8) {
    const token = `__W2O_IMAGE_${digest.slice(0, prefixLength)}__`;
    if (!collisionSources.some((source) => source.includes(token)) && !occupiedTokens.has(token)) {
      return token;
    }
  }
  throw new ImageTokenCollisionError(sourceUrl);
}

function safeBasename(pathname: string): string | undefined {
  const encodedName = pathname.split('/').pop();
  if (!encodedName) return undefined;

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(encodedName);
  } catch {
    decodedName = encodedName;
  }

  const safe = decodedName
    .replace(/[\u0000-\u001f\u007f/\\?%*:|"<>]/g, '-')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return safe || undefined;
}

function suggestedFilename(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return safeBasename(url.pathname) ?? 'image';
  }
  if (url.protocol === 'data:') {
    const mime = sourceUrl.slice(5).split(/[;,]/, 1)[0]?.toLowerCase() ?? '';
    return `image${MIME_EXTENSIONS[mime] ?? ''}`;
  }
  return 'image';
}

export async function tokenizeImages(
  html: string,
  baseUrl?: string,
  additionalCollisionSources: readonly string[] = [],
): Promise<TokenizedImages> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const sourceHtml = document.body.innerHTML;
  const collisionSources = [
    sourceHtml,
    document.body.textContent ?? '',
    ...Array.from(document.body.querySelectorAll('*')).flatMap((node) =>
      Array.from(node.attributes, (attribute) => attribute.value)),
    ...additionalCollisionSources,
  ];
  const referencesByUrl = new Map<string, ImageReference>();
  const occupiedTokens = new Set<string>();
  const imagesByUrl = new Map<string, { images: HTMLImageElement[]; alt: string }>();

  for (const image of Array.from(document.body.querySelectorAll('img'))) {
    const sourceUrl = resolveImageSource(image.getAttribute('src') ?? '', baseUrl);
    if (!sourceUrl) {
      image.remove();
      continue;
    }

    const existing = imagesByUrl.get(sourceUrl);
    if (existing) existing.images.push(image);
    else imagesByUrl.set(sourceUrl, { images: [image], alt: image.getAttribute('alt') ?? '' });
  }

  const uniqueImages = [...imagesByUrl.entries()];
  const digests = await Promise.all(uniqueImages.map(([sourceUrl]) => sha256(sourceUrl)));

  for (const [index, [sourceUrl, group]] of uniqueImages.entries()) {
    const reference = {
      token: stableToken(sourceUrl, digests[index]!, collisionSources, occupiedTokens),
      sourceUrl,
      alt: group.alt,
      suggestedFilename: suggestedFilename(sourceUrl),
    };
    referencesByUrl.set(sourceUrl, reference);
    occupiedTokens.add(reference.token);
    for (const image of group.images) image.setAttribute('src', reference.token);
  }

  return {
    html: document.body.innerHTML,
    imageReferences: [...referencesByUrl.values()],
  };
}
