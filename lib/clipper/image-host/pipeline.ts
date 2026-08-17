import { imageReferenceSchema, type ImageReference } from '../contracts/article';
import { sanitizeImageFilename } from './fetch-image';
import { dataUrlDecodedUpperBound, MAX_IMAGE_BYTES } from '../contracts/limits';
import {
  ImageHostUploadError,
  type ImageHost,
  type ImageHostFetch,
  type ImageUpload,
} from './types';

const RETRY_DELAYS = [250, 750] as const;
const IMAGE_TOKEN = /__W2O_IMAGE_[0-9a-f]{16,64}__/g;
const EXACT_IMAGE_TOKEN = /^__W2O_IMAGE_[0-9a-f]{16,64}__$/;
const imageReferenceMetadataSchema = imageReferenceSchema.omit({ sourceUrl: true });
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

export interface UploadArticleImagesOptions {
  fetch?: ImageHostFetch;
  signal?: AbortSignal;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  onUploaded?: (
    sourceUrl: string,
    publicUrl: string,
    currentMap: Readonly<Record<string, string>>,
  ) => Promise<void>;
}

export interface UploadArticleImagesResult {
  markdown: string;
  uploaded: number;
  failed: number;
  urlMap: Record<string, string>;
}

class RetryableDownloadError extends Error {}

interface UploadOutcome {
  uploadedUrl?: string;
  sourceValidated: boolean;
}

function safeNetworkUrl(sourceUrl: string): URL | undefined {
  try {
    const url = new URL(sourceUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function normalizedMime(value: string | null): string | undefined {
  const mime = value?.split(';', 1)[0]?.trim().toLowerCase();
  return mime && ALLOWED_MIME_TYPES.has(mime) ? mime : undefined;
}

function dataUrlPayload(sourceUrl: string): string | undefined {
  const comma = sourceUrl.indexOf(',');
  if (comma < 0 || !/^data:/i.test(sourceUrl)) return undefined;
  return sourceUrl.slice(comma + 1);
}

function base64Padding(payload: string): number | undefined {
  if (payload.length === 0 || payload.length % 4 !== 0) return undefined;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const contentLength = payload.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = payload.charCodeAt(index);
    const valid = (code >= 0x30 && code <= 0x39)
      || (code >= 0x41 && code <= 0x5a)
      || (code >= 0x61 && code <= 0x7a)
      || code === 0x2b
      || code === 0x2f;
    if (!valid) return undefined;
  }
  return padding;
}

function dataUrlExceedsLimit(sourceUrl: string): boolean {
  const payload = dataUrlPayload(sourceUrl);
  if (payload === undefined) return false;
  return dataUrlDecodedUpperBound(payload) > MAX_IMAGE_BYTES;
}

function markdownDestination(sourceUrl: string): string | undefined {
  const networkUrl = safeNetworkUrl(sourceUrl);
  let normalized: string;
  if (networkUrl) normalized = networkUrl.href;
  else if (/^data:/i.test(sourceUrl) && dataUrlPayload(sourceUrl) !== undefined) {
    normalized = sourceUrl;
  } else return undefined;
  return `<${normalized}>`;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort and must not replace status/validation errors.
  }
}

function hasImageSignature(bytes: Uint8Array, mime: string): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (mime === 'image/png') {
    return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  }
  if (mime === 'image/jpeg') return startsWith(0xff, 0xd8, 0xff);
  if (mime === 'image/gif') {
    return startsWith(0x47, 0x49, 0x46, 0x38, 0x37, 0x61)
      || startsWith(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
  }
  return mime === 'image/webp'
    && startsWith(0x52, 0x49, 0x46, 0x46)
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}

function validateBytes(bytes: Uint8Array, mime: string): void {
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image exceeds size limit');
  if (!hasImageSignature(bytes, mime)) throw new Error('Image signature does not match MIME type');
}

function concatBytes(
  chunks: readonly Uint8Array[],
  total: number,
): Uint8Array {
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

async function readLimitedBody(
  response: Response,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const header = response.headers.get('content-length');
  if (header && /^\d+$/.test(header) && Number(header) > MAX_IMAGE_BYTES) {
    await cancelResponseBody(response);
    throw new Error('Image exceeds size limit');
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const onAbort = () => void reader.cancel(abortError(signal!)).catch(() => undefined);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the size-limit classification.
        }
        throw new Error('Image exceeds size limit');
      }
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      chunks.push(copy);
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  signal?.throwIfAborted();
  return concatBytes(chunks, total);
}

function decodeDataImage(sourceUrl: string): {
  bytes: Uint8Array;
  mime: string;
} {
  const match = /^data:([^;,]+)(?:;[^,]*)*;base64,([^,]*)$/i.exec(sourceUrl);
  if (!match) throw new Error('Invalid image data URL');
  const mime = normalizedMime(match[1] ?? null);
  if (!mime) throw new Error('Unsupported image content type');
  const payload = match[2]!;
  if (base64Padding(payload) === undefined) throw new Error('Invalid image data URL');
  if (Math.floor(payload.length * 3 / 4) > MAX_IMAGE_BYTES + 2) {
    throw new Error('Image exceeds size limit');
  }
  let decoded: string;
  try {
    decoded = globalThis.atob(payload);
  } catch {
    throw new Error('Invalid image data URL');
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  validateBytes(bytes, mime);
  return { bytes, mime };
}

async function downloadImage(
  reference: ImageReference,
  request: ImageHostFetch,
  signal?: AbortSignal,
): Promise<ImageUpload> {
  signal?.throwIfAborted();
  if (/^data:/i.test(reference.sourceUrl)) {
    const { bytes, mime } = decodeDataImage(reference.sourceUrl);
    return {
      blob: new Blob([bytes], { type: mime }),
      filename: sanitizeImageFilename(reference.suggestedFilename, mime),
      contentType: mime,
    };
  }

  const source = safeNetworkUrl(reference.sourceUrl);
  if (!source) throw new Error('Unsafe image URL');
  let response: Response;
  try {
    response = await request(source.href, { redirect: 'follow', signal });
  } catch (error) {
    if (signal?.aborted) throw abortError(signal);
    if (error instanceof TypeError) throw new RetryableDownloadError();
    throw error;
  }
  if (!response.ok) {
    await cancelResponseBody(response);
    if (response.status >= 500) throw new RetryableDownloadError();
    throw new Error('Image download was rejected');
  }
  if (response.url && !safeNetworkUrl(response.url)) {
    await cancelResponseBody(response);
    throw new Error('Unsafe image redirect');
  }
  const mime = normalizedMime(response.headers.get('content-type'));
  if (!mime) {
    await cancelResponseBody(response);
    throw new Error('Unsupported image content type');
  }
  const bytes = await readLimitedBody(response, signal);
  validateBytes(bytes, mime);
  return {
    blob: new Blob([bytes], { type: mime }),
    filename: sanitizeImageFilename(reference.suggestedFilename, mime),
    contentType: mime,
  };
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function retryable(error: unknown): boolean {
  return error instanceof RetryableDownloadError
    || (error instanceof ImageHostUploadError && error.retryable)
    || error instanceof TypeError;
}

async function attemptUpload(
  reference: ImageReference,
  host: ImageHost,
  request: ImageHostFetch,
  sleep: NonNullable<UploadArticleImagesOptions['sleep']>,
  onSourceValidated: () => void,
  signal?: AbortSignal,
): Promise<string> {
  let image: ImageUpload | undefined;
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      if (!image) {
        image = await downloadImage(reference, request, signal);
        onSourceValidated();
      }
      signal?.throwIfAborted();
      const url = await host.upload(image, signal);
      signal?.throwIfAborted();
      const publicUrl = safeNetworkUrl(url);
      if (!publicUrl) throw new Error('Image host returned an unsafe URL');
      return publicUrl.href;
    } catch (error) {
      if (signal?.aborted) throw abortError(signal);
      const delay = RETRY_DELAYS[attempt];
      if (delay === undefined || !retryable(error)) throw error;
      await sleep(delay, signal);
    }
  }
}

function shallowReference(candidate: ImageReference): ImageReference | undefined {
  const sourceUrl = typeof candidate?.sourceUrl === 'string' ? candidate.sourceUrl : undefined;
  if (!sourceUrl) return undefined;
  const metadata = imageReferenceMetadataSchema.safeParse(candidate);
  if (!metadata.success) return undefined;
  if (!safeNetworkUrl(sourceUrl) && !/^data:/i.test(sourceUrl)) return undefined;
  return { ...metadata.data, sourceUrl };
}

function applyTokenReplacements(
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string {
  return markdown.replace(IMAGE_TOKEN, (token) => replacements.get(token) ?? '');
}

export async function uploadArticleImages(
  markdown: string,
  imageReferences: readonly ImageReference[],
  host: ImageHost,
  options: UploadArticleImagesOptions = {},
): Promise<UploadArticleImagesResult> {
  options.signal?.throwIfAborted();
  const request = options.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep = options.sleep ?? defaultSleep;
  const firstSourceByToken = new Map<string, string>();
  const conflictingTokens = new Set<string>();
  const conflictingSources = new Set<string>();
  const rejectedSources = new Set<string>();
  const replacements = new Map<string, string>();
  const references: ImageReference[] = [];

  for (const candidate of imageReferences) {
    const token = typeof candidate?.token === 'string' && EXACT_IMAGE_TOKEN.test(candidate.token)
      ? candidate.token
      : undefined;
    const sourceUrl = typeof candidate?.sourceUrl === 'string'
      ? candidate.sourceUrl
      : undefined;
    if (token && sourceUrl) {
      const owner = firstSourceByToken.get(token);
      if (owner === undefined) firstSourceByToken.set(token, sourceUrl);
      else if (owner !== sourceUrl) {
        conflictingTokens.add(token);
        conflictingSources.add(owner);
        conflictingSources.add(sourceUrl);
      }
    }
    if (sourceUrl && /^data:/i.test(sourceUrl) && dataUrlExceedsLimit(sourceUrl)) {
      rejectedSources.add(sourceUrl);
      if (token) replacements.set(token, '');
      continue;
    }
    const parsed = shallowReference(candidate);
    if (!parsed) {
      if (sourceUrl) rejectedSources.add(sourceUrl);
      if (token) replacements.set(token, '');
      continue;
    }
    references.push(parsed);
  }

  for (const token of conflictingTokens) {
    const firstSource = firstSourceByToken.get(token)!;
    replacements.set(
      token,
      safeNetworkUrl(firstSource) ? markdownDestination(firstSource)! : '',
    );
  }
  for (const reference of references) {
    if (
      conflictingSources.has(reference.sourceUrl)
      && !conflictingTokens.has(reference.token)
    ) {
      replacements.set(
        reference.token,
        safeNetworkUrl(reference.sourceUrl)
          ? markdownDestination(reference.sourceUrl)!
          : '',
      );
    }
  }

  const groups = new Map<string, ImageReference[]>();
  for (const reference of references) {
    if (conflictingTokens.has(reference.token) || conflictingSources.has(reference.sourceUrl)) {
      continue;
    }
    const group = groups.get(reference.sourceUrl);
    if (group) group.push(reference);
    else groups.set(reference.sourceUrl, [reference]);
  }

  const jobs = [...groups.values()];
  const outcomes = new Map<string, UploadOutcome>();
  const checkpointedUrls: Record<string, string> = {};
  let checkpointFailure: unknown;
  let checkpointFailed = false;
  let checkpointQueue: Promise<void> = Promise.resolve();
  function checkpoint(sourceUrl: string, publicUrl: string): Promise<void> {
    const queued = checkpointQueue.then(async () => {
      if (checkpointFailed) throw checkpointFailure;
      const currentMap = { ...checkpointedUrls, [sourceUrl]: publicUrl };
      await options.onUploaded?.(sourceUrl, publicUrl, currentMap);
      checkpointedUrls[sourceUrl] = publicUrl;
    });
    checkpointQueue = queued.catch((error) => {
      checkpointFailure = error;
      checkpointFailed = true;
    });
    return queued;
  }
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      options.signal?.throwIfAborted();
      const index = next++;
      const group = jobs[index];
      if (!group) return;
      const primary = group[0]!;
      const outcome: UploadOutcome = { sourceValidated: false };
      try {
        outcome.uploadedUrl = await attemptUpload(
          primary,
          host,
          request,
          sleep,
          () => { outcome.sourceValidated = true; },
          options.signal,
        );
        // Remote upload and IndexedDB cannot be one transaction. This awaited
        // callback is the narrowest possible checkpoint boundary; termination
        // between host success and callback entry remains an inherent gap.
        await checkpoint(primary.sourceUrl, outcome.uploadedUrl);
      } catch (error) {
        if (checkpointFailed && checkpointFailure === error) throw error;
        if (options.signal?.aborted) throw abortError(options.signal);
      }
      outcomes.set(primary.sourceUrl, outcome);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, () => worker()));

  const urlMap: Record<string, string> = {};
  let uploaded = 0;
  const failedBeforeUpload = new Set([...rejectedSources, ...conflictingSources]);
  let failed = [...failedBeforeUpload].filter((sourceUrl) => !groups.has(sourceUrl)).length;
  for (const group of jobs) {
    const sourceUrl = group[0]!.sourceUrl;
    const outcome = outcomes.get(sourceUrl) ?? { sourceValidated: false };
    const uploadedUrl = outcome.uploadedUrl;
    if (uploadedUrl) {
      uploaded += 1;
      urlMap[sourceUrl] = uploadedUrl;
    } else {
      failed += 1;
    }
    for (const reference of group) {
      const fallback = safeNetworkUrl(reference.sourceUrl)
        ? markdownDestination(reference.sourceUrl)
        : outcome.sourceValidated
          ? markdownDestination(reference.sourceUrl)
          : undefined;
      replacements.set(
        reference.token,
        uploadedUrl ? markdownDestination(uploadedUrl)! : fallback ?? '',
      );
    }
  }

  return {
    markdown: applyTokenReplacements(markdown, replacements),
    uploaded,
    failed,
    urlMap,
  };
}
