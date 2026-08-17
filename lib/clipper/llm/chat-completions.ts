import {
  incompleteProviderResponse,
  invalidProviderResponse,
  type ModelClient,
  postProviderJson,
  type ProviderTransportOptions,
} from './client';
import { composeEndpoint } from './endpoint';

export interface ChatCompletionsSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature?: number;
  maxOutputTokens?: number;
}

interface ChatResult {
  text: string;
  complete: boolean;
}

function chatResult(body: unknown): ChatResult | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return undefined;
  for (const choice of choices) {
    if (choice === null || typeof choice !== 'object') continue;
    const message = (choice as { message?: unknown }).message;
    if (message === null || typeof message !== 'object') continue;
    const content = (message as { content?: unknown }).content;
    let text: string | undefined;
    if (typeof content === 'string' && content.trim()) text = content;
    if (Array.isArray(content)) {
      const partText = content
        .filter((part): part is { type: 'text'; text: string } =>
          part !== null && typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string')
        .map((part) => part.text)
        .join('');
      if (partText.trim()) text = partText;
    }
    if (text) {
      const finishReasonPresent = Object.hasOwn(choice, 'finish_reason');
      return { text, complete: !finishReasonPresent || (choice as { finish_reason?: unknown }).finish_reason === 'stop' };
    }
  }
  return undefined;
}

export function createChatCompletionsClient(
  settings: ChatCompletionsSettings,
  options: ProviderTransportOptions = {},
): ModelClient {
  const endpoint = composeEndpoint(settings.baseUrl, 'chat-completions');
  return {
    async generate(request) {
      const result = await postProviderJson(endpoint, settings.apiKey, settings.timeoutMs, {
        model: settings.model,
        ...(settings.temperature === undefined ? {} : { temperature: settings.temperature }),
        ...(settings.maxOutputTokens === undefined ? {} : { max_tokens: settings.maxOutputTokens }),
        messages: [
          { role: 'system', content: request.instructions },
          { role: 'user', content: request.input },
        ],
      }, { ...options, signal: request.signal });
      const completion = chatResult(result.body);
      if (!completion) throw invalidProviderResponse(result.status, result.requestId);
      if (!completion.complete) throw incompleteProviderResponse(result.status, result.requestId);
      return { text: completion.text, requestId: result.requestId };
    },
  };
}
