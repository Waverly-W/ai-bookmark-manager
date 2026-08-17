import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import {
  type R2Settings,
} from '../contracts/settings';
import {
  normalizeImageContentType,
  validatedImageExtension,
} from './fetch-image';
import { r2RuntimeSettingsSchema } from './r2-settings';
import { ImageHostUploadError, type ImageHost } from './types';

export interface R2Dependencies {
  now?: () => Date;
  requestHandler?: S3ClientConfig['requestHandler'];
}

function sanitizePrefixSegment(segment: string): string {
  const sanitized = segment
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return truncateCodePoints(sanitized, 80).replace(/[.-]+$/g, '');
}

function truncateCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join('');
}

export function sanitizeR2KeyPrefix(prefix: string): string {
  const sanitized = prefix
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .map(sanitizePrefixSegment)
    .filter(Boolean)
    .join('/');
  return truncateCodePoints(sanitized, 400).replace(/\/$/, '');
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = typeof blob.arrayBuffer === 'function'
    ? await blob.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read image data'));
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
  // FileReader in tests may return a cross-realm ArrayBuffer. Copying also
  // provides the fixed-length browser SDK body used for both hashing and upload.
  const source = new Uint8Array(buffer);
  const bytes = new Uint8Array(new ArrayBuffer(source.byteLength));
  bytes.set(source);
  return bytes;
}

async function sha256Prefix(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes,
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function encodeObjectKey(key: string): string {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function retryableR2Failure(error: unknown): boolean {
  try {
    if (typeof error === 'object' && error !== null) {
      const metadata = Reflect.get(error, '$metadata') as unknown;
      if (typeof metadata === 'object' && metadata !== null) {
        const status = Reflect.get(metadata, 'httpStatusCode') as unknown;
        if (typeof status === 'number') return status >= 500 && status < 600;
      }
    }
  } catch {
    return false;
  }
  return error instanceof TypeError;
}

export function createR2ImageHost(
  untrustedSettings: R2Settings,
  dependencies: R2Dependencies = {},
): ImageHost {
  const settings = r2RuntimeSettingsSchema.parse(untrustedSettings);
  const prefix = sanitizeR2KeyPrefix(settings.keyPrefix);
  const client = new S3Client({
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    maxAttempts: 1,
    region: 'auto',
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    ...(dependencies.requestHandler
      ? { requestHandler: dependencies.requestHandler }
      : {}),
  });
  const now = dependencies.now ?? (() => new Date());
  const publicBaseUrlWithSlash = settings.publicBaseUrl.endsWith('/')
    ? settings.publicBaseUrl
    : `${settings.publicBaseUrl}/`;

  return {
    async upload(image, signal) {
      const date = now();
      if (Number.isNaN(date.getTime())) {
        throw new Error('R2 upload date is invalid');
      }
      const contentType = normalizeImageContentType(image.contentType);
      const extension = validatedImageExtension(image.filename, contentType);
      const datePath = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const bytes = await readBlobBytes(image.blob);
      const hash = await sha256Prefix(bytes);
      const key = [prefix, datePath, `${hash}.${extension}`].filter(Boolean).join('/');

      try {
        const command = new PutObjectCommand({
          Bucket: settings.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        });
        if (signal) await client.send(command, { abortSignal: signal });
        else await client.send(command);
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        throw new ImageHostUploadError(
          'R2 upload failed',
          retryableR2Failure(error),
        );
      }

      return new URL(encodeObjectKey(key), publicBaseUrlWithSlash).href;
    },
  };
}
