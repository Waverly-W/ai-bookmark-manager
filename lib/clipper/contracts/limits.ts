/** Bounds cross-context copies while still allowing unusually large articles. */
export const MAX_PAGE_SNAPSHOT_UTF8_BYTES = 8 * 1024 * 1024;
export const MAX_PREPARED_CLIP_UTF8_BYTES = 8 * 1024 * 1024;
export const MAX_MARKDOWN_UTF8_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_REFERENCES = 512;
export const MAX_SAFE_SEGMENT_REQUESTS = 16;
export const MAX_IMAGE_REFERENCES_UTF8_BYTES = 8 * 1024 * 1024;
export const MAX_DURABLE_JOB_UTF8_BYTES = 23 * 1024 * 1024;
export const MAX_JOB_ERROR_UTF8_BYTES = 4 * 1024;
export const MAX_JOB_WARNING_UTF8_BYTES = 4 * 1024;
export const MAX_ARTICLE_TITLE_UTF8_BYTES = 16 * 1024;
export const MAX_ARTICLE_URL_UTF8_BYTES = 64 * 1024;
export const MAX_ARTICLE_BYLINE_UTF8_BYTES = 16 * 1024;
export const MAX_ARTICLE_EXCERPT_UTF8_BYTES = 256 * 1024;
export const MAX_ARTICLE_SITE_NAME_UTF8_BYTES = 16 * 1024;
export const MAX_ARTICLE_LANG_UTF8_BYTES = 256;
export const MAX_ARTICLE_PUBLISHED_UTF8_BYTES = 4 * 1024;
export const MAX_IMAGE_ALT_UTF8_BYTES = 64 * 1024;
export const MAX_IMAGE_FILENAME_UTF8_BYTES = 4 * 1024;
export const MAX_JOB_PATH_UTF8_BYTES = 16 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function withinUtf8Limit(value: string, maximum: number): boolean {
  return value.length <= maximum && utf8ByteLength(value) <= maximum;
}

function jsonStringContentWireByteLength(value: string, maximum: number): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    let bytes: number;
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      bytes = 2;
    } else if (codeUnit <= 0x1f) {
      bytes = 6;
    } else if (codeUnit <= 0x7f) {
      bytes = 1;
    } else if (codeUnit <= 0x7ff) {
      bytes = 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes = 4;
        index += 1;
      } else {
        bytes = 6;
      }
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      bytes = 6;
    } else {
      bytes = 3;
    }
    total += bytes;
    if (total > maximum) return maximum + 1;
  }
  return total;
}

export function jsonStringWireByteLength(
  value: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (maximum < 2) return maximum + 1;
  const contentBytes = jsonStringContentWireByteLength(value, maximum - 2);
  return contentBytes > maximum - 2 ? maximum + 1 : contentBytes + 2;
}

export function withinJsonStringWireLimit(value: string, maximum: number): boolean {
  if (value.length > maximum - 2) return false;
  return jsonStringWireByteLength(value, maximum) <= maximum;
}

export function truncateJsonStringWire(value: string, maximum: number): string {
  if (withinJsonStringWireLimit(value, maximum)) return value;
  const contentMaximum = Math.max(0, maximum - 2);
  let bytes = 0;
  let end = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    let nextBytes: number;
    let codeUnits = 1;
    if (codeUnit === 0x22 || codeUnit === 0x5c) nextBytes = 2;
    else if (codeUnit <= 0x1f) nextBytes = 6;
    else if (codeUnit <= 0x7f) nextBytes = 1;
    else if (codeUnit <= 0x7ff) nextBytes = 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const following = value.charCodeAt(index + 1);
      if (following >= 0xdc00 && following <= 0xdfff) {
        nextBytes = 4;
        codeUnits = 2;
      } else nextBytes = 6;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) nextBytes = 6;
    else nextBytes = 3;
    if (bytes + nextBytes > contentMaximum) break;
    bytes += nextBytes;
    end = index + codeUnits;
    if (codeUnits === 2) index += 1;
  }
  return value.slice(0, end);
}

function jsonValueWireByteLengthInternal(
  value: unknown,
  maximum: number,
  ancestors: Set<object>,
  arrayItem = false,
): number {
  if (value === null) return 4;
  if (typeof value === 'string') return jsonStringWireByteLength(value, maximum);
  if (typeof value === 'boolean') return value ? 4 : 5;
  if (typeof value === 'number') return Number.isFinite(value) ? 32 : 4;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return arrayItem ? 4 : 0;
  }
  if (typeof value !== 'object' || typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return maximum + 1;
  }
  if (ancestors.has(value)) return maximum + 1;
  ancestors.add(value);

  let total = 2;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) total += 1;
      if (total > maximum) break;
      total += jsonValueWireByteLengthInternal(
        value[index],
        maximum - total,
        ancestors,
        true,
      );
      if (total > maximum) break;
    }
  } else {
    let properties = 0;
    for (const key in value) {
      if (Object.hasOwn(value, key)) {
        const property = (value as Record<string, unknown>)[key];
        const serialized = property !== undefined
          && typeof property !== 'function'
          && typeof property !== 'symbol';
        if (serialized) {
          if (properties > 0) total += 1;
          total += jsonStringWireByteLength(key, maximum - total) + 1;
          if (total > maximum) break;
          total += jsonValueWireByteLengthInternal(
            property,
            maximum - total,
            ancestors,
          );
          properties += 1;
          if (total > maximum) break;
        }
      }
    }
  }

  ancestors.delete(value);
  return total > maximum ? maximum + 1 : total;
}

export function jsonValueWireByteLength(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  return jsonValueWireByteLengthInternal(value, maximum, new Set());
}

export function withinJsonValueWireLimit(value: unknown, maximum: number): boolean {
  return jsonValueWireByteLength(value, maximum) <= maximum;
}

export function concatenatedStringsWithinJsonWireLimit(
  values: Iterable<string>,
  maximum: number,
): boolean {
  let contentBytes = 0;
  if (maximum < 2) return false;
  for (const value of values) {
    contentBytes += jsonStringContentWireByteLength(value, maximum - 2 - contentBytes);
    if (contentBytes > maximum - 2) return false;
  }
  return true;
}

export function dataUrlDecodedUpperBound(payload: string): number {
  let padding = 0;
  if (payload.endsWith('==')) {
    padding = 2;
  } else if (payload.endsWith('=')) {
    padding = 1;
  }
  return Math.ceil(payload.length / 4) * 3 - padding;
}
