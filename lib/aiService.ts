import { AIConfig, decodeApiKey } from './aiConfigUtils';
import { getCurrentPrompt, formatPrompt, enhancePromptForBatch, formatBatchPrompt, parseBatchRenameResponse, getDefaultPrompt } from './aiPromptUtils';
import { getFolderForDomain } from './recommendationStorage'; // Import storage utils
import { AIScenario } from './ai/types';
import { bookmarkRenameScenario, formatBookmarkRenameSystemPrompt, BookmarkRenameInput, BookmarkRenameOutput } from "./ai/scenarios/bookmarkRename";
import { folderRecommendationScenario, formatFolderRecommendationSystemPrompt } from "./ai/scenarios/folderRecommendation";
import { contextualBookmarkRenameScenario, formatContextualBookmarkRenameSystemPrompt } from "./ai/scenarios/contextualBookmarkRename";
import { autoTaggingScenario, formatAutoTaggingSystemPrompt } from "./ai/scenarios/autoTagging";
import { getTopTags } from './tagStorage';

/**
 * AI API响应接口
 */
interface AIResponse {
    choices: Array<{
        message: {
            content: string;
        };
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


// 通用异步工具：延迟
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 统一 API 端点构造（处理尾斜杠）
const buildEndpoint = (apiUrl: string, path: string = 'chat/completions'): string => {
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return `${baseUrl}/${path}`;
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
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // 合并外部信号到我们的 controller
        const externalSignal = init.signal ?? opts?.signal;
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort();
            } else {
                externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
            }
        }

        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok && attempt < retries && (response.status === 429 || response.status >= 500)) {
                await sleep(backoffMs * Math.pow(2, attempt));
                continue;
            }

            return response;
        } catch (e: any) {
            clearTimeout(timeoutId);
            lastError = e;
            const aborted = e?.name === 'AbortError';
            if (aborted || attempt >= retries) {
                throw e;
            }
            await sleep(backoffMs * Math.pow(2, attempt));
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
    error?: string;
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
    maxTokens: number = 1000, // Increased default for JSON
    options?: AIRequestOptions,
    responseFormat?: { type: "text" | "json_object" | "json_schema"; json_schema?: any }
): Promise<string> => {
    const { apiUrl, apiKey, modelId } = config;

    // 构建完整的API URL
    const endpoint = buildEndpoint(apiUrl);

    try {
        const messages: any[] = [];

        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        messages.push({
            role: 'user',
            content: prompt
        });

        // 构建请求体
        const requestBody: any = {
            model: modelId,
            messages: messages,
            temperature: 0.7,
            max_tokens: maxTokens
        };

        // 如果有 response_format，添加到请求体
        if (responseFormat) {
            requestBody.response_format = responseFormat;
        }

        const response = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        }, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const data: AIResponse = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from AI');
        }

        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('AI API call failed:', error);
        throw error;
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
    locale: string = 'zh_CN'
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
        1000,
        undefined,
        {
            type: "json_object"
        }
    );

    // 4. 解析结果
    try {
        const jsonResponse = JSON.parse(responseContent);
        return scenario.parseResponse(jsonResponse);
    } catch (error) {
        console.error('Failed to parse AI response as JSON:', error, responseContent);
        throw new Error('AI response was not valid JSON');
    }
};

/**
 * 测试AI连接
 * @param config AI配置
 * @returns 测试结果
 */
export const testAIConnection = async (config: AIConfig): Promise<TestConnectionResult> => {
    try {
        // 发送一个简单的测试请求
        const testPrompt = 'Say "Hello" if you can read this.';
        // callAIAPI signature: (config, prompt, systemPrompt, maxTokens, options, responseFormat)
        const response = await callAIAPI(config, testPrompt, undefined, 10);

        // 检查响应是否有效
        if (response && response.length > 0) {
            return {
                success: true,
                message: 'Connection successful! AI is responding correctly.'
            };
        } else {
            return {
                success: false,
                message: 'Connection failed',
                error: 'Empty response from AI'
            };
        }
    } catch (error) {
        console.error('Test connection failed:', error);
        return {
            success: false,
            message: 'Connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * 使用AI重命名书签
 * @param config AI配置
 * @param bookmarkUrl 书签URL
 * @param currentTitle 当前标题
 * @param locale 当前语言（可选，用于获取默认Prompt）
 * @param referenceBookmarks 参考书签标题列表（可选，用于保持命名风格一致）
 * @returns 重命名结果
 */
/**
 * 使用AI重命名书签
 * @param config AI配置
 * @param bookmarkUrl 书签URL
 * @param currentTitle 当前标题
 * @param locale 当前语言（可选，用于获取默认Prompt）
 * @param referenceBookmarks 参考书签标题列表（可选，用于保持命名风格一致）
 * @returns 重命名结果
 */
export const renameBookmarkWithAI = async (
    config: AIConfig,
    bookmarkUrl: string,
    currentTitle: string,
    locale?: string,
    referenceBookmarks?: string[]
): Promise<AIRenameResult> => {
    try {
        // 判断是否使用参考格式
        const useReference = referenceBookmarks && referenceBookmarks.length >= 3;

        // 获取当前的 User Prompt 模板
        // Note: getCurrentPrompt now should ideally return the User Prompt for the scenario
        // For backward compatibility or simplicity, we might need to adjust how we get the prompt.
        // Let's assume getCurrentPrompt returns the User Prompt string.
        let userPromptTemplate = await getCurrentPrompt(locale);

        // If useReference is true, we might want to append reference info to the User Prompt
        // or handle it within the scenario. For now, let's keep it simple and maybe append it?
        // The original logic switched templates entirely.
        if (useReference) {
            // If using reference, we might need a different User Prompt or append to it.
            // The new system separates System and User prompts.
            // The reference bookmarks should probably be part of the User Prompt context.
            const referenceText = `\n\n参考书签标题（同一文件夹中的现有书签）：\n${referenceBookmarks.join('\n')}\n\n请参考以上书签的命名风格。`;
            userPromptTemplate += referenceText;
        }

        // 动态构建 System Prompt (因为包含 URL 和 Title)
        const systemPrompt = formatBookmarkRenameSystemPrompt(bookmarkUrl, currentTitle, locale);

        // 执行场景
        const result = await executeScenario(
            config,
            bookmarkRenameScenario,
            { url: bookmarkUrl, title: currentTitle },
            userPromptTemplate,
            systemPrompt,
            locale
        );

        return {
            success: true,
            newTitle: result.newTitle
        };
    } catch (error) {
        console.error('AI rename failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * 批量重命名书签
 * @param config AI配置
 * @param bookmarks 书签列表 {id, url, title}
 * @param locale 当前语言（可选，用于获取默认Prompt）
 * @param onProgress 进度回调
 * @returns 重命名结果列表
 */
export const batchRenameBookmarks = async (
    config: AIConfig,
    bookmarks: Array<{ id: string; url: string; title: string }>,
    locale?: string,
    onProgress?: (current: number, total: number, result?: {
        id: string;
        originalTitle: string;
        newTitle?: string;
        success: boolean;
        error?: string;
    }) => void,
    signal?: AbortSignal,
    maxConcurrency: number = 1
): Promise<Array<{
    id: string;
    originalTitle: string;
    newTitle?: string;
    success: boolean;
    error?: string;
}>> => {
    const results: Array<{ index: number; result: any }> = [];
    const total = bookmarks.length;
    const controller = new ConcurrencyController(maxConcurrency);

    // 创建所有任务
    const tasks = bookmarks.map((bookmark, index) =>
        controller.run(async () => {
            // 检查是否被中止
            if (signal?.aborted) {
                throw new Error('Batch rename cancelled');
            }

            // 调用AI重命名
            const result = await renameBookmarkWithAI(
                config,
                bookmark.url,
                bookmark.title,
                locale
            );

            results.push({
                index,
                result: {
                    id: bookmark.id,
                    originalTitle: bookmark.title,
                    newTitle: result.newTitle,
                    success: result.success,
                    error: result.error
                }
            });

            // 调用进度回调
            if (onProgress) {
                onProgress(results.length, total, {
                    id: bookmark.id,
                    originalTitle: bookmark.title,
                    newTitle: result.newTitle,
                    success: result.success,
                    error: result.error
                });
            }

            // 添加延迟以避免API速率限制（每次请求间隔500ms）
            if (results.length < total) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        })
    );

    // 等待所有任务完成
    await Promise.all(tasks);

    // 按原始顺序返回结果
    return results
        .sort((a, b) => a.index - b.index)
        .map(r => r.result);
};

/**
 * 批量重命名书签（带一致性增强）
 * @param config AI配置
 * @param bookmarks 书签列表 {id, url, title}
 * @param locale 当前语言（可选，用于获取默认Prompt）
 * @param onProgress 进度回调
 * @param useIndividualRequests 是否使用逐个请求模式（提供真实进度但速度较慢）
 * @returns 重命名结果列表
 */
export const batchRenameBookmarksWithConsistency = async (
    config: AIConfig,
    bookmarks: Array<{ id: string; url: string; title: string }>,
    locale?: string,
    onProgress?: (current: number, total: number, result?: {
        id: string;
        originalTitle: string;
        newTitle?: string;
        success: boolean;
        error?: string;
    }) => void,
    _deprecated_useIndividualRequests: boolean = false, // Ignored, kept for signature compatibility temporarily
    options?: AIRequestOptions
): Promise<Array<{
    id: string;
    originalTitle: string;
    newTitle?: string;
    success: boolean;
    error?: string;
}>> => {
    // Strategy:
    // 1. If <= 5 bookmarks, use concurrent individual requests (fast enough, robust).
    // 2. If > 5 bookmarks, use Micro-Batching (chunks of 5) to save tokens/requests while maintaining progress updates.

    // Mode 1: Small Batch (Concurrent Individual)
    if (bookmarks.length <= 5) {
        return await batchRenameBookmarks(
            config,
            bookmarks,
            locale,
            onProgress,
            options?.signal,
            5 // Max concurrency
        );
    }

    // Mode 2: Large Batch (Micro-Chunking)
    try {
        if (options?.signal?.aborted) {
            throw new Error('Batch rename cancelled');
        }

        const CHUNK_SIZE = 5;
        const results: Array<any> = [];
        const total = bookmarks.length;

        // Helper to chunk array
        const chunks = [];
        for (let i = 0; i < total; i += CHUNK_SIZE) {
            chunks.push(bookmarks.slice(i, i + CHUNK_SIZE));
        }

        let processedCount = 0;

        // Get basic prompt once
        const userPrompt = await getCurrentPrompt(locale);
        const enhancedTemplate = enhancePromptForBatch(userPrompt, locale);

        for (const chunk of chunks) {
            if (options?.signal?.aborted) throw new Error('Batch rename cancelled');

            try {
                // Prepare prompt for this chunk
                const batchPrompt = formatBatchPrompt(
                    enhancedTemplate,
                    chunk.map(b => ({ url: b.url, title: b.title })),
                    locale
                );

                // Call AI
                const endpoint = buildEndpoint(config.apiUrl);
                const response = await fetchWithRetry(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.modelId,
                        messages: [
                            {
                                role: 'user',
                                content: batchPrompt
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 1500 // 5 items * ~300 tokens
                    })
                }, options);

                if (!response.ok) {
                    throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const aiResponse = data.choices?.[0]?.message?.content || '';

                // Parse results for this chunk
                // Note: parseBatchRenameResponse expects 1-based indexes relative to the batch
                // We need to map them back to the original items
                const parsedChunkResults = parseBatchRenameResponse(aiResponse);

                // Map chunk results to full results
                chunk.forEach((bookmark, localIndex) => {
                    const aiResult = parsedChunkResults.find(r => r.index === localIndex + 1);
                    const newTitle = aiResult?.newTitle
                        ? aiResult.newTitle.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                        : undefined;

                    const resultObj = {
                        id: bookmark.id,
                        originalTitle: bookmark.title,
                        newTitle: newTitle,
                        success: !!newTitle,
                        error: !newTitle ? 'AI returned empty title' : undefined
                    };

                    results.push(resultObj);

                    // Notify progress for each item (simulated burst)
                    if (onProgress) {
                        onProgress(processedCount + localIndex + 1, total, resultObj);
                    }
                });

            } catch (chunkError) {
                console.error('Micro-batch failed:', chunkError);
                // Mark entire chunk as failed
                chunk.forEach(bookmark => {
                    const failResult = {
                        id: bookmark.id,
                        originalTitle: bookmark.title,
                        success: false,
                        error: chunkError instanceof Error ? chunkError.message : 'Batch failed'
                    };
                    results.push(failResult);
                    if (onProgress) onProgress(results.length, total, failResult);
                });
            }

            processedCount += chunk.length;

            // Small delay between chunks
            if (processedCount < total) {
                await sleep(300);
            }
        }

        return results;

    } catch (error) {
        console.error('Smart batch rename failed:', error);
        return bookmarks.map(bookmark => ({
            id: bookmark.id,
            originalTitle: bookmark.title,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }));
    }
};

/**
 * 检测批量重命名结果的风格一致性
 * @param titles 新标题数组
 * @returns 一致性检测结果
 */
export const detectStyleConsistency = (titles: string[]): {
    isConsistent: boolean;
    issues: string[];
    suggestions: string[];
} => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 检查输入参数
    if (!titles || !Array.isArray(titles) || titles.length < 2) {
        return { isConsistent: true, issues, suggestions };
    }

    // 检测分隔符一致性
    const separators = [' | ', ' - ', '·', ' · ', ' / ', ' — '];
    const usedSeparators = new Set<string>();

    titles.forEach(title => {
        separators.forEach(sep => {
            if (title.includes(sep)) {
                usedSeparators.add(sep);
            }
        });
    });

    if (usedSeparators.size > 1) {
        issues.push('使用了多种不同的分隔符');
        suggestions.push('建议统一使用一种分隔符，如" | "或" - "');
    }

    // 检测长度一致性
    const lengths = titles.map(t => t.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const lengthVariance = lengths.some(len => Math.abs(len - avgLength) > avgLength * 0.5);

    if (lengthVariance) {
        issues.push('标题长度差异较大');
        suggestions.push('建议保持标题长度相对一致');
    }

    // 检测格式一致性（简单的模式检测）
    const patterns = titles.map(title => {
        // 检测是否有分隔符
        const hasSeparator = separators.some(sep => title.includes(sep));
        // 检测是否有括号
        const hasParentheses = title.includes('(') || title.includes('（');
        // 检测是否有特殊符号
        const hasSpecialChars = /[|·—\-\/]/.test(title);

        return {
            hasSeparator,
            hasParentheses,
            hasSpecialChars
        };
    });

    // 检查模式是否一致
    const firstPattern = patterns[0];
    const isPatternConsistent = patterns.every(pattern =>
        pattern.hasSeparator === firstPattern.hasSeparator &&
        pattern.hasParentheses === firstPattern.hasParentheses
    );

    if (!isPatternConsistent) {
        issues.push('标题格式模式不一致');
        suggestions.push('建议所有标题使用相同的格式模式');
    }

    return {
        isConsistent: issues.length === 0,
        issues,
        suggestions
    };
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
        // 1. [Hybrid] Check Domain Rule first
        const boundFolderId = await getFolderForDomain(url);
        if (boundFolderId) {
            // Find path in allFolders string list: "[ID: <id>] <path>"
            const idTag = `[ID: ${boundFolderId}]`;
            const matchedString = allFolders.find(s => s.includes(idTag));

            if (matchedString) {
                // Extract path: remove "[ID: ...]" prefix
                // Format is usually "[ID: 123] Path/To/Folder"
                // Let's rely on the fact that the path is everything after the tag (and maybe a space)
                const folderPath = matchedString.replace(idTag, '').trim();

                return {
                    success: true,
                    recommendations: [{
                        folderId: boundFolderId,
                        folderPath: folderPath,
                        reason: 'Matched domain rule (you saved this site here before)'
                    }]
                };
            }
        }

        // 获取 User Prompt (通常是默认的，或者从配置获取)
        // 这里简化处理，直接使用场景默认的，后续可以接入配置
        const userPromptTemplate = folderRecommendationScenario.defaultUserPrompt;

        // 动态构建 System Prompt
        const systemPrompt = formatFolderRecommendationSystemPrompt(url, title, allFolders, locale);

        // 执行场景
        const result = await executeScenario(
            config,
            folderRecommendationScenario,
            { url, title, allFolders },
            userPromptTemplate,
            systemPrompt,
            locale
        );

        return {
            success: true,
            recommendations: result.recommendations
        };
    } catch (error) {
        console.error('AI folder recommendation failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
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
        // 获取 User Prompt
        const userPromptTemplate = contextualBookmarkRenameScenario.defaultUserPrompt;

        // 动态构建 System Prompt
        const systemPrompt = formatContextualBookmarkRenameSystemPrompt(url, title, currentFolder, otherBookmarks, locale);

        // 执行场景
        const result = await executeScenario(
            config,
            contextualBookmarkRenameScenario,
            { url, title, currentFolder, otherBookmarks },
            userPromptTemplate,
            systemPrompt,
            locale
        );

        return {
            success: true,
            newTitle: result.newTitle
        };
    } catch (error) {
        console.error('AI contextual rename failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
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
        // 1. Get existing tags for context
        const topTags = await getTopTags(50);

        // 2. Prepare Prompts
        const userPromptTemplate = autoTaggingScenario.defaultUserPrompt;
        const systemPrompt = formatAutoTaggingSystemPrompt(url, title, topTags, locale);

        // 3. Execute Scenario
        const result = await executeScenario(
            config,
            autoTaggingScenario,
            { url, title, existingTags: topTags },
            userPromptTemplate,
            systemPrompt,
            locale
        );

        return {
            success: true,
            tags: result.tags
        };
    } catch (error) {
        console.error('AI auto-tagging failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

import { batchClassificationScenario, formatBatchClassificationSystemPrompt, BatchClassificationOutput } from "./ai/scenarios/batchClassification";
import { formatBookmarkListForClassification, formatFolderListForPrompt } from "./aiPromptUtils";

/**
 * 批量分类书签
 * @param config AI配置
 * @param bookmarks 书签列表
 * @param allFolders 所有文件夹列表
 * @param locale 当前语言
 * @returns 分类结果
 */
export const batchClassifyBookmarks = async (
    config: AIConfig,
    bookmarks: Array<{ id: string; title: string; url: string }>,
    allFolders: any[], // BookmarkNode[] or similar structure
    locale: string = 'zh_CN'
): Promise<{ success: boolean; classifications?: BatchClassificationOutput['classifications']; error?: string }> => {
    try {
        // 1. 格式化文件夹列表 (复用现有的 formatFolderListForPrompt)
        const foldersStr = formatFolderListForPrompt(allFolders, 100, locale);

        // 2. 格式化书签列表
        const bookmarksStr = formatBookmarkListForClassification(bookmarks);

        // 3. 准备 Prompt
        const userPromptTemplate = batchClassificationScenario.defaultUserPrompt;
        const systemPrompt = formatBatchClassificationSystemPrompt(bookmarksStr, foldersStr, locale);

        // 4. 执行场景
        const result = await executeScenario(
            config,
            batchClassificationScenario,
            { bookmarks, allFolders: [foldersStr] },
            userPromptTemplate,
            systemPrompt,
            locale
        );

        return {
            success: true,
            classifications: result.classifications
        };
    } catch (error) {
        console.error('AI batch classification failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};
