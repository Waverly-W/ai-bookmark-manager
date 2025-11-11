import { AIConfig, isAIConfigured } from './aiConfigUtils';
import { BookmarkFolder } from './bookmarkUtils';
import {
    getCurrentFolderRecommendationPrompt,
    formatFolderListForPrompt,
    formatFolderRecommendationPrompt
} from './aiPromptUtils';
import { AIRequestOptions } from './aiService';

/**
 * 页面上下文信息
 */
export interface PageContext {
    url: string;              // 页面 URL
    title: string;            // 页面标题
    description?: string;     // 页面描述（可选）
    keywords?: string[];      // 页面关键词（可选）
    content?: string;         // 页面内容摘要（可选，最多 500 字符）
}

/**
 * 文件夹推荐结果
 */
export interface FolderRecommendation {
    folderId: string;         // 推荐的文件夹 ID
    folderPath: string;       // 文件夹完整路径（如 "工作 > 项目 > 前端"）
    confidence: number;       // 置信度 (0-1)
    reason?: string;          // 推荐理由（可选）
}

/**
 * 推荐选项
 */
export interface RecommendationOptions {
    timeoutMs?: number;       // 超时时间（默认 10000ms）
    includeReason?: boolean;  // 是否包含推荐理由（默认 false）
    fallbackToDefault?: boolean; // 失败时是否降级到默认文件夹（默认 true）
    signal?: AbortSignal;     // 取消信号
    locale?: string;          // 语言代码（默认 'zh_CN'）
    maxRecommendations?: number; // 最大推荐数量（默认 1）
}

/**
 * 推荐结果（包含状态）
 */
export interface RecommendationResult {
    success: boolean;
    recommendations?: FolderRecommendation[]; // 改为数组
    error?: string;
    fallback?: boolean;       // 是否是降级结果
}

/**
 * 调用 AI API 进行推荐
 */
async function callAIForRecommendation(
    config: AIConfig,
    prompt: string,
    options?: AIRequestOptions
): Promise<string> {
    const { apiUrl, apiKey, modelId } = config;

    // 构建 API 端点
    const endpoint = apiUrl.endsWith('/')
        ? `${apiUrl}chat/completions`
        : `${apiUrl}/chat/completions`;

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 10000);

    try {
        // 构建请求体
        const requestBody: any = {
            model: modelId,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3, // 降低温度以提高一致性
            max_tokens: 150,
            // 启用 JSON Mode 确保返回标准 JSON 格式
            response_format: { type: 'json_object' }
        };

        console.log('[FolderRecommendation] 启用 JSON Mode，请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: options?.signal || controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from AI');
        }

        return data.choices[0].message.content.trim();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * 解析 AI 多推荐响应
 */
function parseMultiRecommendationResponse(
    response: string,
    folders: BookmarkFolder[],
    maxRecommendations: number
): FolderRecommendation[] {
    console.log('[FolderRecommendation] AI 原始响应:', response);

    // 扁平化文件夹列表
    const flattenFolders = (folders: BookmarkFolder[], result: any[] = []): any[] => {
        for (const folder of folders) {
            if (folder.id === 'all') continue;

            result.push({
                id: folder.id,
                path: folder.path || folder.title,
                title: folder.title
            });

            if (folder.children && folder.children.length > 0) {
                flattenFolders(folder.children, result);
            }
        }
        return result;
    };

    const flatFolders = flattenFolders(folders);

    // 清理响应文本：移除 markdown 代码块标记
    let cleanedResponse = response.trim();

    // 移除可能的 markdown 代码块标记
    if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    console.log('[FolderRecommendation] 清理后的响应:', cleanedResponse);

    // 尝试解析 JSON
    try {
        const json = JSON.parse(cleanedResponse);
        console.log('[FolderRecommendation] 解析后的 JSON:', json);

        // 支持两种格式：
        // 1. 新格式（JSON Mode）: {"recommendations": [...]}
        // 2. 旧格式（兼容）: [...]
        let recommendationsArray: any[] = [];

        if (json.recommendations && Array.isArray(json.recommendations)) {
            // 新格式：JSON Mode 返回的对象格式
            recommendationsArray = json.recommendations;
            console.log('[FolderRecommendation] 使用新格式（JSON Mode）');
        } else if (Array.isArray(json)) {
            // 旧格式：直接返回数组（向后兼容）
            recommendationsArray = json;
            console.log('[FolderRecommendation] 使用旧格式（数组）');
        } else {
            console.warn('[FolderRecommendation] 响应格式不正确:', typeof json);
        }

        if (recommendationsArray.length > 0) {
            const recommendations: FolderRecommendation[] = [];

            for (const item of recommendationsArray) {
                if (item.index !== undefined) {
                    const index = parseInt(item.index);
                    const confidence = item.confidence !== undefined ? parseFloat(item.confidence) : 0.8;
                    const reason = item.reason || '';

                    if (index === 0) {
                        // 默认书签栏
                        recommendations.push({
                            folderId: '1',
                            folderPath: '书签栏',
                            confidence,
                            reason
                        });
                    } else {
                        const folder = flatFolders[index - 1];
                        if (folder) {
                            recommendations.push({
                                folderId: folder.id,
                                folderPath: folder.path,
                                confidence,
                                reason
                            });
                        } else {
                            console.warn(`[FolderRecommendation] 索引 ${index} 超出范围，文件夹总数: ${flatFolders.length}`);
                        }
                    }
                }

                // 限制推荐数量
                if (recommendations.length >= maxRecommendations) {
                    break;
                }
            }

            if (recommendations.length > 0) {
                console.log('[FolderRecommendation] 成功解析推荐:', recommendations);
                return recommendations;
            } else {
                console.warn('[FolderRecommendation] 解析后没有有效的推荐结果');
            }
        }
    } catch (e) {
        console.error('[FolderRecommendation] JSON 解析失败:', e);
        console.error('[FolderRecommendation] 失败的响应文本:', cleanedResponse);
    }

    // 降级：返回默认书签栏
    console.log('[FolderRecommendation] 使用默认降级方案');
    return [{
        folderId: '1',
        folderPath: '书签栏',
        confidence: 0.5,
        reason: '无法解析推荐结果，使用默认文件夹'
    }];
}

/**
 * 解析 AI 推荐响应（单个推荐）
 */
function parseRecommendationResponse(
    response: string,
    folders: BookmarkFolder[],
    includeReason: boolean
): FolderRecommendation {
    console.log('[FolderRecommendation] 单推荐模式 - AI 原始响应:', response);

    // 扁平化文件夹列表
    const flattenFolders = (folders: BookmarkFolder[], result: any[] = []): any[] => {
        for (const folder of folders) {
            if (folder.id === 'all') continue;

            result.push({
                id: folder.id,
                path: folder.path || folder.title,
                title: folder.title
            });

            if (folder.children && folder.children.length > 0) {
                flattenFolders(folder.children, result);
            }
        }
        return result;
    };

    const flatFolders = flattenFolders(folders);

    // 清理响应文本
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    // 1. 尝试解析 JSON（带推荐理由）
    if (includeReason) {
        try {
            const json = JSON.parse(cleanedResponse);
            console.log('[FolderRecommendation] 单推荐模式 - 解析后的 JSON:', json);

            // 支持两种格式：
            // 1. 新格式（JSON Mode）: {"recommendation": {"index": ..., "reason": ..., "confidence": ...}}
            // 2. 旧格式（兼容）: {"index": ..., "reason": ..., "confidence": ...}
            let recommendationData = json.recommendation || json;

            if (recommendationData.index !== undefined) {
                const index = parseInt(recommendationData.index);
                if (index === 0) {
                    // 返回默认书签栏
                    return {
                        folderId: '1',
                        folderPath: '书签栏',
                        confidence: 0.5,
                        reason: recommendationData.reason || '使用默认文件夹'
                    };
                }

                const folder = flatFolders[index - 1];
                if (folder) {
                    return {
                        folderId: folder.id,
                        folderPath: folder.path,
                        confidence: recommendationData.confidence !== undefined ? parseFloat(recommendationData.confidence) : 0.9,
                        reason: recommendationData.reason
                    };
                }
            }
        } catch (e) {
            console.warn('[FolderRecommendation] 单推荐模式 - JSON 解析失败:', e);
        }
    }

    // 2. 尝试提取数字
    const match = response.match(/\d+/);
    if (match) {
        const index = parseInt(match[0]);

        if (index === 0) {
            // 返回默认书签栏
            return {
                folderId: '1',
                folderPath: '书签栏',
                confidence: 0.5
            };
        }

        const folder = flatFolders[index - 1];
        if (folder) {
            return {
                folderId: folder.id,
                folderPath: folder.path,
                confidence: 0.7
            };
        }
    }

    // 3. 降级到默认书签栏
    return {
        folderId: '1',
        folderPath: '书签栏',
        confidence: 0
    };
}

/**
 * 主推荐函数
 * @param pageContext 页面上下文信息
 * @param folders 可用的文件夹列表
 * @param config AI 配置
 * @param options 推荐选项
 * @returns 推荐结果
 */
export async function recommendFolder(
    pageContext: PageContext,
    folders: BookmarkFolder[],
    config: AIConfig,
    options?: RecommendationOptions
): Promise<RecommendationResult> {
    // 1. 验证输入
    if (!pageContext.url || !pageContext.title) {
        return {
            success: false,
            error: 'Invalid page context: URL and title are required'
        };
    }

    if (!folders || folders.length === 0) {
        return {
            success: false,
            error: 'No folders available'
        };
    }

    // 2. 检查 AI 配置
    const configured = await isAIConfigured();
    if (!configured) {
        if (options?.fallbackToDefault !== false) {
            return {
                success: true,
                recommendations: [{
                    folderId: '1',
                    folderPath: '书签栏',
                    confidence: 0
                }],
                fallback: true
            };
        }
        return { success: false, error: 'AI not configured' };
    }

    try {
        // 3. 准备 Prompt
        const locale = options?.locale || 'zh_CN';
        const includeReason = options?.includeReason || false;
        const maxRecommendations = options?.maxRecommendations || 1;
        const multiRecommendation = maxRecommendations > 1;

        const folderList = formatFolderListForPrompt(folders, 50, locale);
        const promptTemplate = await getCurrentFolderRecommendationPrompt(locale, includeReason, multiRecommendation);
        const prompt = formatFolderRecommendationPrompt(
            promptTemplate,
            pageContext.url,
            pageContext.title,
            folderList,
            maxRecommendations
        );

        // 4. 调用 AI API
        const response = await callAIForRecommendation(config, prompt, {
            timeoutMs: options?.timeoutMs || 10000,
            signal: options?.signal
        });

        // 5. 解析响应
        let recommendations: FolderRecommendation[];

        if (multiRecommendation) {
            // 多推荐模式
            recommendations = parseMultiRecommendationResponse(response, folders, maxRecommendations);
        } else {
            // 单推荐模式（向后兼容）
            const singleRecommendation = parseRecommendationResponse(response, folders, includeReason);
            recommendations = [singleRecommendation];
        }

        // 6. 验证推荐结果
        if (recommendations.length > 0 && recommendations[0].folderId) {
            return {
                success: true,
                recommendations
            };
        }

        // 7. 降级处理
        if (options?.fallbackToDefault !== false) {
            return {
                success: true,
                recommendations: [{
                    folderId: '1',
                    folderPath: '书签栏',
                    confidence: 0
                }],
                fallback: true
            };
        }

        return { success: false, error: 'Invalid recommendation' };

    } catch (error) {
        console.error('Folder recommendation failed:', error);

        // 8. 错误处理 - 降级
        if (options?.fallbackToDefault !== false) {
            return {
                success: true,
                recommendations: [{
                    folderId: '1',
                    folderPath: '书签栏',
                    confidence: 0
                }],
                fallback: true
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * 批量推荐（用于批量整理书签）
 * @param bookmarks 书签列表（包含 URL 和标题）
 * @param folders 可用的文件夹列表
 * @param config AI 配置
 * @param onProgress 进度回调
 * @param options 推荐选项
 * @returns 批量推荐结果
 */
export async function batchRecommendFolders(
    bookmarks: Array<{ id: string; url: string; title: string }>,
    folders: BookmarkFolder[],
    config: AIConfig,
    onProgress?: (current: number, total: number) => void,
    options?: RecommendationOptions
): Promise<Array<{
    bookmarkId: string;
    recommendation?: FolderRecommendation;
    success: boolean;
    error?: string;
}>> {
    const results: Array<{
        bookmarkId: string;
        recommendation?: FolderRecommendation;
        success: boolean;
        error?: string;
    }> = [];

    const total = bookmarks.length;

    // 逐个处理书签
    for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];

        // 检查是否被中止
        if (options?.signal?.aborted) {
            // 剩余的书签标记为失败
            for (let j = i; j < bookmarks.length; j++) {
                results.push({
                    bookmarkId: bookmarks[j].id,
                    success: false,
                    error: 'Batch recommendation cancelled'
                });
            }
            break;
        }

        try {
            // 调用推荐服务
            const result = await recommendFolder(
                {
                    url: bookmark.url,
                    title: bookmark.title
                },
                folders,
                config,
                options
            );

            results.push({
                bookmarkId: bookmark.id,
                recommendation: result.recommendation,
                success: result.success,
                error: result.error
            });

            // 调用进度回调
            if (onProgress) {
                onProgress(i + 1, total);
            }

            // 添加延迟以避免 API 速率限制（每次请求间隔 500ms）
            if (i < bookmarks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            results.push({
                bookmarkId: bookmark.id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // 调用进度回调
            if (onProgress) {
                onProgress(i + 1, total);
            }
        }
    }

    return results;
}
