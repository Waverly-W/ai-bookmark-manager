import type { JobState, SerializableError } from '../contracts/job';
import {
  MAX_JOB_ERROR_UTF8_BYTES,
  truncateJsonStringWire,
} from '../contracts/limits';

const NEXT_STATE: Readonly<Partial<Record<JobState, JobState>>> = {
  extracted: 'formatted',
  formatted: 'uploading_images',
  uploading_images: 'ready_to_write',
  ready_to_write: 'completed',
};

export class JobTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';

  constructor(from: JobState, to: JobState) {
    super(`Clipping job cannot transition from ${from} to ${to}.`);
    this.name = 'JobTransitionError';
  }
}

export function assertJobTransition(
  from: JobState,
  to: JobState,
  hasStoredFailure: boolean,
): void {
  if (NEXT_STATE[from] === to) return;
  if (from === to && from !== 'completed' && hasStoredFailure) return;
  throw new JobTransitionError(from, to);
}

const URL_WITH_QUERY = /https?:\/\/[^\s\\<>'"`]+/gi;
const ESCAPED_URL_WITH_QUERY = /https?:\\\/\\\/[^\s<>'"`]+/gi;
const SENSITIVE_KEY_PATTERN = /X-Amz-(?:Security-Token|Credential|Signature|Algorithm)|secretAccessKey|Authorization|AWSAccessKeyId|GoogleAccessId|accessKeyId|apiKey|signature|expires|token|sig/gi;

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[a-z0-9_$]/i.test(character);
}

function skipQuote(value: string, index: number): number {
  if (value[index] === '\\' && (value[index + 1] === '"' || value[index + 1] === "'")) {
    return index + 2;
  }
  return value[index] === '"' || value[index] === "'" ? index + 1 : index;
}

function quotedValueEnd(value: string, start: number): number | undefined {
  const escapedRepresentation = value[start] === '\\'
    && (value[start + 1] === '"' || value[start + 1] === "'");
  const quote = escapedRepresentation ? value[start + 1]! : value[start];
  if (quote !== '"' && quote !== "'") return undefined;
  const tokenLength = escapedRepresentation ? 2 : 1;
  let precedingSlashes = 0;
  for (let index = start + tokenLength; index < value.length; index += 1) {
    const character = value[index];
    if (character === '\\') {
      precedingSlashes += 1;
      continue;
    }
    if (character === quote) {
      const closesValue = escapedRepresentation
        ? precedingSlashes % 4 === 1
        : precedingSlashes % 2 === 0;
      if (closesValue) return index + 1;
    }
    precedingSlashes = 0;
  }
  return value.length;
}

interface SensitiveAssignment {
  valueStart: number;
  valueEnd: number;
}

function findSensitiveAssignment(value: string, from: number): SensitiveAssignment | undefined {
  const pattern = new RegExp(SENSITIVE_KEY_PATTERN.source, SENSITIVE_KEY_PATTERN.flags);
  pattern.lastIndex = from;
  for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
    const start = match.index;
    const searchFrom = pattern.lastIndex;
    if (isIdentifierCharacter(value[start - 1]) || isIdentifierCharacter(value[searchFrom])) {
      continue;
    }

    let cursor = skipQuote(value, searchFrom);
    while (/\s/.test(value[cursor] ?? '')) cursor += 1;
    if (value[cursor] !== ':' && value[cursor] !== '=') continue;
    cursor += 1;
    while (/\s/.test(value[cursor] ?? '')) cursor += 1;
    const valueStart = cursor;
    const quotedEnd = quotedValueEnd(value, valueStart);
    if (quotedEnd !== undefined) return { valueStart, valueEnd: quotedEnd };
    while (cursor < value.length && !/[,;}\r\n]/.test(value[cursor]!)) cursor += 1;
    return { valueStart, valueEnd: cursor };
  }
  return undefined;
}

function redactAssignments(value: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < value.length) {
    const assignment = findSensitiveAssignment(value, cursor);
    if (!assignment) return result + value.slice(cursor);
    result += `${value.slice(cursor, assignment.valueStart)}[REDACTED]`;
    cursor = assignment.valueEnd;
  }
  return result;
}

function redactText(value: string): string {
  const withoutQueries = value
    .replace(ESCAPED_URL_WITH_QUERY, (candidate) => {
      const query = candidate.indexOf('?');
      return query < 0 ? candidate : `${candidate.slice(0, query)}?[REDACTED]`;
    })
    .replace(URL_WITH_QUERY, (candidate) => {
      try {
        const url = new URL(candidate);
        if (!url.search) return candidate;
        url.search = '';
        return `${url.href}?[REDACTED]`;
      } catch {
        return '[REDACTED_URL]';
      }
    });
  return redactAssignments(withoutQueries);
}

function errorName(error: unknown): string {
  try {
    return error instanceof Error && typeof error.name === 'string' ? error.name : 'Error';
  } catch {
    return 'Error';
  }
}

function errorMessage(error: unknown, seen = new Set<object>()): string {
  if (typeof error === 'string') {
    return truncateJsonStringWire(error, MAX_JOB_ERROR_UTF8_BYTES);
  }
  if (!error || typeof error !== 'object' || seen.has(error)) return 'An operation failed.';
  seen.add(error);
  let message = 'An operation failed.';
  try {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === 'string') {
      message = truncateJsonStringWire(candidate, MAX_JOB_ERROR_UTF8_BYTES);
    }
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined) {
      message = truncateJsonStringWire(
        `${message} Caused by: ${errorMessage(cause, seen)}`,
        MAX_JOB_ERROR_UTF8_BYTES,
      );
    }
  } catch {
    // Throwing getters are untrusted own fields and are omitted.
  }
  return message;
}

function errorCode(error: unknown): string | undefined {
  try {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string' || code.length === 0) return undefined;
    return truncateJsonStringWire(
      redactText(truncateJsonStringWire(code, MAX_JOB_ERROR_UTF8_BYTES)),
      MAX_JOB_ERROR_UTF8_BYTES,
    );
  } catch {
    return undefined;
  }
}

/**
 * Deliberately projects an arbitrary throwable onto the small public error
 * contract. Cause messages are recursively flattened through the sanitizer;
 * raw causes, stacks, headers, response bodies, and arbitrary enumerable
 * properties never enter durable storage.
 */
export function redactJobError(error: unknown, stage?: JobState): SerializableError {
  const code = errorCode(error);
  return {
    name: truncateJsonStringWire(
      redactText(truncateJsonStringWire(errorName(error), MAX_JOB_ERROR_UTF8_BYTES)),
      MAX_JOB_ERROR_UTF8_BYTES,
    ),
    message: truncateJsonStringWire(
      redactText(errorMessage(error)),
      MAX_JOB_ERROR_UTF8_BYTES,
    ),
    ...(code ? { code } : {}),
    ...(stage ? { stage } : {}),
  };
}

export function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true
    || (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError');
}
