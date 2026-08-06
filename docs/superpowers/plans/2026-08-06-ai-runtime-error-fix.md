# AI Runtime Error Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI failures actionable, enforce one valid schema-compliant JSON response, and stop the popup from multiplying a single provider failure into three failed requests.

**Architecture:** Add focused runtime utilities for error normalization, JSON extraction, and local schema validation. Integrate them at the shared `executeScenario`/`fetchWithRetry` boundaries, then make the popup workflow fail fast when its first remote operation fails. Provider-specific request building remains in the existing compatibility layer.

**Tech Stack:** TypeScript, React 18, WXT, Vitest, OpenAI-compatible Chat Completions and Responses APIs.

---

### Task 1: Normalize transport failures

**Files:**
- Create: `lib/aiRuntimeUtils.ts`
- Create: `lib/__tests__/aiRuntimeUtils.test.ts`
- Modify: `lib/aiService.ts:304`

- [x] **Step 1: Write failing tests for DOMException and timeout errors**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeAIError } from '@/lib/aiRuntimeUtils';

describe('normalizeAIError', () => {
  it('turns a network DOMException into an actionable message', () => {
    const result = normalizeAIError(new DOMException('', 'NetworkError'));
    expect(result.message).toContain('network request failed');
    expect(result.message).not.toContain('[object DOMException]');
  });

  it('turns an aborted timeout into a timeout message', () => {
    const result = normalizeAIError(new DOMException('', 'AbortError'), { timedOut: true, timeoutMs: 30_000 });
    expect(result.message).toContain('timed out after 30000ms');
  });
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm run test -- --run lib/__tests__/aiRuntimeUtils.test.ts`

Expected: FAIL because `@/lib/aiRuntimeUtils` does not exist.

- [x] **Step 3: Implement normalized AI errors and integrate timeout context**

```ts
export type AIErrorCode = 'cancelled' | 'timeout' | 'network' | 'response_format' | 'unknown';

export class AIRuntimeError extends Error {
  constructor(public readonly code: AIErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AIRuntimeError';
  }
}

export const normalizeAIError = (
  error: unknown,
  context: { timedOut?: boolean; timeoutMs?: number; cancelled?: boolean } = {}
): AIRuntimeError => {
  if (context.timedOut) {
    return new AIRuntimeError('timeout', `AI request timed out after ${context.timeoutMs ?? 0}ms`, { cause: error });
  }
  if (context.cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
    return new AIRuntimeError('cancelled', 'AI request was cancelled', { cause: error });
  }
  if (error instanceof DOMException || error instanceof TypeError) {
    return new AIRuntimeError('network', 'AI network request failed. Check the API URL, proxy TLS/CORS settings, and connectivity.', { cause: error });
  }
  if (error instanceof Error) {
    return new AIRuntimeError('unknown', error.message || error.name, { cause: error });
  }
  return new AIRuntimeError('unknown', 'Unknown AI request error');
};
```

- [x] **Step 4: Run focused tests and confirm GREEN**

Run: `npm run test -- --run lib/__tests__/aiRuntimeUtils.test.ts`

Expected: PASS.

### Task 2: Parse and validate exactly one JSON result

**Files:**
- Modify: `lib/aiRuntimeUtils.ts`
- Modify: `lib/__tests__/aiRuntimeUtils.test.ts`
- Modify: `lib/aiService.ts:484`

- [x] **Step 1: Write failing tests for wrapped, concatenated, and invalid-schema responses**

```ts
import { parseAIJsonResponse } from '@/lib/aiRuntimeUtils';

it('extracts one JSON object from a fenced response', () => {
  expect(parseAIJsonResponse('```json\n{"tags":["ai"]}\n```')).toEqual({ tags: ['ai'] });
});

it('rejects concatenated JSON objects', () => {
  expect(() => parseAIJsonResponse('{"commentary":"x"}{"tags":["ai"]}')).toThrow('exactly one JSON value');
});

it('rejects a response that does not match the scenario schema', () => {
  expect(() => parseAIJsonResponse('{"cmd":"pwd"}', {
    type: 'object',
    properties: { tags: { type: 'array', items: { type: 'string' } } },
    required: ['tags'],
    additionalProperties: false,
  })).toThrow('does not match');
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm run test -- --run lib/__tests__/aiRuntimeUtils.test.ts`

Expected: FAIL because `parseAIJsonResponse` is not implemented.

- [x] **Step 3: Implement one-value extraction and recursive schema validation**

Implement a balanced-bracket scanner that permits surrounding prose or Markdown fences but rejects any non-whitespace content after the first JSON value. Validate object, array, primitive types, required fields, enum values, and `additionalProperties: false` using the existing `JSONSchema` type.

- [x] **Step 4: Integrate parsing into `executeScenario`**

Replace direct `JSON.parse(responseContent)` with:

```ts
const jsonResponse = parseAIJsonResponse(responseContent, scenario.responseSchema.schema);
return scenario.parseResponse(jsonResponse);
```

Do not log the full raw response. Throw one `AIRuntimeError` with code `response_format` and a bounded preview.

- [x] **Step 5: Run focused and AI service tests**

Run: `npm run test -- --run lib/__tests__/aiRuntimeUtils.test.ts lib/__tests__/aiService.test.ts`

Expected: PASS.

### Task 3: Stop popup failure amplification

**Files:**
- Create: `lib/popupAIWorkflow.ts`
- Create: `lib/__tests__/popupAIWorkflow.test.ts`
- Modify: `entrypoints/popup/App.tsx:149`

- [x] **Step 1: Write a failing orchestration test**

```ts
it('does not run rename or tagging after folder recommendation fails', async () => {
  const rename = vi.fn();
  const tag = vi.fn();
  const result = await runPopupAIWorkflow({
    recommend: vi.fn().mockResolvedValue({ success: false, error: 'network failed' }),
    rename,
    tag,
  });
  expect(result.success).toBe(false);
  expect(rename).not.toHaveBeenCalled();
  expect(tag).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm run test -- --run lib/__tests__/popupAIWorkflow.test.ts`

Expected: FAIL because the workflow module does not exist.

- [x] **Step 3: Extract the popup orchestration and fail fast**

Create a dependency-injected workflow that runs recommendation first and only runs rename/tagging with `Promise.allSettled` when recommendation succeeds. Return structured results instead of logging expected provider failures as `console.error`.

- [x] **Step 4: Wire the React component to workflow callbacks**

Keep existing loading state and timing updates in `App.tsx`, but delegate sequencing to `runPopupAIWorkflow`. Expected AI failures should use a single `console.warn` with the normalized error message.

- [x] **Step 5: Run focused tests and confirm GREEN**

Run: `npm run test -- --run lib/__tests__/popupAIWorkflow.test.ts`

Expected: PASS.

### Task 4: Full verification and commit

**Files:**
- Verify all files changed above.

- [x] **Step 1: Run full verification**

Run: `npm run compile && npm run test -- --run && npm run build:chrome`

Expected: TypeScript exits 0, all tests pass, and WXT produces `dist/chrome-mv3`.

- [x] **Step 2: Review the final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only AI runtime, popup workflow, tests, and this plan are changed.

- [ ] **Step 3: Commit the fix**

```bash
git add docs/superpowers/plans/2026-08-06-ai-runtime-error-fix.md \
  lib/aiRuntimeUtils.ts lib/__tests__/aiRuntimeUtils.test.ts \
  lib/popupAIWorkflow.ts lib/__tests__/popupAIWorkflow.test.ts \
  lib/aiService.ts entrypoints/popup/App.tsx
git commit -m "fix: stabilize AI runtime responses"
```
