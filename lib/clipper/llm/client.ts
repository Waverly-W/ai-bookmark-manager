export interface ModelRequest {
  instructions: string;
  input: string;
  signal?: AbortSignal;
}

export interface ModelResponse {
  text: string;
  requestId?: string;
}

export interface ModelClient {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ProviderErrorOptions {
  status?: number;
  code: string;
  requestId?: string;
}

export class ProviderError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, options: ProviderErrorOptions) {
    super(message);
    this.name = 'ProviderError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export interface ProviderTransportOptions {
  fetch?: FetchLike;
}

interface ProviderErrorBody {
  id?: unknown;
  error?: { code?: unknown; message?: unknown };
  code?: unknown;
  message?: unknown;
}

const MAX_SAFE_MESSAGE = 500;

function redactMessage(message: string, apiKey: string): string {
  let safe = message;
  if (apiKey) safe = safe.split(apiKey).join('[REDACTED]');
  safe = safe
    .replace(/Bearer\s+[^\s"'&,}]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:api[_-]?key|key|token|access_token)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[REDACTED]');
  return safe.slice(0, MAX_SAFE_MESSAGE);
}

function bodyRecord(value: unknown): ProviderErrorBody | undefined {
  return value !== null && typeof value === 'object' ? value as ProviderErrorBody : undefined;
}

function safeRequestId(value: string, apiKey: string): string | undefined {
  let safe = value.trim();
  if (apiKey) safe = safe.split(apiKey).join('redacted');
  safe = safe
    .replace(/https?:\/\/[^\s]+/gi, 'redacted-url')
    .replace(/Bearer\s+\S+/gi, 'Bearer-redacted')
    .replace(/(?:api[_-]?key|token)[=:]\S+/gi, 'redacted')
    .replace(/[^A-Za-z0-9._:-]+/g, '_')
    .slice(0, 128);
  return safe || undefined;
}

function requestIdFrom(body: unknown, response: Response, apiKey: string): string | undefined {
  const header = response.headers.get('x-request-id')?.trim();
  if (header) return safeRequestId(header, apiKey);
  const id = bodyRecord(body)?.id;
  return typeof id === 'string' ? safeRequestId(id, apiKey) : undefined;
}

function contextLengthExceeded(status: number, code: string, message: string): boolean {
  if (status !== 400) return false;
  if (/context[_-]?length[_-]?exceeded|context[_-]?window[_-]?exceeded/i.test(code)) return true;
  return /maximum context length|context length.{0,40}(?:exceed|too (?:long|large))|too many tokens|reduce (?:the )?(?:length|number) of (?:the )?(?:messages|tokens)/i.test(message);
}

function normalizedHttpError(response: Response, body: unknown, apiKey: string): ProviderError {
  const record = bodyRecord(body);
  const nested = record?.error && typeof record.error === 'object' ? record.error : undefined;
  const rawCode = nested?.code ?? record?.code;
  const rawMessage = nested?.message ?? record?.message;
  const providerCode = typeof rawCode === 'string' && rawCode.trim()
    ? redactMessage(rawCode, apiKey).slice(0, 100)
    : 'HTTP_ERROR';
  const providerMessage = typeof rawMessage === 'string' && rawMessage.trim()
    ? rawMessage
    : `Provider request failed with HTTP ${response.status}`;
  return new ProviderError(redactMessage(providerMessage, apiKey), {
    status: response.status,
    code: contextLengthExceeded(response.status, providerCode, providerMessage) ? 'CONTEXT_LENGTH' : providerCode,
    requestId: requestIdFrom(body, response, apiKey),
  });
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    if (response.ok) throw new ProviderError('Provider returned an empty response', { code: 'INVALID_RESPONSE', status: response.status });
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (response.ok) throw new ProviderError('Provider returned malformed JSON', { code: 'INVALID_RESPONSE', status: response.status });
    return undefined;
  }
}

export async function postProviderJson(
  endpoint: string,
  apiKey: string,
  timeoutMs: number,
  payload: unknown,
  options: ProviderTransportOptions & { signal?: AbortSignal } = {},
): Promise<{ body: unknown; requestId?: string; status: number }> {
  const controller = new AbortController();
  let abortKind: 'external' | 'timeout' | undefined;
  const onExternalAbort = () => {
    abortKind ??= 'external';
    controller.abort();
  };
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });
  if (options.signal?.aborted) onExternalAbort();
  const timer = setTimeout(() => {
    abortKind ??= 'timeout';
    controller.abort();
  }, timeoutMs);

  try {
    const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await parseJson(response);
    if (!response.ok) throw normalizedHttpError(response, body, apiKey);
    return { body, requestId: requestIdFrom(body, response, apiKey), status: response.status };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (abortKind === 'timeout') throw new ProviderError('Provider request timed out', { code: 'TIMEOUT' });
    if (abortKind === 'external') throw new ProviderError('Provider request was cancelled', { code: 'ABORTED' });
    throw new ProviderError('Provider network request failed', { code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export function invalidProviderResponse(status: number, requestId?: string): ProviderError {
  return new ProviderError('Provider returned an invalid or empty response', {
    code: 'INVALID_RESPONSE',
    requestId,
    status,
  });
}

export function incompleteProviderResponse(status: number, requestId?: string): ProviderError {
  return new ProviderError('Provider returned an incomplete response', {
    code: 'INCOMPLETE_RESPONSE',
    requestId,
    status,
  });
}
