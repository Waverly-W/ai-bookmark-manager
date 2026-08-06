import { describe, expect, it } from 'vitest';

import { normalizeAIError, parseAIJsonResponse } from '@/lib/aiRuntimeUtils';

describe('normalizeAIError', () => {
  it('turns a network DOMException into an actionable message', () => {
    const result = normalizeAIError(new DOMException('', 'NetworkError'));

    expect(result.code).toBe('network');
    expect(result.message).toContain('network request failed');
    expect(result.message).not.toContain('[object DOMException]');
  });

  it('turns an aborted timeout into a timeout message', () => {
    const result = normalizeAIError(
      new DOMException('', 'AbortError'),
      { timedOut: true, timeoutMs: 30_000 }
    );

    expect(result.code).toBe('timeout');
    expect(result.message).toContain('timed out after 30000ms');
  });

  it('distinguishes cancellation from timeout', () => {
    const result = normalizeAIError(
      new DOMException('', 'AbortError'),
      { cancelled: true }
    );

    expect(result.code).toBe('cancelled');
    expect(result.message).toBe('AI request was cancelled');
  });
});

describe('parseAIJsonResponse', () => {
  it('extracts one JSON object from a fenced response', () => {
    expect(parseAIJsonResponse('```json\n{"tags":["ai"]}\n```')).toEqual({
      tags: ['ai'],
    });
  });

  it('allows a short non-JSON prefix but rejects concatenated JSON objects', () => {
    expect(parseAIJsonResponse('Result:\n{"tags":["ai"]}')).toEqual({
      tags: ['ai'],
    });
    expect(() => parseAIJsonResponse('{"commentary":"x"}{"tags":["ai"]}'))
      .toThrow('exactly one JSON value');
  });

  it('rejects a response that does not match the scenario schema', () => {
    expect(() => parseAIJsonResponse('{"cmd":"pwd"}', {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tags'],
      additionalProperties: false,
    })).toThrow('does not match');
  });
});
