const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const RESERVED_FILENAME_CHARACTERS = /[<>:"/\\|?*＜＞：＂／＼｜？＊\u0000-\u001f\u007f]+/gu;
const INVALID_DIRECTORY_CHARACTERS = /[<>:"|?*\u0000-\u001f\u007f]/u;
export const MAX_FILENAME_CODE_POINTS = 120;
export const MAX_FILENAME_UTF8_BYTES = 240;

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});
const textEncoder = new TextEncoder();

export class InvalidRelativeDirectoryError extends Error {
  constructor(message = 'Directory must be a safe relative path.') {
    super(message);
    this.name = 'InvalidRelativeDirectoryError';
  }
}

function trimTrailingDotOrSpace(value: string): string {
  return value.replace(/[. ]+$/u, '');
}

function splitExtension(value: string): { stem: string; extension: string } {
  const lastDot = value.lastIndexOf('.');
  if (lastDot <= 0) {
    return { stem: value, extension: '' };
  }

  return {
    stem: value.slice(0, lastDot),
    extension: value.slice(lastDot),
  };
}

function utf8Length(value: string): number {
  return textEncoder.encode(value).byteLength;
}

export function truncateFilenameComponent(
  value: string,
  maxCodePoints: number,
  maxUtf8Bytes: number,
): string {
  let result = '';
  let codePoints = 0;
  let bytes = 0;
  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentCodePoints = Array.from(segment).length;
    const segmentBytes = utf8Length(segment);
    if (
      codePoints + segmentCodePoints > maxCodePoints ||
      bytes + segmentBytes > maxUtf8Bytes
    ) {
      break;
    }
    result += segment;
    codePoints += segmentCodePoints;
    bytes += segmentBytes;
  }
  return result;
}

export function sanitizeFilename(title: string): string {
  const normalized = trimTrailingDotOrSpace(
    title
      .normalize('NFC')
      .replace(/\s+/gu, ' ')
      .replace(RESERVED_FILENAME_CHARACTERS, '-')
      .trim(),
  );
  if (!normalized) {
    return 'Untitled';
  }

  const { stem, extension } = splitExtension(normalized);
  const limitedExtension = truncateFilenameComponent(
    extension,
    MAX_FILENAME_CODE_POINTS,
    MAX_FILENAME_UTF8_BYTES,
  );
  const limitedStem = truncateFilenameComponent(
    stem,
    MAX_FILENAME_CODE_POINTS - Array.from(limitedExtension).length,
    MAX_FILENAME_UTF8_BYTES - utf8Length(limitedExtension),
  );
  let filename = trimTrailingDotOrSpace(`${limitedStem}${limitedExtension}`);
  if (!filename) {
    filename = 'Untitled';
  }

  return WINDOWS_DEVICE_NAME.test(filename)
    ? `_${truncateFilenameComponent(
        filename,
        MAX_FILENAME_CODE_POINTS - 1,
        MAX_FILENAME_UTF8_BYTES - 1,
      )}`
    : filename;
}

export function parseRelativeDirectory(input: string): string[] {
  if (input === '') {
    return [];
  }
  if (
    input.startsWith('/') ||
    input.startsWith('\\') ||
    /^[a-z]:/iu.test(input) ||
    input.includes('\\') ||
    input.includes('\0')
  ) {
    throw new InvalidRelativeDirectoryError();
  }

  const segments = input.split('/');
  for (const segment of segments) {
    if (
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      segment.trim() !== segment ||
      trimTrailingDotOrSpace(segment) !== segment ||
      INVALID_DIRECTORY_CHARACTERS.test(segment) ||
      WINDOWS_DEVICE_NAME.test(segment)
    ) {
      throw new InvalidRelativeDirectoryError();
    }
  }

  return segments;
}
