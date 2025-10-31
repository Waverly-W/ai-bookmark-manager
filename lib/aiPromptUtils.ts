import { browser } from "wxt/browser";
import { configSyncManager } from "./configSyncManager";

/**
 * 默认的中文Prompt模板
 */
export const DEFAULT_PROMPT_ZH = `请根据以下书签的URL和当前标题，生成一个简洁、描述性的中文标题。

要求：
1. 不超过30个字符
2. 准确反映网页内容
3. 便于搜索和识别
4. 只返回新标题，不要有其他说明文字

书签URL: {url}
当前标题: {title}

新标题：`;

/**
 * 默认的英文Prompt模板
 */
export const DEFAULT_PROMPT_EN = `Based on the following bookmark's URL and current title, generate a concise and descriptive title.

Requirements:
1. No more than 50 characters
2. Accurately reflect the page content
3. Easy to search and identify
4. Return only the new title, no additional text

Bookmark URL: {url}
Current Title: {title}

New Title:`;

/**
 * 存储键名
 */
const STORAGE_KEYS = {
    CUSTOM_PROMPT: 'aiCustomPrompt',
    USE_CUSTOM_PROMPT: 'aiUseCustomPrompt'
};

/**
 * 获取默认Prompt模板（根据当前语言）
 * @param locale 当前语言代码
 * @returns 默认Prompt模板
 */
export const getDefaultPrompt = (locale: string = 'zh_CN'): string => {
    return locale.startsWith('zh') ? DEFAULT_PROMPT_ZH : DEFAULT_PROMPT_EN;
};

/**
 * 保存自定义Prompt模板（自动同步到其他设备）
 * @param prompt 自定义Prompt模板
 */
export const saveCustomPrompt = async (prompt: string): Promise<void> => {
    try {
        await configSyncManager.saveConfig(STORAGE_KEYS.CUSTOM_PROMPT, prompt);
        await configSyncManager.saveConfig(STORAGE_KEYS.USE_CUSTOM_PROMPT, true);
    } catch (error) {
        console.error('Failed to save custom prompt:', error);
        throw new Error('Failed to save custom prompt template');
    }
};

/**
 * 获取当前使用的Prompt模板
 * @param locale 当前语言代码
 * @returns 当前Prompt模板
 */
export const getCurrentPrompt = async (locale: string = 'zh_CN'): Promise<string> => {
    try {
        const useCustom = await configSyncManager.getConfig(STORAGE_KEYS.USE_CUSTOM_PROMPT);
        const customPrompt = await configSyncManager.getConfig(STORAGE_KEYS.CUSTOM_PROMPT);

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultPrompt(locale);
    } catch (error) {
        console.error('Failed to get current prompt:', error);
        return getDefaultPrompt(locale);
    }
};

/**
 * 检查是否使用自定义Prompt
 * @returns 是否使用自定义Prompt
 */
export const isUsingCustomPrompt = async (): Promise<boolean> => {
    try {
        const useCustom = await configSyncManager.getConfig(STORAGE_KEYS.USE_CUSTOM_PROMPT);
        return useCustom || false;
    } catch (error) {
        console.error('Failed to check custom prompt status:', error);
        return false;
    }
};

/**
 * 恢复默认Prompt模板（自动同步到其他设备）
 */
export const restoreDefaultPrompt = async (): Promise<void> => {
    try {
        await configSyncManager.saveConfig(STORAGE_KEYS.USE_CUSTOM_PROMPT, false);
    } catch (error) {
        console.error('Failed to restore default prompt:', error);
        throw new Error('Failed to restore default prompt template');
    }
};

/**
 * 清除自定义Prompt
 */
export const clearCustomPrompt = async (): Promise<void> => {
    try {
        await browser.storage.local.remove([
            STORAGE_KEYS.CUSTOM_PROMPT,
            STORAGE_KEYS.USE_CUSTOM_PROMPT
        ]);
    } catch (error) {
        console.error('Failed to clear custom prompt:', error);
        throw new Error('Failed to clear custom prompt');
    }
};

/**
 * 格式化Prompt模板（替换占位符）
 * @param template Prompt模板
 * @param url 书签URL
 * @param title 书签标题
 * @returns 格式化后的Prompt
 */
export const formatPrompt = (template: string, url: string, title: string): string => {
    return template
        .replace(/{url}/g, url)
        .replace(/{title}/g, title);
};

/**
 * 验证Prompt模板
 * @param prompt Prompt模板
 * @returns 验证结果
 */
export const validatePrompt = (prompt: string): {
    valid: boolean;
    errors: string[];
} => {
    const errors: string[] = [];
    
    if (!prompt || prompt.trim() === '') {
        errors.push('Prompt template cannot be empty');
    }
    
    if (prompt && prompt.length < 20) {
        errors.push('Prompt template is too short (minimum 20 characters)');
    }
    
    if (prompt && prompt.length > 2000) {
        errors.push('Prompt template is too long (maximum 2000 characters)');
    }
    
    // 检查是否包含占位符（建议但不强制）
    const hasUrlPlaceholder = prompt.includes('{url}');
    const hasTitlePlaceholder = prompt.includes('{title}');
    
    if (!hasUrlPlaceholder && !hasTitlePlaceholder) {
        // 这只是警告，不是错误
        console.warn('Prompt template does not contain {url} or {title} placeholders');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * 为批量重命名增强Prompt模板
 * @param userPrompt 用户配置的原始Prompt模板
 * @param locale 当前语言
 * @returns 增强后的批量Prompt模板
 */
export const enhancePromptForBatch = (userPrompt: string, locale: string = 'zh_CN'): string => {
    const isZh = locale.startsWith('zh');

    // 批量一致性约束（中文）
    const batchConstraintsZh = `你将收到一批书签，请为它们生成统一风格的标题。

重要要求：
1. 所有标题必须使用相同的格式模板和结构
2. 使用一致的分隔符（如统一使用" | "、" - "或"·"）
3. 使用一致的描述词汇（如都用"社区"或都用"论坛"，不要混用）
4. 保持相似的长度和风格，便于用户识别这是同一批次处理的结果
5. 如果某些书签属于同类网站，应该使用相同的分类词汇

用户的重命名规则：
${userPrompt}

书签列表：
{bookmarkList}

请严格按照JSON格式返回结果，确保所有标题风格统一：
[
  {"index": 1, "newTitle": "新标题1"},
  {"index": 2, "newTitle": "新标题2"}
]`;

    // 批量一致性约束（英文）
    const batchConstraintsEn = `You will receive a batch of bookmarks. Please generate titles with consistent style for all of them.

Important Requirements:
1. All titles must use the same format template and structure
2. Use consistent separators (e.g., consistently use " | ", " - ", or "·")
3. Use consistent descriptive vocabulary (e.g., all use "community" or all use "forum", don't mix)
4. Maintain similar length and style so users can recognize this is a batch-processed result
5. If some bookmarks belong to the same category of websites, use the same classification terms

User's renaming rules:
${userPrompt}

Bookmark list:
{bookmarkList}

Please return results strictly in JSON format, ensuring all titles have consistent style:
[
  {"index": 1, "newTitle": "New Title 1"},
  {"index": 2, "newTitle": "New Title 2"}
]`;

    return isZh ? batchConstraintsZh : batchConstraintsEn;
};

/**
 * 格式化批量书签列表为Prompt文本
 * @param bookmarks 书签列表
 * @param locale 当前语言
 * @returns 格式化的书签列表文本
 */
export const formatBookmarkListForPrompt = (
    bookmarks: Array<{ url: string; title: string }>,
    locale: string = 'zh_CN'
): string => {
    const isZh = locale.startsWith('zh');
    const currentTitleLabel = isZh ? '当前标题' : 'Current Title';

    return bookmarks
        .map((bookmark, index) => `${index + 1}. URL: ${bookmark.url}, ${currentTitleLabel}: ${bookmark.title}`)
        .join('\n');
};

/**
 * 格式化批量Prompt（替换书签列表占位符）
 * @param enhancedTemplate 增强后的批量Prompt模板
 * @param bookmarks 书签列表
 * @param locale 当前语言
 * @returns 最终的批量Prompt
 */
export const formatBatchPrompt = (
    enhancedTemplate: string,
    bookmarks: Array<{ url: string; title: string }>,
    locale: string = 'zh_CN'
): string => {
    const bookmarkList = formatBookmarkListForPrompt(bookmarks, locale);
    return enhancedTemplate.replace(/{bookmarkList}/g, bookmarkList);
};

/**
 * 解析AI返回的批量重命名结果
 * @param aiResponse AI的响应文本
 * @returns 解析后的结果数组
 */
export const parseBatchRenameResponse = (aiResponse: string): Array<{ index: number; newTitle: string }> => {
    try {
        // 尝试直接解析JSON
        const parsed = JSON.parse(aiResponse);
        if (Array.isArray(parsed)) {
            return parsed.filter(item =>
                typeof item === 'object' &&
                typeof item.index === 'number' &&
                typeof item.newTitle === 'string'
            );
        }
    } catch (error) {
        console.warn('Failed to parse JSON response, trying alternative parsing');
    }

    // 如果JSON解析失败，尝试从文本中提取结构化信息
    try {
        const results: Array<{ index: number; newTitle: string }> = [];
        const lines = aiResponse.split('\n');

        for (const line of lines) {
            // 匹配类似 "1. 新标题" 或 "{"index": 1, "newTitle": "标题"}" 的格式
            const jsonMatch = line.match(/\{\s*"index"\s*:\s*(\d+)\s*,\s*"newTitle"\s*:\s*"([^"]+)"\s*\}/);
            if (jsonMatch) {
                results.push({
                    index: parseInt(jsonMatch[1]),
                    newTitle: jsonMatch[2]
                });
                continue;
            }

            // 匹配简单的数字列表格式
            const listMatch = line.match(/^\s*(\d+)\.\s*(.+)$/);
            if (listMatch) {
                results.push({
                    index: parseInt(listMatch[1]),
                    newTitle: listMatch[2].trim()
                });
            }
        }

        return results;
    } catch (error) {
        console.error('Failed to parse batch rename response:', error);
        return [];
    }
};
