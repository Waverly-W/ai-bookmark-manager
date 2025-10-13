import { AIConfig, decodeApiKey } from './aiConfigUtils';
import { getCurrentPrompt, formatPrompt, enhancePromptForBatch, formatBatchPrompt, parseBatchRenameResponse } from './aiPromptUtils';

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
 * @returns AI响应内容
 */
const callAIAPI = async (
    config: AIConfig,
    prompt: string,
    maxTokens: number = 100
): Promise<string> => {
    const { apiUrl, apiKey, modelId } = config;
    
    // 构建完整的API URL
    const endpoint = apiUrl.endsWith('/') 
        ? `${apiUrl}chat/completions` 
        : `${apiUrl}/chat/completions`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: maxTokens
            })
        });
        
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
 * 测试AI连接
 * @param config AI配置
 * @returns 测试结果
 */
export const testAIConnection = async (config: AIConfig): Promise<TestConnectionResult> => {
    try {
        // 发送一个简单的测试请求
        const testPrompt = 'Say "Hello" if you can read this.';
        const response = await callAIAPI(config, testPrompt, 10);
        
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
 * @returns 重命名结果
 */
export const renameBookmarkWithAI = async (
    config: AIConfig,
    bookmarkUrl: string,
    currentTitle: string,
    locale?: string
): Promise<AIRenameResult> => {
    try {
        // 获取当前的Prompt模板
        const promptTemplate = await getCurrentPrompt(locale);

        // 格式化Prompt（替换占位符）
        const prompt = formatPrompt(promptTemplate, bookmarkUrl, currentTitle);
        
        // 调用AI API
        const newTitle = await callAIAPI(config, prompt, 50);
        
        // 清理返回的标题（移除可能的引号、换行等）
        const cleanedTitle = newTitle
            .replace(/^["']|["']$/g, '')  // 移除首尾引号
            .replace(/\n/g, ' ')           // 替换换行为空格
            .trim();
        
        // 验证标题长度
        if (cleanedTitle.length === 0) {
            return {
                success: false,
                error: 'AI returned an empty title'
            };
        }
        
        if (cleanedTitle.length > 100) {
            // 如果标题过长，截断
            return {
                success: true,
                newTitle: cleanedTitle.substring(0, 100)
            };
        }
        
        return {
            success: true,
            newTitle: cleanedTitle
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
    onProgress?: (current: number, total: number) => void
): Promise<Array<{
    id: string;
    originalTitle: string;
    newTitle?: string;
    success: boolean;
    error?: string;
}>> => {
    const results = [];
    const total = bookmarks.length;
    
    for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        
        // 调用进度回调
        if (onProgress) {
            onProgress(i + 1, total);
        }
        
        // 调用AI重命名
        const result = await renameBookmarkWithAI(
            config,
            bookmark.url,
            bookmark.title,
            locale
        );
        
        results.push({
            id: bookmark.id,
            originalTitle: bookmark.title,
            newTitle: result.newTitle,
            success: result.success,
            error: result.error
        });
        
        // 添加延迟以避免API速率限制（每次请求间隔500ms）
        if (i < bookmarks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return results;
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
    onProgress?: (current: number, total: number) => void,
    useIndividualRequests: boolean = false
): Promise<Array<{
    id: string;
    originalTitle: string;
    newTitle?: string;
    success: boolean;
    error?: string;
}>> => {
    // 如果选择逐个请求模式，使用原有的逐个处理逻辑
    if (useIndividualRequests) {
        return await batchRenameBookmarks(config, bookmarks, locale, onProgress);
    }

    try {
        // 获取用户配置的Prompt模板
        const userPrompt = await getCurrentPrompt(locale);

        // 增强Prompt以支持批量一致性
        const enhancedTemplate = enhancePromptForBatch(userPrompt, locale);

        // 格式化最终的批量Prompt
        const batchPrompt = formatBatchPrompt(
            enhancedTemplate,
            bookmarks.map(b => ({ url: b.url, title: b.title })),
            locale
        );

        // 调用进度回调（开始处理）
        if (onProgress) {
            onProgress(0, bookmarks.length);
        }

        // 模拟渐进式进度更新
        const progressInterval = setInterval(() => {
            if (onProgress) {
                // 在0-90%之间随机增长，为最终结果留出10%
                const currentProgress = Math.min(90, Math.random() * 20 + 10);
                onProgress(Math.floor(currentProgress * bookmarks.length / 100), bookmarks.length);
            }
        }, 200);

        try {
            // 调用AI API进行批量处理
            const response = await fetch(`${config.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${decodeApiKey(config.apiKey)}`
                },
                body: JSON.stringify({
                    model: config.modelId,
                    messages: [
                        {
                            role: 'user',
                            content: batchPrompt
                        }
                    ],
                    temperature: 0.3, // 降低温度以提高一致性
                    max_tokens: Math.min(4000, bookmarks.length * 50) // 根据书签数量动态调整
                })
            });

            // 清除进度模拟
            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content;

            if (!aiResponse) {
                throw new Error('AI API returned empty response');
            }

            // 解析AI返回的批量结果
            const parsedResults = parseBatchRenameResponse(aiResponse);

            // 调用进度回调（处理完成）
            if (onProgress) {
                onProgress(bookmarks.length, bookmarks.length);
            }
        } catch (error) {
            // 确保清除进度模拟
            clearInterval(progressInterval);
            throw error;
        }

        // 构建最终结果
        const results = bookmarks.map((bookmark, index) => {
            const aiResult = parsedResults.find(r => r.index === index + 1);

            if (aiResult && aiResult.newTitle) {
                // 清理AI返回的标题
                const cleanedTitle = aiResult.newTitle
                    .replace(/^["']|["']$/g, '')  // 移除首尾引号
                    .replace(/\n/g, ' ')           // 替换换行为空格
                    .trim();

                return {
                    id: bookmark.id,
                    originalTitle: bookmark.title,
                    newTitle: cleanedTitle.length > 0 ? cleanedTitle : undefined,
                    success: cleanedTitle.length > 0,
                    error: cleanedTitle.length === 0 ? 'AI returned empty title' : undefined
                };
            } else {
                return {
                    id: bookmark.id,
                    originalTitle: bookmark.title,
                    success: false,
                    error: 'AI did not return a title for this bookmark'
                };
            }
        });

        return results;
    } catch (error) {
        console.error('Batch rename with consistency failed:', error);

        // 如果批量处理失败，返回所有书签的失败结果
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
