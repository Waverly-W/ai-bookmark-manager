import type { AIConfig } from './aiConfigUtils';

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
