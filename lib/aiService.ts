import { AIConfig, decodeApiKey } from './aiConfigUtils';
import {
    getCurrentPrompt,
    getCurrentAutoTagPrompt,
    formatAutoTagPrompt,
    getCurrentBackupConflictPrompt,
    getCurrentMarkdownFormatPrompt,
    getCurrentFolderRecommendationPrompt,
    getCurrentContextualRenamePrompt
} from './aiPromptUtils';
import { AIScenario } from './ai/types';
import { bookmarkRenameScenario, formatBookmarkRenameSystemPrompt, BookmarkRenameInput, BookmarkRenameOutput } from "./ai/scenarios/bookmarkRename";
import { folderRecommendationScenario, formatFolderRecommendationSystemPrompt } from "./ai/scenarios/folderRecommendation";
import { contextualBookmarkRenameScenario, formatContextualBookmarkRenameSystemPrompt } from "./ai/scenarios/contextualBookmarkRename";
import { autoTaggingScenario, formatAutoTaggingSystemPrompt } from "./ai/scenarios/autoTagging";
import {
    backupConflictResolutionScenario,
    formatBackupConflictResolutionSystemPrompt
} from "./ai/scenarios/backupConflictResolution";
import { getTopTags } from './tagStorage';
import type { MergeConflict, AIConflictResolution } from './webdavSync';
import { AIRuntimeError, normalizeAIError, parseAIJsonResponse } from './aiRuntimeUtils';
import { readAIResponseData } from './aiApiCompat';
import { batchClassificationScenario, getBatchClassificationUserPrompt } from "./ai/scenarios/batchClassification";
import { cleanGeneratedTitle, createBatchBookmarkRenameScenario } from "./ai/scenarios/batchBookmarkRename";
import {
    chunkItems,
    normalizeClassifications,
    toClassificationFolders,
    type BookmarkClassification,
    type ClassifiableBookmark
} from './bookmarkClassification';

/**
 * AI API响应接口
 */
interface AIResponse {
    choices: Array<{
        finish_reason?: string | null;
        message: {
            content?: string | Array<{
                type?: string;
                text?: string;
            }>;
            reasoning_content?: string;
            refusal?: string;
            tool_calls?: unknown[] | null;
        };
    }>;
}

interface ResponsesAPIResponse {
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

// 请求可选参数（供超时、重试、取消等）
export interface AIRequestOptions {
    timeoutMs?: number;
    retries?: number;
    backoffMs?: number;
    signal?: AbortSignal;
    maxConcurrency?: number; // 最大并发数（仅用于逐个模式）
}

interface AIGenerationOptions {
    maxTokens?: number;
    temperature?: number;
    label?: string;
    requireComplete?: boolean; // 输出被截断时视为失败（用于直接落盘的纯文本输出）
}

interface FolderRecommendationItem {
    folderId?: string;
    id?: string;
    folderPath?: string;
    path?: string;
    reason?: string;
}

interface AvailableFolder {
    id: string;
    path: string;
}

const JSON_RETRY_SUFFIX = '\nReturn valid json only. The response must be json.';
type AIResponseFormat = { type: "text" | "json_object" | "json_schema"; json_schema?: any };

const getApiType = (config: AIConfig): NonNullable<AIConfig['apiType']> => {
    return config.apiType ?? 'chat_completions';
};

export const extractResponseText = (message?: AIResponse['choices'][number]['message']): string => {
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

const hasUsableResponse = (choice?: AIResponse['choices'][number]): boolean => {
    if (!choice) {
        return false;
    }

    if (extractResponseText(choice.message).length > 0) {
        return true;
    }

    if (Array.isArray(choice.message?.tool_calls) && choice.message.tool_calls.length > 0) {
        return true;
    }

    return choice.finish_reason === 'stop' || choice.finish_reason === 'length';
};

const shouldRetryWithExplicitJsonInstruction = (
    status: number,
    errorText: string,
    responseFormat?: AIResponseFormat
): boolean => {
    if (status !== 400 || !responseFormat || responseFormat.type === 'text') {
        return false;
    }

    const normalizedError = errorText.toLowerCase();
    return normalizedError.includes('json_object') && normalizedError.includes("contain the word 'json'");
};

const extractResponsesAPIText = (data: ResponsesAPIResponse): string => {
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

const throwIfResponsesAPIIncomplete = (data: ResponsesAPIResponse): void => {
    if (data.status !== 'incomplete') {
        return;
    }

    const reason = data.incomplete_details?.reason;
    if (reason === 'max_output_tokens') {
        throw new AIRuntimeError(
            'incomplete',
            'AI response was incomplete because max_output_tokens was exhausted'
        );
    }

    throw new AIRuntimeError(
        'incomplete',
        `AI response was incomplete${reason ? `: ${reason}` : ''}`
    );
};

const TRUNCATED_FINISH_REASONS = new Set(['length', 'max_tokens', 'content_filter']);

const throwIfChatCompletionTruncated = (data: AIResponse): void => {
    const finishReason = data.choices?.[0]?.finish_reason;
    if (finishReason && TRUNCATED_FINISH_REASONS.has(finishReason)) {
        throw new AIRuntimeError('incomplete', `AI response was incomplete: ${finishReason}`);
    }
};

export const extractAIResponseContent = (data: AIResponse | ResponsesAPIResponse, config: AIConfig): string => {
    if (getApiType(config) === 'responses') {
        return extractResponsesAPIText(data as ResponsesAPIResponse);
    }

    const chatData = data as AIResponse;
    return extractResponseText(chatData.choices?.[0]?.message);
};

const hasUsableAIResponse = (data: AIResponse | ResponsesAPIResponse, config: AIConfig): boolean => {
    if (extractAIResponseContent(data, config).length > 0) {
        return true;
    }

    if (getApiType(config) === 'responses') {
        return false;
    }

    return hasUsableResponse((data as AIResponse).choices?.[0]);
};


// 通用异步工具：延迟
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 统一 API 端点构造（处理尾斜杠）
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
    maxTokens: number | null, // null 表示不限制，交由模型默认上限
    responseFormat?: AIResponseFormat,
    generation?: AIGenerationOptions
): any => {
    const temperature = generation?.temperature ?? 0.7;

    if (getApiType(config) === 'responses') {
        const requestBody: any = {
            model: config.modelId,
            input: userPrompt,
            temperature,
            store: false
        };

        if (maxTokens !== null) {
            requestBody.max_output_tokens = maxTokens;
        }

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
        temperature
    };

    if (maxTokens !== null) {
        requestBody.max_tokens = maxTokens;
    }

    if (responseFormat) {
        requestBody.response_format = responseFormat;
    }

    return requestBody;
};

// 简单的并发控制器
class ConcurrencyController {
    private running = 0;
    private queue: Array<() => Promise<any>> = [];

    constructor(private maxConcurrency: number = 1) { }

    async run<T>(fn: () => Promise<T>): Promise<T> {
        while (this.running >= this.maxConcurrency) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
        }
    }
}

// 带超时与指数退避重试的 fetch 封装（默认超时 30s，重试 2 次，基础退避 800ms）
async function fetchWithRetry(
    url: string,
    init: RequestInit,
    opts?: { timeoutMs?: number; retries?: number; backoffMs?: number; signal?: AbortSignal }
): Promise<Response> {
    const timeoutMs = opts?.timeoutMs ?? 30000;
    const retries = opts?.retries ?? 2;
    const backoffMs = opts?.backoffMs ?? 800;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);

        // 合并外部信号到我们的 controller
        const externalSignal = init.signal ?? opts?.signal;
        const abortFromExternal = () => controller.abort();
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort();
            } else {
                externalSignal.addEventListener('abort', abortFromExternal, { once: true });
            }
        }

        try {
            const response = await fetch(url, { ...init, signal: controller.signal });

            if (!response.ok && attempt < retries && (response.status === 429 || response.status >= 500)) {
                await sleep(backoffMs * Math.pow(2, attempt));
                continue;
            }

            return response;
        } catch (error) {
            const normalizedError = normalizeAIError(error, {
                timedOut,
                timeoutMs,
                cancelled: Boolean(externalSignal?.aborted && !timedOut)
            });
            lastError = normalizedError;

            if (normalizedError.code === 'cancelled' || normalizedError.code === 'timeout' || attempt >= retries) {
                throw normalizedError;
            }
            await sleep(backoffMs * Math.pow(2, attempt));
        } finally {
            clearTimeout(timeoutId);
            externalSignal?.removeEventListener('abort', abortFromExternal);
        }
    }

    // 理论上不会到达这里
    throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed');
}

/**
 * 测试连接结果接口
 */
export interface TestConnectionResult {
    success: boolean;
    message: string;
    messageKey?: string;
    error?: string;
    errorKey?: string;
}

/**
 * AI重命名结果接口
 */
export interface AIRenameResult {
    success: boolean;
    newTitle?: string;
    error?: string;
}

/**
 * 调用AI API
 * @param config AI配置
 * @param prompt 提示词
 * @param maxTokens 最大token数
 * @param useJsonMode 是否启用 JSON Mode（确保返回标准 JSON 格式）
 * @returns AI响应内容
 */
/**
 * 调用AI API
 * @param config AI配置
 * @param prompt 提示词 (User Message)
 * @param systemPrompt 系统提示词 (System Message)
 * @param maxTokens 最大token数
 * @param responseFormat 响应格式配置 (JSON Schema)
 * @returns AI响应内容
 */
const callAIAPI = async (
    config: AIConfig,
    prompt: string,
    systemPrompt?: string,
    maxTokens: number | null = 1000, // Increased default for JSON; null 表示不限制
    options?: AIRequestOptions,
    responseFormat?: AIResponseFormat,
    generation?: AIGenerationOptions
): Promise<string> => {
    const { apiUrl, apiKey, modelId } = config;
    const requestLabel = generation?.label || 'generic';

    // 构建完整的API URL
    const endpoint = buildAIEndpoint(config);

    try {
        const sendRequest = async (userPrompt: string) => {
            const requestBody = buildAIRequestBody(
                config,
                userPrompt,
                systemPrompt,
                maxTokens,
                responseFormat,
                generation
            );

            const startTime = performance.now();
            const response = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            }, options);

            return {
                requestBody,
                response,
                elapsedMs: Math.round(performance.now() - startTime)
            };
        };

        let { requestBody, response, elapsedMs } = await sendRequest(prompt);

        if (!response.ok) {
            const errorText = await response.text();
            if (shouldRetryWithExplicitJsonInstruction(response.status, errorText, responseFormat)) {
                const retriedRequest = await sendRequest(`${prompt}${JSON_RETRY_SUFFIX}`);
                requestBody = retriedRequest.requestBody;
                response = retriedRequest.response;
                elapsedMs = retriedRequest.elapsedMs;

                if (!response.ok) {
                    const retryErrorText = await response.text();
                    throw new AIRuntimeError(
                        'http',
                        `API request failed: ${response.status} ${response.statusText}. ${retryErrorText}`,
                        undefined,
                        response.status
                    );
                }
            } else {
                throw new AIRuntimeError(
                    'http',
                    `API request failed: ${response.status} ${response.statusText}. ${errorText}`,
                    undefined,
                    response.status
                );
            }
        }

        const data = await readAIResponseData(response, config) as AIResponse | ResponsesAPIResponse;
        if (getApiType(config) === 'responses') {
            throwIfResponsesAPIIncomplete(data as ResponsesAPIResponse);
        } else if (generation?.requireComplete) {
            throwIfChatCompletionTruncated(data as AIResponse);
        }
        const responseContent = extractAIResponseContent(data, config);

        if (!responseContent) {
            throw new Error('No response from AI');
        }

        console.log(`[AI] ${requestLabel} completed in ${elapsedMs}ms`, {
            modelId,
            promptChars: prompt.length,
            systemPromptChars: systemPrompt?.length || 0,
            maxTokens,
            temperature: requestBody.temperature,
            apiType: getApiType(config)
        });

        return responseContent;
    } catch (error) {
        throw normalizeAIError(error);
    }
};

/**
 * 执行 AI 场景
 * @param config AI配置
 * @param scenario AI场景定义
 * @param input 输入数据
 * @param userPromptTemplate 用户自定义的 Prompt 模板 (可选，默认使用场景定义的 defaultUserPrompt)
 * @returns 解析后的输出
 */
export const executeScenario = async <InputType, OutputType>(
    config: AIConfig,
    scenario: AIScenario<InputType, OutputType>,
    input: InputType,
    userPromptTemplate?: string,
    systemPromptOverride?: string, // Allow overriding system prompt (e.g. for dynamic injection)
    locale: string = 'zh_CN',
    generation?: AIGenerationOptions,
    requestOptions?: AIRequestOptions
): Promise<OutputType> => {
    // 1. 准备 System Prompt
    const systemPrompt = systemPromptOverride || scenario.getSystemPrompt(locale);

    // 2. 准备 User Prompt
    const template = userPromptTemplate || scenario.defaultUserPrompt;
    const userPrompt = scenario.formatUserPrompt(template, input);

    // 3. 调用 API
    const responseContent = await callAIAPI(
        config,
        userPrompt,
        systemPrompt,
        generation?.maxTokens ?? 1000,
        requestOptions,
        {
            type: "json_object"
        },
        {
            temperature: generation?.temperature,
            label: generation?.label ?? scenario.id,
            requireComplete: generation?.requireComplete
        }
    );

    // 4. 解析并校验结果
    try {
        const jsonResponse = parseAIJsonResponse(responseContent, scenario.responseSchema.schema);
        return scenario.parseResponse(jsonResponse);
    } catch (error) {
        if (error instanceof AIRuntimeError) {
            throw error;
        }
        throw new AIRuntimeError('response_format', 'AI response could not be parsed', error);
    }
};

/**
 * 测试AI连接
 * @param config AI配置
 * @returns 测试结果
 */
export const testAIConnection = async (config: AIConfig): Promise<TestConnectionResult> => {
    try {
        const endpoint = buildAIEndpoint(config);
        const requestBody = buildAIRequestBody(
            config,
            'Reply with exactly "Hello".',
            undefined,
            32,
            undefined,
            { temperature: 0, label: 'connection-test' }
        );

        const response = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: 'Connection failed',
                messageKey: 'connectionFailed',
                error: `API request failed: ${response.status} ${response.statusText}. ${errorText}`
            };
        }

        const data = await readAIResponseData(response, config) as AIResponse | ResponsesAPIResponse;
        if (hasUsableAIResponse(data, config)) {
            return {
                success: true,
                message: 'Connection successful. The model accepted the request and returned a completion.',
                messageKey: 'connectionTestSucceeded'
            };
        }

        return {
            success: false,
            message: 'Connection failed',
            messageKey: 'connectionFailed',
            error: 'The model returned no usable content.',
            errorKey: 'connectionTestNoUsableContent'
        };
    } catch (error) {
        const normalizedError = normalizeAIError(error);
        console.warn('[AI] Connection test failed', {
            code: normalizedError.code,
            message: normalizedError.message
        });
        return {
            success: false,
            message: 'Connection failed',
            messageKey: 'connectionFailed',
            error: normalizedError.message,
            errorKey: normalizedError.message ? undefined : 'unknownError'
        };
    }
};

const normalizeFolderPath = (path: string): string => {
    return path
        .trim()
        .replace(/\s*>\s*/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '')
        .toLowerCase();
};

const parseAvailableFolders = (allFolders: string[]): AvailableFolder[] => {
    return allFolders
        .map((folder) => {
            const match = folder.match(/^\[ID:\s*([^\]]+)\]\s*(.+)$/);
            if (!match) {
                return null;
            }

            return {
                id: match[1].trim(),
                path: match[2].trim()
            };
        })
        .filter((folder): folder is AvailableFolder => Boolean(folder));
};

const normalizeFolderRecommendations = (
    recommendations: FolderRecommendationItem[] | undefined,
    allFolders: string[]
): Array<{ folderId: string; folderPath: string; reason?: string }> => {
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
        return [];
    }

    const availableFolders = parseAvailableFolders(allFolders);
    const foldersById = new Map(availableFolders.map((folder) => [folder.id, folder]));
    const foldersByPath = new Map(availableFolders.map((folder) => [normalizeFolderPath(folder.path), folder]));
    const normalized: Array<{ folderId: string; folderPath: string; reason?: string }> = [];
    const seenIds = new Set<string>();

    for (const recommendation of recommendations) {
        const candidateId = String(recommendation.folderId ?? recommendation.id ?? '').trim();
        const candidatePath = String(recommendation.folderPath ?? recommendation.path ?? '').trim();

        let matchedFolder = candidateId ? foldersById.get(candidateId) : undefined;
        if (!matchedFolder && candidatePath) {
            matchedFolder = foldersByPath.get(normalizeFolderPath(candidatePath));
        }

        if (!matchedFolder || seenIds.has(matchedFolder.id)) {
            continue;
        }

        seenIds.add(matchedFolder.id);
        normalized.push({
            folderId: matchedFolder.id,
            folderPath: matchedFolder.path,
            reason: recommendation.reason
        });
    }

    return normalized;
};

/**
 * 使用AI重命名书签（不参考同文件夹的其他书签）
 * @param config AI配置
 * @param bookmarkUrl 书签URL
 * @param currentTitle 当前标题
 * @param locale 当前语言（用于获取默认Prompt）
 * @returns 重命名结果
 */
export const renameBookmarkWithAI = async (
    config: AIConfig,
    bookmarkUrl: string,
    currentTitle: string,
    locale?: string
): Promise<AIRenameResult> => {
    try {
        const userPromptTemplate = await getCurrentPrompt(locale);
        // System Prompt 中包含 URL 和标题，需要按书签动态生成
        const systemPrompt = formatBookmarkRenameSystemPrompt(bookmarkUrl, currentTitle, locale);

        const result = await executeScenario(
            config,
            bookmarkRenameScenario,
            { url: bookmarkUrl, title: currentTitle },
            userPromptTemplate,
            systemPrompt,
            locale,
            {
                maxTokens: 80,
                temperature: 0.2,
                label: 'bookmark-rename'
            }
        );

        return {
            success: true,
            newTitle: result.newTitle
        };
    } catch (error) {
        const normalizedError = normalizeAIError(error);
        console.warn('[AI] Rename failed', {
            code: normalizedError.code,
            message: normalizedError.message
        });
        return {
            success: false,
            error: normalizedError.message
        };
    }
};

export interface BatchRenameItemResult {
    id: string;
    originalTitle: string;
    newTitle?: string;
    success: boolean;
    error?: string;
}

// 同一批次内的标题由一次请求生成，风格才能统一；批次过大则输出容易被截断
export const BATCH_RENAME_CHUNK_SIZE = 10;

/**
 * 批量重命名书签：每 BATCH_RENAME_CHUNK_SIZE 个书签一次请求，经 callAIAPI 发出。
 * 某一批失败只影响该批书签；取消时抛出 code 为 cancelled 的 AIRuntimeError。
 */
export const batchRenameBookmarks = async (
    config: AIConfig,
    bookmarks: Array<{ id: string; url: string; title: string }>,
    locale: string = 'zh_CN',
    onProgress?: (current: number, total: number, result?: BatchRenameItemResult) => void,
    options?: { signal?: AbortSignal }
): Promise<BatchRenameItemResult[]> => {
    const total = bookmarks.length;
    const results: BatchRenameItemResult[] = [];
    const rules = await getCurrentPrompt(locale);
    const scenario = createBatchBookmarkRenameScenario(locale);

    const report = (result: BatchRenameItemResult) => {
        results.push(result);
        onProgress?.(results.length, total, result);
    };

    for (const chunk of chunkItems(bookmarks, BATCH_RENAME_CHUNK_SIZE)) {
        if (options?.signal?.aborted) {
            throw new AIRuntimeError('cancelled', 'Batch rename cancelled');
        }

        try {
            const output = await executeScenario(
                config,
                scenario,
                { bookmarks: chunk.map(({ url, title }) => ({ url, title })) },
                rules,
                undefined,
                locale,
                {
                    maxTokens: 512 + chunk.length * 64,
                    temperature: 0.3,
                    label: 'batch-rename',
                    requireComplete: true
                },
                { signal: options?.signal }
            );

            chunk.forEach((bookmark, localIndex) => {
                const aiResult = output.results.find((item) => item.index === localIndex + 1);
                const newTitle = aiResult ? cleanGeneratedTitle(aiResult.newTitle) : '';
                report({
                    id: bookmark.id,
                    originalTitle: bookmark.title,
                    newTitle: newTitle || undefined,
                    success: Boolean(newTitle),
                    error: newTitle ? undefined : 'AI returned empty title'
                });
            });
        } catch (error) {
            const normalizedError = normalizeAIError(error);
            if (normalizedError.code === 'cancelled') {
                throw normalizedError;
            }
            console.warn('[AI] Batch rename chunk failed', {
                code: normalizedError.code,
                message: normalizedError.message
            });
            chunk.forEach((bookmark) => report({
                id: bookmark.id,
                originalTitle: bookmark.title,
                success: false,
                error: normalizedError.message
            }));
        }
    }

    return results;
};

export type StyleConsistencyIssue = 'mixedSeparators' | 'lengthVariance' | 'patternMismatch';

const STYLE_SEPARATORS = [' | ', ' - ', '·', ' · ', ' / ', ' — '];

/**
 * 检测批量重命名结果的风格一致性。返回问题代码，由界面映射为翻译文案。
 * @param titles 新标题数组
 */
export const detectStyleConsistency = (titles: string[]): {
    isConsistent: boolean;
    issues: StyleConsistencyIssue[];
} => {
    const issues: StyleConsistencyIssue[] = [];

    if (!Array.isArray(titles) || titles.length < 2) {
        return { isConsistent: true, issues };
    }

    const usedSeparators = new Set<string>();
    titles.forEach((title) => {
        STYLE_SEPARATORS.forEach((separator) => {
            if (title.includes(separator)) {
                usedSeparators.add(separator);
            }
        });
    });
    if (usedSeparators.size > 1) {
        issues.push('mixedSeparators');
    }

    const lengths = titles.map((title) => title.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (lengths.some((length) => Math.abs(length - avgLength) > avgLength * 0.5)) {
        issues.push('lengthVariance');
    }

    const patterns = titles.map((title) => ({
        hasSeparator: STYLE_SEPARATORS.some((separator) => title.includes(separator)),
        hasParentheses: title.includes('(') || title.includes('（')
    }));
    const [first] = patterns;
    if (!patterns.every((pattern) =>
        pattern.hasSeparator === first.hasSeparator && pattern.hasParentheses === first.hasParentheses
    )) {
        issues.push('patternMismatch');
    }

    return { isConsistent: issues.length === 0, issues };
};

/**
 * 使用AI推荐文件夹
 * @param config AI配置
 * @param url 书签URL
 * @param title 书签标题
 * @param allFolders 所有文件夹列表
 * @param locale 当前语言
 * @returns 推荐结果
 */
export const recommendFolderWithAI = async (
    config: AIConfig,
    url: string,
    title: string,
    allFolders: string[],
    locale: string = 'zh_CN'
): Promise<{ success: boolean; recommendations?: Array<{ folderId: string; folderPath: string; reason?: string }>; error?: string }> => {
    try {
        // 域名规则由调用方（弹窗）先行判断，这里只负责 AI 推荐
        const userPromptTemplate = await getCurrentFolderRecommendationPrompt(locale);

        // 动态构建 System Prompt
        const systemPrompt = formatFolderRecommendationSystemPrompt(url, title, allFolders, locale);

        // 执行场景
        const result = await executeScenario(
            config,
            folderRecommendationScenario,
            { url, title, allFolders },
            userPromptTemplate,
            systemPrompt,
            locale,
            {
                // Responses API models can consume output tokens while reasoning before emitting JSON.
                maxTokens: 768,
                temperature: 0.2,
                label: 'folder-recommendation'
            }
        );

        return {
            success: true,
            recommendations: normalizeFolderRecommendations(result.recommendations, allFolders)
        };
    } catch (error) {
        const normalizedError = normalizeAIError(error);
        console.warn('[AI] Folder recommendation failed', {
            code: normalizedError.code,
            message: normalizedError.message
        });
        return {
            success: false,
            error: normalizedError.message
        };
    }
};

/**
 * 使用AI结合上下文重命名书签
 * @param config AI配置
 * @param url 书签URL
 * @param title 书签标题
 * @param currentFolder 当前文件夹名称
 * @param otherBookmarks 同文件夹下其他书签标题
 * @param locale 当前语言
 * @returns 重命名结果
 */
export const renameBookmarkContextuallyWithAI = async (
    config: AIConfig,
    url: string,
    title: string,
    currentFolder: string,
    otherBookmarks: string[],
    locale: string = 'zh_CN'
): Promise<{ success: boolean; newTitle?: string; error?: string }> => {
    try {
        const userPromptTemplate = await getCurrentContextualRenamePrompt(locale);

        // 动态构建 System Prompt
        const systemPrompt = formatContextualBookmarkRenameSystemPrompt(url, title, currentFolder, otherBookmarks, locale);

        // 执行场景
        const result = await executeScenario(
            config,
            contextualBookmarkRenameScenario,
            { url, title, currentFolder, otherBookmarks },
            userPromptTemplate,
            systemPrompt,
            locale,
            {
                maxTokens: 256,
                temperature: 0.2,
                label: 'contextual-rename'
            }
        );

        return {
            success: true,
            newTitle: result.newTitle
        };
    } catch (error) {
        const normalizedError = normalizeAIError(error);
        console.warn('[AI] Contextual rename failed', {
            code: normalizedError.code,
            message: normalizedError.message
        });
        return {
            success: false,
            error: normalizedError.message
        };
    }
};

/**
 * Automatically generate tags for a bookmark
 */
export const autoTagBookmark = async (
    config: AIConfig,
    url: string,
    title: string,
    locale: string = 'en'
): Promise<{ success: boolean; tags?: string[]; error?: string }> => {
    try {
        const topTags = await getTopTags(50);
        const userPromptTemplate = await getCurrentAutoTagPrompt(locale);
        const systemPrompt = formatAutoTaggingSystemPrompt(url, title, topTags, locale);

        const result = await executeScenario(
            config,
            autoTaggingScenario,
            { url, title, existingTags: topTags },
            formatAutoTagPrompt(userPromptTemplate, url, title),
            systemPrompt,
            locale,
            {
                maxTokens: 120,
                temperature: 0.2,
                label: 'auto-tagging'
            }
        );

        return {
            success: true,
            tags: result.tags
        };
    } catch (error) {
        const normalizedError = normalizeAIError(error);
        console.warn('[AI] Auto-tagging failed', {
            code: normalizedError.code,
            message: normalizedError.message
        });
        return {
            success: false,
            error: normalizedError.message
        };
    }
};

export interface BatchTaggingItem {
    id: string;
    title: string;
    url: string;
    existingTags?: string[];
}

export interface BatchTaggingResult {
    id: string;
    title: string;
    url: string;
    existingTags: string[];
    suggestedTags?: string[];
    success: boolean;
    error?: string;
}

export const batchTagBookmarks = async (
    config: AIConfig,
    bookmarks: BatchTaggingItem[],
    locale: string = 'en',
    onProgress?: (current: number, total: number, result?: BatchTaggingResult) => void,
    options?: { signal?: AbortSignal; maxConcurrency?: number }
): Promise<BatchTaggingResult[]> => {
    const total = bookmarks.length;
    const maxConcurrency = options?.maxConcurrency ?? 4;
    const controller = new ConcurrencyController(maxConcurrency);
    let processed = 0;

    const toResult = (bookmark: BatchTaggingItem, payload: Partial<BatchTaggingResult>): BatchTaggingResult => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        existingTags: bookmark.existingTags || [],
        success: false,
        ...payload
    });

    try {
        const results = await Promise.all(
            bookmarks.map((bookmark) =>
                controller.run(async () => {
                    if (options?.signal?.aborted) {
                        throw new Error('Batch tagging cancelled');
                    }

                    let result: BatchTaggingResult;
                    try {
                        const response = await autoTagBookmark(config, bookmark.url, bookmark.title, locale);
                        result = toResult(bookmark, {
                            suggestedTags: response.tags || [],
                            success: response.success && !!response.tags?.length,
                            error: response.success ? undefined : response.error
                        });
                    } catch (error) {
                        result = toResult(bookmark, {
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }

                    processed += 1;
                    if (onProgress) {
                        onProgress(processed, total, result);
                    }

                    return result;
                })
            )
        );

        return results;
    } catch (error) {
        console.error('AI batch tagging failed:', error);
        return bookmarks.map((bookmark) =>
            toResult(bookmark, {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        );
    }
};

export const resolveBackupConflictsWithAI = async (
    config: AIConfig,
    conflicts: MergeConflict[],
    preferredSource: 'local' | 'remote',
    locale: string = 'zh_CN'
): Promise<{
    success: boolean;
    resolutions?: AIConflictResolution[];
    error?: string;
}> => {
    try {
        const userPromptTemplate = await getCurrentBackupConflictPrompt(locale);
        const systemPrompt = formatBackupConflictResolutionSystemPrompt(preferredSource, locale);

        const result = await executeScenario(
            config,
            backupConflictResolutionScenario,
            {
                preferredSource,
                conflicts: conflicts.map((conflict) => ({
                    conflictId: conflict.id,
                    section: conflict.section,
                    entityKey: conflict.entityKey,
                    field: conflict.field,
                    localValue: conflict.localValue,
                    remoteValue: conflict.remoteValue
                }))
            },
            userPromptTemplate.replace(/{preferredSource}/g, preferredSource),
            systemPrompt,
            locale,
            {
                maxTokens: 1800,
                temperature: 0.1,
                label: 'backup-conflict-resolution'
            }
        );

        const resolutions: AIConflictResolution[] = result.resolutions.map((resolution) => ({
            conflictId: resolution.conflictId,
            chosenSource: resolution.chosenSource,
            mergedValue: JSON.parse(resolution.mergedValueJson),
            reason: resolution.reason
        }));

        return {
            success: true,
            resolutions
        };
    } catch (error) {
        console.error('AI backup conflict resolution failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

// 每批书签数：太大容易超出输出预算被截断，太小则请求次数多、同类书签分到不同批次
export const CLASSIFICATION_CHUNK_SIZE = 20;
const CLASSIFICATION_MAX_CONCURRENCY = 3;
// 文件夹列表上限，防止 Prompt 过长；超出部分按书签树顺序截断
const CLASSIFICATION_MAX_FOLDERS = 300;

// 推理模型会先消耗输出预算再给出 JSON，所以基础预算留得比较宽
export const getClassificationMaxTokens = (bookmarkCount: number): number => 512 + bookmarkCount * 64;

export interface BatchClassificationResult {
    success: boolean;
    classifications?: BookmarkClassification[];
    /** 请求失败、没有拿到结果的书签数 */
    failedCount?: number;
    error?: string;
}

/**
 * 批量分类书签：按 CLASSIFICATION_CHUNK_SIZE 分块并发请求，
 * 校验 AI 返回的书签 ID 和文件夹 ID，剔除已经在建议位置的书签。
 * 部分批次失败时仍返回其余结果，并在 failedCount / error 中说明。
 */
export const batchClassifyBookmarks = async (
    config: AIConfig,
    bookmarks: ClassifiableBookmark[],
    allFolders: Array<{ id: string; title?: string; path?: string; children?: unknown[] }>,
    locale: string = 'zh_CN',
    options?: { signal?: AbortSignal }
): Promise<BatchClassificationResult> => {
    const folders = toClassificationFolders(allFolders).slice(0, CLASSIFICATION_MAX_FOLDERS);
    if (bookmarks.length === 0) {
        return { success: true, classifications: [], failedCount: 0 };
    }
    if (folders.length === 0) {
        return { success: false, error: 'No folders available' };
    }

    const chunks = chunkItems(bookmarks, CLASSIFICATION_CHUNK_SIZE);
    const controller = new ConcurrencyController(CLASSIFICATION_MAX_CONCURRENCY);
    const userPromptTemplate = getBatchClassificationUserPrompt(locale);
    const chunkResults: BookmarkClassification[][] = [];
    const errors: AIRuntimeError[] = [];
    let failedCount = 0;

    await Promise.all(chunks.map((chunk, index) => controller.run(async () => {
        try {
            if (options?.signal?.aborted) {
                throw new AIRuntimeError('cancelled', 'Batch classification cancelled');
            }
            const result = await executeScenario(
                config,
                batchClassificationScenario,
                { bookmarks: chunk, folders },
                userPromptTemplate,
                undefined,
                locale,
                {
                    maxTokens: getClassificationMaxTokens(chunk.length),
                    temperature: 0.1,
                    label: 'batch-classification',
                    requireComplete: true
                },
                { signal: options?.signal }
            );
            chunkResults[index] = normalizeClassifications(result.classifications, chunk, folders);
        } catch (error) {
            const normalizedError = normalizeAIError(error);
            console.warn('[AI] Batch classification chunk failed', {
                code: normalizedError.code,
                message: normalizedError.message
            });
            errors.push(normalizedError);
            failedCount += chunk.length;
        }
    })));

    if (errors.length === chunks.length) {
        return { success: false, failedCount, error: errors[0].message };
    }

    return {
        success: true,
        classifications: chunkResults.flatMap((results) => results || []),
        failedCount,
        error: errors[0]?.message
    };
};

import { buildMarkdownFormatInstructions, markdownFormatScenario } from './ai/scenarios/markdownFormat';
import { formatMarkdown as formatObsidianMarkdownCore } from './clipper/llm/formatter';
import { contextLengthExceeded, ProviderError, type ModelClient } from './clipper/llm/client';

// 整篇文章排版耗时明显长于书签类场景
const MARKDOWN_FORMAT_TIMEOUT_MS = 120000;

export interface AITextRequest {
    instructions: string;
    input: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    temperature?: number;
    label?: string;
}

/**
 * 统一 AI 出口的纯文本生成：不启用 JSON Mode、不限制输出 token，输出被截断时抛出 incomplete 错误
 */
export const generateAIText = async (config: AIConfig, request: AITextRequest): Promise<string> => {
    return callAIAPI(
        config,
        request.input,
        request.instructions,
        null,
        { timeoutMs: request.timeoutMs, signal: request.signal },
        undefined,
        {
            temperature: request.temperature,
            label: request.label,
            requireComplete: true
        }
    );
};

const PROVIDER_ERROR_CODES: Partial<Record<AIRuntimeError['code'], string>> = {
    cancelled: 'ABORTED',
    timeout: 'TIMEOUT',
    network: 'NETWORK_ERROR',
    incomplete: 'INCOMPLETE_RESPONSE'
};

// 将统一出口的错误映射为剪藏排版器识别的错误码（CONTEXT_LENGTH 会触发分块重试）
const toProviderError = (error: unknown): ProviderError => {
    const normalizedError = normalizeAIError(error);
    const code = normalizedError.code === 'http'
        ? (contextLengthExceeded(normalizedError.status ?? 0, normalizedError.message, normalizedError.message)
            ? 'CONTEXT_LENGTH'
            : 'HTTP_ERROR')
        : PROVIDER_ERROR_CODES[normalizedError.code] ?? 'INVALID_RESPONSE';

    return new ProviderError(normalizedError.message, { code, status: normalizedError.status });
};

const createMarkdownFormatModelClient = (config: AIConfig, timeoutMs: number): ModelClient => ({
    async generate(request) {
        try {
            const text = await generateAIText(config, {
                instructions: request.instructions,
                input: request.input,
                signal: request.signal,
                timeoutMs,
                temperature: 0.2,
                label: markdownFormatScenario.id
            });
            return { text };
        } catch (error) {
            const providerError = toProviderError(error);
            console.warn('[AI] Markdown format request failed', {
                code: providerError.code,
                message: providerError.message
            });
            throw providerError;
        }
    }
});

/**
 * 将提取到的 Markdown 内容调用 AI 整理为 Obsidian 兼容规范格式
 * @param config AI配置
 * @param markdown 待整理 Markdown
 * @param options 可选超时与信号
 * @param locale 语言（决定未自定义时使用的默认排版要求）
 */
export const formatArticleMarkdownWithAI = async (
    config: AIConfig,
    markdown: string,
    options?: AIRequestOptions,
    locale: string = 'zh_CN'
): Promise<{ success: boolean; formattedMarkdown?: string; warning?: string | null; error?: string }> => {
    try {
        const requirements = await getCurrentMarkdownFormatPrompt(locale);
        const client = createMarkdownFormatModelClient(config, options?.timeoutMs ?? MARKDOWN_FORMAT_TIMEOUT_MS);
        const result = await formatObsidianMarkdownCore(markdown, client, {
            signal: options?.signal,
            instructions: buildMarkdownFormatInstructions(requirements, locale)
        });

        return {
            success: true,
            formattedMarkdown: result.markdown,
            warning: result.ok ? null : result.warning
        };
    } catch (error) {
        console.error('AI article markdown format failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};
