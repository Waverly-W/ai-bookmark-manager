import type { AIConfig } from './aiConfigUtils';
import { AIRuntimeError } from './aiRuntimeUtils';

export type AIResponseFormat = { type: "text" | "json_object" | "json_schema"; json_schema?: any };

export interface AIGenerationOptions {
    maxTokens?: number;
    temperature?: number;
    label?: string;
}

export interface AIChatMessage {
    content?: string | Array<{
        type?: string;
        text?: string;
    }>;
    reasoning_content?: string;
    refusal?: string;
    tool_calls?: unknown[] | null;
}

export interface AIChatResponse {
    choices?: Array<{
        finish_reason?: string | null;
        message?: AIChatMessage;
    }>;
}

export interface AIResponsesAPIResponse {
    status?: string;
    incomplete_details?: {
        reason?: string;
    } | null;
    error?: {
        message?: string;
    } | null;
    output_text?: string;
    output?: Array<{
        type?: string;
        content?: Array<{
            type?: string;
            text?: string;
        }>;
    }>;
}

export const getApiType = (config: AIConfig): NonNullable<AIConfig['apiType']> => {
    return config.apiType ?? 'chat_completions';
};

export const buildEndpoint = (apiUrl: string, path: string = 'chat/completions'): string => {
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return `${baseUrl}/${path}`;
};

export const buildAIEndpoint = (config: AIConfig): string => {
    return buildEndpoint(config.apiUrl, getApiType(config) === 'responses' ? 'responses' : 'chat/completions');
};

const buildMessages = (userPrompt: string, systemPrompt?: string) => {
    const messages: any[] = [];

    if (systemPrompt) {
        messages.push({
            role: 'system',
            content: systemPrompt
        });
    }

    messages.push({
        role: 'user',
        content: userPrompt
    });

    return messages;
};

const toResponsesTextFormat = (responseFormat?: AIResponseFormat): any | undefined => {
    if (!responseFormat || responseFormat.type === 'text') {
        return undefined;
    }

    if (responseFormat.type === 'json_schema') {
        return {
            type: 'json_schema',
            ...(responseFormat.json_schema || {})
        };
    }

    return { type: 'json_object' };
};

export const buildAIRequestBody = (
    config: AIConfig,
    userPrompt: string,
    systemPrompt: string | undefined,
    maxTokens: number,
    responseFormat?: AIResponseFormat,
    generation?: AIGenerationOptions
): any => {
    const temperature = generation?.temperature ?? 0.7;

    if (getApiType(config) === 'responses') {
        const requestBody: any = {
            model: config.modelId,
            input: userPrompt,
            temperature,
            max_output_tokens: maxTokens,
            store: false
        };

        if (systemPrompt) {
            requestBody.instructions = systemPrompt;
        }

        const textFormat = toResponsesTextFormat(responseFormat);
        if (textFormat) {
            requestBody.text = {
                format: textFormat
            };
        }

        return requestBody;
    }

    const requestBody: any = {
        model: config.modelId,
        messages: buildMessages(userPrompt, systemPrompt),
        temperature,
        max_tokens: maxTokens
    };

    if (responseFormat) {
        requestBody.response_format = responseFormat;
    }

    return requestBody;
};

export const extractChatMessageText = (message?: AIChatMessage): string => {
    if (!message) {
        return '';
    }

    if (typeof message.content === 'string' && message.content.trim().length > 0) {
        return message.content.trim();
    }

    if (Array.isArray(message.content)) {
        const text = message.content
            .map((part) => typeof part?.text === 'string' ? part.text : '')
            .join('')
            .trim();

        if (text.length > 0) {
            return text;
        }
    }

    if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim().length > 0) {
        return message.reasoning_content.trim();
    }

    if (typeof message.refusal === 'string' && message.refusal.trim().length > 0) {
        return message.refusal.trim();
    }

    return '';
};

export const extractResponsesAPIText = (data: AIResponsesAPIResponse): string => {
    if (typeof data.output_text === 'string' && data.output_text.trim().length > 0) {
        return data.output_text.trim();
    }

    if (Array.isArray(data.output)) {
        const text = data.output
            .flatMap((item) => item.content || [])
            .filter((part) => part?.type === 'output_text')
            .map((part) => typeof part?.text === 'string' ? part.text : '')
            .join('')
            .trim();

        if (text.length > 0) {
            return text;
        }
    }

    return '';
};

export const extractAIResponseContent = (data: AIChatResponse | AIResponsesAPIResponse, config: AIConfig): string => {
    if (getApiType(config) === 'responses') {
        return extractResponsesAPIText(data as AIResponsesAPIResponse);
    }

    const chatData = data as AIChatResponse;
    return extractChatMessageText(chatData.choices?.[0]?.message);
};

const SSE_DONE_SENTINEL = '[DONE]';

const isEventStreamBody = (contentType: string, body: string): boolean => {
    return contentType.includes('text/event-stream') || /^(?:data|event):/.test(body.trimStart());
};

// 解析 SSE 文本，返回每个事件的 data 负载（已 JSON 解析，忽略 [DONE] 与非 JSON 数据）
const parseEventStreamPayloads = (body: string): any[] => {
    const payloads: any[] = [];

    for (const block of body.split(/\r?\n\r?\n/)) {
        const data = block
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n')
            .trim();

        if (!data || data === SSE_DONE_SENTINEL) {
            continue;
        }

        try {
            payloads.push(JSON.parse(data));
        } catch {
            // 忽略无法解析的事件（如心跳）
        }
    }

    return payloads;
};

const getStreamErrorMessage = (payload: any): string | undefined => {
    if (!payload?.error) {
        return undefined;
    }

    if (typeof payload.error === 'string') {
        return payload.error;
    }

    return payload.error.message || JSON.stringify(payload.error);
};

const appendContentPart = (content: unknown): string => {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content.map((part) => typeof part?.text === 'string' ? part.text : '').join('');
    }

    return '';
};

const aggregateChatCompletionStream = (payloads: any[]): AIChatResponse => {
    let content = '';
    let reasoningContent = '';
    let finishReason: string | null = null;
    const toolCalls: unknown[] = [];

    for (const payload of payloads) {
        const errorMessage = getStreamErrorMessage(payload);
        if (errorMessage) {
            throw new Error(`AI stream error: ${errorMessage}`);
        }

        const choice = payload?.choices?.[0];
        if (!choice) {
            continue;
        }

        const delta = choice.delta ?? choice.message ?? {};
        content += appendContentPart(delta.content);

        const reasoning = delta.reasoning_content ?? delta.reasoning;
        if (typeof reasoning === 'string') {
            reasoningContent += reasoning;
        }

        if (Array.isArray(delta.tool_calls)) {
            toolCalls.push(...delta.tool_calls);
        }

        if (choice.finish_reason) {
            finishReason = choice.finish_reason;
        }
    }

    return {
        choices: [{
            finish_reason: finishReason,
            message: {
                content,
                reasoning_content: reasoningContent,
                tool_calls: toolCalls.length > 0 ? toolCalls : null
            }
        }]
    };
};

const aggregateResponsesAPIStream = (payloads: any[]): AIResponsesAPIResponse => {
    let outputText = '';
    let finalResponse: AIResponsesAPIResponse | undefined;

    for (const payload of payloads) {
        if (payload?.type === 'error') {
            throw new Error(`AI stream error: ${payload.message || getStreamErrorMessage(payload) || 'unknown error'}`);
        }

        if (payload?.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
            outputText += payload.delta;
        }

        if (payload?.response && typeof payload.type === 'string' && payload.type.startsWith('response.')) {
            finalResponse = payload.response;
        }
    }

    if (finalResponse?.status === 'failed') {
        throw new Error(`AI response failed: ${finalResponse.error?.message || 'unknown error'}`);
    }

    if (!finalResponse) {
        return { output_text: outputText };
    }

    if (!extractResponsesAPIText(finalResponse) && outputText) {
        return { ...finalResponse, output_text: outputText };
    }

    return finalResponse;
};

/**
 * 读取 AI 响应体，兼容普通 JSON 与 SSE 流式响应（部分代理即使未请求 stream 也会返回 SSE）
 */
export const readAIResponseData = async (
    response: Response,
    config: AIConfig
): Promise<AIChatResponse | AIResponsesAPIResponse> => {
    const body = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (isEventStreamBody(contentType, body)) {
        const payloads = parseEventStreamPayloads(body);
        if (payloads.length === 0) {
            throw new AIRuntimeError('response_format', 'AI stream response contained no data');
        }

        return getApiType(config) === 'responses'
            ? aggregateResponsesAPIStream(payloads)
            : aggregateChatCompletionStream(payloads);
    }

    if (!body.trim()) {
        throw new AIRuntimeError('response_format', 'AI response body was empty');
    }

    try {
        return JSON.parse(body);
    } catch (error) {
        throw new AIRuntimeError(
            'response_format',
            `AI response was not valid JSON: ${body.trim().slice(0, 200)}`,
            error
        );
    }
};
