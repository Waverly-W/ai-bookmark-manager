import {
  incompleteProviderResponse,
  invalidProviderResponse,
  type ModelClient,
  postProviderJson,
  type ProviderTransportOptions,
} from './client';
import { composeEndpoint } from './endpoint';

export interface ResponsesSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature?: number;
  maxOutputTokens?: number;
}

function responsesText(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const record = body as { output?: unknown; output_text?: unknown };
  if (Array.isArray(record.output)) {
    const parts: string[] = [];
    for (const item of record.output) {
      if (item === null || typeof item !== 'object' || (item as { type?: unknown }).type !== 'message') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part !== null && typeof part === 'object' &&
          (part as { type?: unknown }).type === 'output_text' &&
          typeof (part as { text?: unknown }).text === 'string') {
          parts.push((part as { text: string }).text);
        }
      }
    }
    const text = parts.join('');
    if (text.trim()) return text;
  }
  return typeof record.output_text === 'string' && record.output_text.trim()
    ? record.output_text
    : undefined;
}

export function createResponsesClient(
  settings: ResponsesSettings,
  options: ProviderTransportOptions = {},
): ModelClient {
  const endpoint = composeEndpoint(settings.baseUrl, 'responses');
  return {
    async generate(request) {
      const result = await postProviderJson(endpoint, settings.apiKey, settings.timeoutMs, {
        model: settings.model,
        ...(settings.temperature === undefined ? {} : { temperature: settings.temperature }),
        ...(settings.maxOutputTokens === undefined ? {} : { max_output_tokens: settings.maxOutputTokens }),
        instructions: request.instructions,
        input: request.input,
      }, { ...options, signal: request.signal });
      if (result.body !== null && typeof result.body === 'object' &&
        Object.hasOwn(result.body, 'status') &&
        (result.body as { status?: unknown }).status !== 'completed') {
        throw incompleteProviderResponse(result.status, result.requestId);
      }
      const text = responsesText(result.body);
      if (!text) throw invalidProviderResponse(result.status, result.requestId);
      return { text, requestId: result.requestId };
    },
  };
}
