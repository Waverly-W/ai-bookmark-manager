import { jobIdSchema } from '../contracts/job';
import { ensureReadWritePermission } from './permissions';
import { vaultWriteLock, type VaultWriteLock } from './lock';
import {
  MAX_FILENAME_CODE_POINTS,
  MAX_FILENAME_UTF8_BYTES,
  parseRelativeDirectory,
  sanitizeFilename,
  truncateFilenameComponent,
} from './path';

export const MAX_COLLISION_ATTEMPTS = 100;
export const RECEIPT_TAIL_BYTES = 128;

export class MarkdownPreparationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MarkdownPreparationError';
  }
}

export class IdempotencyKeyError extends Error {
  readonly code = 'INVALID_IDEMPOTENCY_KEY';

  constructor() {
    super('Idempotency key must be a lowercase canonical RFC 4122 UUID.');
    this.name = 'IdempotencyKeyError';
  }
}

export class VaultCollisionError extends Error {
  readonly code = 'COLLISION_LIMIT_EXCEEDED';

  constructor() {
    super('Could not find an unused note filename within the collision limit.');
    this.name = 'VaultCollisionError';
  }
}

export class VaultWriteCapabilityError extends Error {
  readonly code = 'UNSUPPORTED_FILE_WRITING';

  constructor(message: string) {
    super(message);
    this.name = 'VaultWriteCapabilityError';
  }
}

interface WriteNoteBase {
  vaultHandle: FileSystemDirectoryHandle;
  relativeDirectory: string;
  title: string;
  idempotencyKey?: string;
  writeLock?: VaultWriteLock;
}

export type WriteNoteInput = WriteNoteBase &
  (
    | { markdown: string; prepareMarkdown?: never }
    | {
        markdown?: never;
        prepareMarkdown: () => string | Promise<string>;
      }
  );

export interface WriteNoteResult {
  filename: string;
  relativePath: string;
  vaultName: string;
}

async function prepareMarkdown(input: WriteNoteInput): Promise<string> {
  let markdown: string;
  try {
    markdown =
      'prepareMarkdown' in input && input.prepareMarkdown
        ? await input.prepareMarkdown()
        : input.markdown;
  } catch (error) {
    throw new MarkdownPreparationError('Markdown preparation failed.', {
      cause: error,
    });
  }

  if (typeof markdown !== 'string' || markdown.trim() === '') {
    throw new MarkdownPreparationError('Prepared Markdown must not be empty.');
  }
  return markdown;
}

async function traverseDirectory(
  root: FileSystemDirectoryHandle,
  segments: readonly string[],
): Promise<FileSystemDirectoryHandle> {
  let directory = root;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create: true });
  }
  return directory;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function markdownStem(title: string): string {
  const safe = sanitizeFilename(title);
  const stem = safe.toLocaleLowerCase().endsWith('.md')
    ? safe.slice(0, -3)
    : safe;
  const limited = truncateFilenameComponent(
    stem,
    MAX_FILENAME_CODE_POINTS,
    MAX_FILENAME_UTF8_BYTES,
  );
  return limited || 'Untitled';
}

interface CreatedNoteFile {
  filename: string;
  file: FileSystemFileHandle;
  existingReceipt: boolean;
}

function idempotencyMarker(key: string | undefined): string | undefined {
  if (key === undefined) return undefined;
  if (!jobIdSchema.safeParse(key).success) throw new IdempotencyKeyError();
  const bytes = new TextEncoder().encode(key);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `<!-- web-to-obsidian:job:${encoded} -->`;
}

function markdownWithReceipt(markdown: string, marker: string | undefined): string {
  if (!marker) return markdown;
  return `${markdown}${markdown.endsWith('\n') ? '\n' : '\n\n'}${marker}`;
}

function tailHasCanonicalMarker(bytes: Uint8Array, marker: string): boolean {
  const encoder = new TextEncoder();
  for (const suffix of [`\n\n${marker}`, `\n\n${marker}\n`]) {
    const expected = encoder.encode(suffix);
    if (bytes.byteLength < expected.byteLength) continue;
    const start = bytes.byteLength - expected.byteLength;
    let matches = true;
    for (let index = 0; index < expected.byteLength; index += 1) {
      if (bytes[start + index] !== expected[index]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(start),
    );
    if (decoded === suffix) return true;
  }
  return false;
}

async function hasCanonicalReceipt(
  file: FileSystemFileHandle,
  marker: string | undefined,
): Promise<boolean> {
  if (!marker || typeof file.getFile !== 'function') return false;
  try {
    const snapshot = await file.getFile();
    if (!Number.isSafeInteger(snapshot.size) || snapshot.size < 0 || typeof snapshot.slice !== 'function') {
      return false;
    }
    const start = Math.max(0, snapshot.size - RECEIPT_TAIL_BYTES);
    const tail = snapshot.slice(start, snapshot.size);
    let buffer: ArrayBuffer;
    if (typeof tail.arrayBuffer === 'function') {
      buffer = await tail.arrayBuffer();
    } else {
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Could not inspect note receipt.'));
        reader.onload = () => reader.result instanceof ArrayBuffer
          ? resolve(reader.result)
          : reject(new Error('Could not inspect note receipt.'));
        reader.readAsArrayBuffer(tail);
      });
    }
    return tailHasCanonicalMarker(new Uint8Array(buffer), marker);
  } catch {
    // Existing content that cannot be inspected is an ordinary collision.
    return false;
  }
}

async function existingFile(
  directory: FileSystemDirectoryHandle,
  filename: string,
): Promise<FileSystemFileHandle | undefined> {
  try {
    return await directory.getFileHandle(filename, { create: false });
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

async function createSafestAvailableFile(
  directory: FileSystemDirectoryHandle,
  stem: string,
  marker?: string,
): Promise<CreatedNoteFile> {
  for (let attempt = 1; attempt <= MAX_COLLISION_ATTEMPTS; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const ending = `${suffix}.md`;
    const limitedStem = truncateFilenameComponent(
      stem,
      MAX_FILENAME_CODE_POINTS - Array.from(ending).length,
      MAX_FILENAME_UTF8_BYTES - new TextEncoder().encode(ending).byteLength,
    );
    const filename = `${limitedStem}${ending}`;
    const occupied = await existingFile(directory, filename);
    if (occupied) {
      if (await hasCanonicalReceipt(occupied, marker)) {
        return { filename, file: occupied, existingReceipt: true };
      }
      continue;
    }

    // There is no atomic exclusive-create operation in the broadly available
    // File System Access API. Create immediately after the absence probe, then
    // take a snapshot before opening a writable. A nonempty snapshot means a
    // competitor won the race, so it must never be opened for writing.
    const file = await directory.getFileHandle(filename, { create: true });
    if (typeof file.getFile !== 'function') {
      throw new VaultWriteCapabilityError(
        'This context cannot inspect File System Access files.',
      );
    }
    const snapshot = await file.getFile();
    if (snapshot.size > 0) {
      if (marker && (await hasCanonicalReceipt(file, marker))) {
        return { filename, file, existingReceipt: true };
      }
      continue;
    }

    return { filename, file, existingReceipt: false };
  }
  throw new VaultCollisionError();
}

async function writeReservation(
  reservation: CreatedNoteFile,
  markdown: string,
): Promise<void> {
  let writable: FileSystemWritableFileStream | undefined;
  try {
    if (typeof reservation.file.createWritable !== 'function') {
      throw new VaultWriteCapabilityError(
        'This context cannot create File System Access writable streams.',
      );
    }
    writable = await reservation.file.createWritable({ keepExistingData: false });
    await writable.write(markdown);
    await writable.close();
  } catch (error) {
    if (writable) {
      if (typeof writable.abort === 'function') {
        try {
          await writable.abort(error);
        } catch {
          // Never close after abort failure: close could commit partial data.
        }
      }
    }
    // Never remove by filename after a failure. An external writer can replace
    // or populate the entry between any ownership check and removeEntry().
    throw error;
  }
}

export async function writeNote(input: WriteNoteInput): Promise<WriteNoteResult> {
  // Preparation and all pure validation happen before permission prompts or
  // filesystem traversal, so an upstream formatter failure cannot create dirs.
  const markdown = await prepareMarkdown(input);
  const marker = idempotencyMarker(input.idempotencyKey);
  const persistedMarkdown = markdownWithReceipt(markdown, marker);
  const segments = parseRelativeDirectory(input.relativeDirectory);
  const stem = markdownStem(input.title);

  await ensureReadWritePermission(input.vaultHandle);
  const directory = await traverseDirectory(input.vaultHandle, segments);
  const lock = input.writeLock ?? vaultWriteLock;
  const lockKey = `web-to-obsidian:vault:${input.vaultHandle.name}/${segments.join('/')}`;

  return lock.run(lockKey, async () => {
    const reservation = await createSafestAvailableFile(directory, stem, marker);
    if (!reservation.existingReceipt) {
      await writeReservation(reservation, persistedMarkdown);
    }

    return {
      filename: reservation.filename,
      relativePath: [...segments, reservation.filename].join('/'),
      vaultName: input.vaultHandle.name,
    };
  });
}
