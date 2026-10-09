import type { JSONSchema } from './ai/types';

export type AIErrorCode =
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'http'
  | 'incomplete'
  | 'response_format'
  | 'unknown';

export interface AIErrorContext {
  timedOut?: boolean;
  timeoutMs?: number;
  cancelled?: boolean;
}

export class AIRuntimeError extends Error {
  readonly code: AIErrorCode;
  /** HTTP status for `http` errors. */
  readonly status?: number;

  constructor(code: AIErrorCode, message: string, cause?: unknown, status?: number) {
    super(message);
    this.name = 'AIRuntimeError';
    this.code = code;
    this.status = status;

    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }
}

export const normalizeAIError = (
  error: unknown,
  context: AIErrorContext = {}
): AIRuntimeError => {
  if (error instanceof AIRuntimeError) {
    return error;
  }

  if (context.timedOut) {
    return new AIRuntimeError(
      'timeout',
      `AI request timed out after ${context.timeoutMs ?? 0}ms`,
      error
    );
  }

  if (context.cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
    return new AIRuntimeError('cancelled', 'AI request was cancelled', error);
  }

  if (error instanceof DOMException || error instanceof TypeError) {
    return new AIRuntimeError(
      'network',
      'AI network request failed. Check the API URL, that the extension has been granted access to the API host (re-save the AI settings to grant it), proxy TLS/CORS settings, and connectivity.',
      error
    );
  }

  if (error instanceof Error) {
    return new AIRuntimeError('unknown', error.message || error.name, error);
  }

  return new AIRuntimeError('unknown', 'Unknown AI request error', error);
};

const findJsonStart = (value: string): number => {
  const objectStart = value.indexOf('{');
  const arrayStart = value.indexOf('[');

  if (objectStart === -1) return arrayStart;
  if (arrayStart === -1) return objectStart;
  return Math.min(objectStart, arrayStart);
};

const findJsonEnd = (value: string, start: number): number => {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{' || character === '[') {
      stack.push(character);
      continue;
    }

    if (character === '}' || character === ']') {
      const opening = stack.pop();
      const matches = (opening === '{' && character === '}') || (opening === '[' && character === ']');
      if (!matches) {
        throw new AIRuntimeError('response_format', 'AI response contained unbalanced JSON brackets');
      }
      if (stack.length === 0) return index + 1;
    }
  }

  throw new AIRuntimeError('response_format', 'AI response contained incomplete JSON');
};

const validateSchema = (value: unknown, schema: JSONSchema, path: string): string | undefined => {
  const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

  if (actualType !== schema.type) {
    return `${path} does not match schema type ${schema.type}`;
  }

  if (schema.enum && (typeof value !== 'string' || !schema.enum.includes(value))) {
    return `${path} does not match schema enum`;
  }

  if (schema.type === 'object') {
    const objectValue = value as Record<string, unknown>;
    const properties = schema.properties || {};

    for (const requiredKey of schema.required || []) {
      if (!(requiredKey in objectValue)) {
        return `${path}.${requiredKey} is required`;
      }
    }

    if (schema.additionalProperties === false) {
      const unexpectedKey = Object.keys(objectValue).find((key) => !(key in properties));
      if (unexpectedKey) {
        return `${path}.${unexpectedKey} is not allowed`;
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in objectValue) {
        const error = validateSchema(objectValue[key], propertySchema, `${path}.${key}`);
        if (error) return error;
      }
    }
  }

  if (schema.type === 'array' && schema.items) {
    for (let index = 0; index < (value as unknown[]).length; index += 1) {
      const error = validateSchema((value as unknown[])[index], schema.items, `${path}[${index}]`);
      if (error) return error;
    }
  }

  return undefined;
};

export const parseAIJsonResponse = (response: string, schema?: JSONSchema): unknown => {
  const normalized = response
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = findJsonStart(normalized);
  let jsonText = normalized;
  let end = normalized.length;

  if (start >= 0) {
    end = findJsonEnd(normalized, start);
    jsonText = normalized.slice(start, end);

    const trailing = normalized.slice(end).trim();
    if (trailing) {
      throw new AIRuntimeError('response_format', 'AI response must contain exactly one JSON value');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new AIRuntimeError('response_format', 'AI response was not valid JSON', error);
  }

  if (schema) {
    const schemaError = validateSchema(parsed, schema, '$');
    if (schemaError) {
      throw new AIRuntimeError('response_format', `AI response does not match schema: ${schemaError}`);
    }
  }

  return parsed;
};
