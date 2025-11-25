import { browser } from "wxt/browser";
import { configSyncManager } from "./configSyncManager";

/**
 * 默认的中文Prompt模板 (User Prompt)
 */
export const DEFAULT_PROMPT_ZH = `要求：
1. 不超过30个字符
2. 准确反映网页内容
3. 便于搜索和识别
4. 只返回新标题，不要有其他说明文字
5. 格式为：网站名称 | 功能`;

/**
 * 默认的英文Prompt模板 (User Prompt)
 */
export const DEFAULT_PROMPT_EN = `Requirements:
1. No more than 50 characters
2. Accurately reflect the page content
3. Easy to search and identify
4. Return only the new title, no additional text
5. Format: Site Name | Function`;

/**
 * 带参考命名格式的中文 Prompt 模板
 */
export const DEFAULT_PROMPT_WITH_REFERENCE_ZH = `重要：请参考同一文件夹中现有书签的命名风格，保持一致性。

要求：
1. 分析参考书签的命名模式（如：是否使用中英文、是否包含分类标签、长度风格、格式等）
2. 生成的新标题应与参考书签的命名风格保持一致
3. 不超过30个字符
4. 准确反映网页内容
5. 便于搜索和识别
6. 只返回新标题，不要有其他说明文字`;

/**
 * 带参考命名格式的英文 Prompt 模板
 */
export const DEFAULT_PROMPT_WITH_REFERENCE_EN = `IMPORTANT: Please refer to the naming style of existing bookmarks in the same folder to maintain consistency.

Requirements:
1. Analyze the naming pattern of reference bookmarks (e.g., language usage, category labels, length style, format, etc.)
2. The new title should match the naming style of reference bookmarks
3. No more than 50 characters
4. Accurately reflect the page content
5. Easy to search and identify
6. Return only the new title, no additional text`;

/**
 * 默认的文件夹推荐 Prompt 模板（中文）
 */
export const DEFAULT_FOLDER_RECOMMENDATION_PROMPT_ZH = `你是一个智能书签管理助手。请根据以下信息，推荐最合适的书签文件夹。

页面信息：
- URL: {url}
- 标题: {title}

可用文件夹列表：
{folderList}

要求：
1. 分析页面的主题和内容类型
2. 从可用文件夹中选择最合适的一个
3. 只返回文件夹的序号（如 "3"）
4. 如果没有合适的文件夹，返回 "0"（表示使用默认书签栏）

推荐的文件夹序号：`;

/**
 * 默认的文件夹推荐 Prompt 模板（英文）
 */
export const DEFAULT_FOLDER_RECOMMENDATION_PROMPT_EN = `You are an intelligent bookmark management assistant. Please recommend the most suitable bookmark folder based on the following information.

Page Information:
- URL: {url}
- Title: {title}

Available Folders:
{folderList}

Requirements:
1. Analyze the page's theme and content type
2. Select the most suitable folder from the available folders
3. Return only the folder number (e.g., "3")
4. If no suitable folder exists, return "0" (use default bookmarks bar)

Recommended folder number:`;

/**
 * 带推荐理由的文件夹推荐 Prompt 模板（中文）- 单个推荐
 */
export const DEFAULT_FOLDER_RECOMMENDATION_WITH_REASON_PROMPT_ZH = `你是一个智能书签管理助手。请根据以下信息，推荐最合适的书签文件夹，并说明理由。

页面信息：
- URL: {url}
- 标题: {title}

可用文件夹列表：
{folderList}

要求：
1. 分析页面的主题和内容类型
2. 从可用文件夹中选择最合适的一个
3. 推荐理由要简洁明了，不超过20个字
4. 如果没有合适的文件夹，返回 index 为 0

【重要】必须返回 JSON 格式的响应：
{"recommendation": {"index": 序号, "reason": "推荐理由", "confidence": 0.9}}

其中 index 是文件夹列表中的序号（从 1 开始），0 表示默认书签栏。
不要返回任何其他文本或解释，只返回 JSON 对象。`;

/**
 * 带推荐理由的文件夹推荐 Prompt 模板（英文）- 单个推荐
 */
export const DEFAULT_FOLDER_RECOMMENDATION_WITH_REASON_PROMPT_EN = `You are an intelligent bookmark management assistant. Please recommend the most suitable bookmark folder based on the following information and provide a reason.

Page Information:
- URL: {url}
- Title: {title}

Available Folders:
{folderList}

Requirements:
1. Analyze the page's theme and content type
2. Select the most suitable folder from the available folders
3. Keep the reason concise, no more than 30 characters
4. If no suitable folder exists, return index as 0

【IMPORTANT】You MUST return a JSON format response:
{"recommendation": {"index": number, "reason": "explanation", "confidence": 0.9}}

Where index is the folder number from the list (starting from 1), 0 means default bookmarks bar.
Do not return any other text or explanation, only return the JSON object.`;

/**
 * 多推荐文件夹 Prompt 模板（中文）
 */
export const DEFAULT_FOLDER_MULTI_RECOMMENDATION_PROMPT_ZH = `你是一个智能书签管理助手。请根据以下信息，推荐 {maxRecommendations} 个最合适的书签文件夹，并说明理由。

页面信息：
- URL: {url}
- 标题: {title}

可用文件夹列表：
{folderList}

要求：
1. 分析页面的主题和内容类型
2. 从可用文件夹中选择最合适的 {maxRecommendations} 个文件夹，按推荐优先级排序
3. 推荐理由要简洁明了，不超过20个字
4. 置信度范围 0-1，第一个推荐的置信度应该最高
5. 如果合适的文件夹少于 {maxRecommendations} 个，只返回合适的
6. 如果没有合适的文件夹，返回 {"recommendations": [{"index": 0, "reason": "使用默认书签栏", "confidence": 0.5}]}

【重要】必须返回 JSON 格式的响应，格式如下：
{
  "recommendations": [
    {"index": 1, "reason": "推荐理由", "confidence": 0.9},
    {"index": 2, "reason": "推荐理由", "confidence": 0.7}
  ]
}

其中 index 是文件夹列表中的序号（从 1 开始），0 表示默认书签栏。
不要返回任何其他文本或解释，只返回 JSON 对象。`;

/**
 * 多推荐文件夹 Prompt 模板（英文）
 */
export const DEFAULT_FOLDER_MULTI_RECOMMENDATION_PROMPT_EN = `You are an intelligent bookmark management assistant. Please recommend {maxRecommendations} most suitable bookmark folders based on the following information and provide reasons.

Page Information:
- URL: {url}
- Title: {title}

Available Folders:
{folderList}

Requirements:
1. Analyze the page's theme and content type
2. Select the {maxRecommendations} most suitable folders from available folders, sorted by priority
3. Keep the reason concise, no more than 30 characters
4. Confidence range 0-1, the first recommendation should have the highest confidence
5. If there are fewer suitable folders than {maxRecommendations}, return only the suitable ones
6. If no suitable folder exists, return {"recommendations": [{"index": 0, "reason": "Use default bookmarks bar", "confidence": 0.5}]}

【IMPORTANT】You MUST return a JSON format response as follows:
{
  "recommendations": [
    {"index": 1, "reason": "explanation", "confidence": 0.9},
    {"index": 2, "reason": "explanation", "confidence": 0.7}
  ]
}

Where index is the folder number from the list (starting from 1), 0 means default bookmarks bar.
Do not return any other text or explanation, only return the JSON object.`;

/**
 * 默认的上下文重命名 Prompt 模板（中文）
 */
export const DEFAULT_CONTEXTUAL_RENAME_PROMPT_ZH = `要求：
1. 分析同文件夹其他书签的命名模式（如：语言、长度、格式、分隔符等）
2. 生成的新标题必须遵循这种模式
3. 准确反映网页内容
4. 便于搜索和识别
5. 只返回新标题`;

/**
 * 默认的上下文重命名 Prompt 模板（英文）
 */
export const DEFAULT_CONTEXTUAL_RENAME_PROMPT_EN = `Requirements:
1. Analyze the naming pattern of other bookmarks in the folder (e.g., language, length, format, separators)
2. The new title must follow this pattern
3. Accurately reflect the page content
4. Easy to search and identify
5. Return only the new title`;

/**
 * 存储键名
 */
export const STORAGE_KEYS = {
    CUSTOM_PROMPT: 'aiCustomPrompt',
    USE_CUSTOM_PROMPT: 'aiUseCustomPrompt',
    CUSTOM_FOLDER_RECOMMENDATION_PROMPT: 'aiFolderRecommendationPrompt',
    USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT: 'aiUseCustomFolderRecommendationPrompt',
    CUSTOM_CONTEXTUAL_RENAME_PROMPT: 'aiContextualRenamePrompt',
    USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT: 'aiUseCustomContextualRenamePrompt'
};

/**
 * 获取默认Prompt模板（根据当前语言）
 * @param locale 当前语言代码
 * @param withReference 是否使用带参考格式的 Prompt
 * @returns 默认Prompt模板
 */
export const getDefaultPrompt = (locale: string = 'zh_CN', withReference: boolean = false): string => {
    if (withReference) {
        return locale.startsWith('zh') ? DEFAULT_PROMPT_WITH_REFERENCE_ZH : DEFAULT_PROMPT_WITH_REFERENCE_EN;
    }
    return locale.startsWith('zh') ? DEFAULT_PROMPT_ZH : DEFAULT_PROMPT_EN;
};

/**
 * 保存自定义Prompt模板（自动同步到其他设备）
 * @param prompt 自定义Prompt模板
 */
export const saveCustomPrompt = async (prompt: string): Promise<void> => {
    try {
        await configSyncManager.set(STORAGE_KEYS.CUSTOM_PROMPT, prompt);
        await configSyncManager.set(STORAGE_KEYS.USE_CUSTOM_PROMPT, true);
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
        const useCustom = await configSyncManager.get(STORAGE_KEYS.USE_CUSTOM_PROMPT);
        const customPrompt = await configSyncManager.get(STORAGE_KEYS.CUSTOM_PROMPT);

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
        const useCustom = await configSyncManager.get(STORAGE_KEYS.USE_CUSTOM_PROMPT);
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
        await configSyncManager.set(STORAGE_KEYS.USE_CUSTOM_PROMPT, false);
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
 * @param referenceBookmarks 参考书签标题列表（可选）
 * @returns 格式化后的Prompt
 */
export const formatPrompt = (
    template: string,
    url: string,
    title: string,
    referenceBookmarks?: string[]
): string => {
    let formatted = template
        .replace(/{url}/g, url)
        .replace(/{title}/g, title);

    // 如果有参考书签，格式化为列表
    if (referenceBookmarks && referenceBookmarks.length > 0) {
        const bookmarkList = referenceBookmarks
            .map((title, index) => `${index + 1}. ${title}`)
            .join('\n');
        formatted = formatted.replace(/{referenceBookmarks}/g, bookmarkList);
    }

    return formatted;
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


/**
 * 获取默认文件夹推荐 Prompt 模板（根据当前语言）
 * @param locale 当前语言代码
 * @param includeReason 是否包含推荐理由
 * @param multiRecommendation 是否返回多个推荐
 * @returns 默认文件夹推荐 Prompt 模板
 */
export const getDefaultFolderRecommendationPrompt = (
    locale: string = 'zh_CN',
    includeReason: boolean = false,
    multiRecommendation: boolean = false
): string => {
    const isZh = locale.startsWith('zh');

    // 多推荐模式（总是包含理由和置信度）
    if (multiRecommendation) {
        return isZh
            ? DEFAULT_FOLDER_MULTI_RECOMMENDATION_PROMPT_ZH
            : DEFAULT_FOLDER_MULTI_RECOMMENDATION_PROMPT_EN;
    }

    // 单推荐模式
    if (includeReason) {
        return isZh
            ? DEFAULT_FOLDER_RECOMMENDATION_WITH_REASON_PROMPT_ZH
            : DEFAULT_FOLDER_RECOMMENDATION_WITH_REASON_PROMPT_EN;
    }

    return isZh
        ? DEFAULT_FOLDER_RECOMMENDATION_PROMPT_ZH
        : DEFAULT_FOLDER_RECOMMENDATION_PROMPT_EN;
};

/**
 * 获取当前使用的文件夹推荐 Prompt 模板
 * @param locale 当前语言代码
 * @param includeReason 是否包含推荐理由
 * @param multiRecommendation 是否返回多个推荐
 * @returns 当前文件夹推荐 Prompt 模板
 */
export const getCurrentFolderRecommendationPrompt = async (
    locale: string = 'zh_CN',
    includeReason: boolean = false,
    multiRecommendation: boolean = false
): Promise<string> => {
    try {
        const useCustom = await configSyncManager.get(STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT);
        const customPrompt = await configSyncManager.get(STORAGE_KEYS.CUSTOM_FOLDER_RECOMMENDATION_PROMPT);

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultFolderRecommendationPrompt(locale, includeReason, multiRecommendation);
    } catch (error) {
        console.error('Failed to get current folder recommendation prompt:', error);
        return getDefaultFolderRecommendationPrompt(locale, includeReason, multiRecommendation);
    }
};

/**
 * 保存自定义文件夹推荐 Prompt 模板（自动同步到其他设备）
 * @param prompt 自定义 Prompt 模板
 */
export const saveCustomFolderRecommendationPrompt = async (prompt: string): Promise<void> => {
    try {
        await configSyncManager.set(STORAGE_KEYS.CUSTOM_FOLDER_RECOMMENDATION_PROMPT, prompt);
        await configSyncManager.set(STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT, true);
    } catch (error) {
        console.error('Failed to save custom folder recommendation prompt:', error);
        throw new Error('Failed to save custom folder recommendation prompt template');
    }
};

/**
 * 恢复默认文件夹推荐 Prompt 模板（自动同步到其他设备）
 */
export const restoreDefaultFolderRecommendationPrompt = async (): Promise<void> => {
    try {
        await configSyncManager.set(STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT, false);
    } catch (error) {
        console.error('Failed to restore default folder recommendation prompt:', error);
        throw new Error('Failed to restore default folder recommendation prompt template');
    }
};

/**
 * 获取默认上下文重命名 Prompt 模板
 */
export const getDefaultContextualRenamePrompt = (locale: string = 'zh_CN'): string => {
    return locale.startsWith('zh') ? DEFAULT_CONTEXTUAL_RENAME_PROMPT_ZH : DEFAULT_CONTEXTUAL_RENAME_PROMPT_EN;
};

/**
 * 获取当前使用的上下文重命名 Prompt 模板
 */
export const getCurrentContextualRenamePrompt = async (locale: string = 'zh_CN'): Promise<string> => {
    try {
        const useCustom = await configSyncManager.get(STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT);
        const customPrompt = await configSyncManager.get(STORAGE_KEYS.CUSTOM_CONTEXTUAL_RENAME_PROMPT);

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultContextualRenamePrompt(locale);
    } catch (error) {
        console.error('Failed to get current contextual rename prompt:', error);
        return getDefaultContextualRenamePrompt(locale);
    }
};

/**
 * 保存自定义上下文重命名 Prompt 模板
 */
export const saveCustomContextualRenamePrompt = async (prompt: string): Promise<void> => {
    try {
        await configSyncManager.set(STORAGE_KEYS.CUSTOM_CONTEXTUAL_RENAME_PROMPT, prompt);
        await configSyncManager.set(STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT, true);
    } catch (error) {
        console.error('Failed to save custom contextual rename prompt:', error);
        throw new Error('Failed to save custom contextual rename prompt template');
    }
};

/**
 * 恢复默认上下文重命名 Prompt 模板
 */
export const restoreDefaultContextualRenamePrompt = async (): Promise<void> => {
    try {
        await configSyncManager.set(STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT, false);
    } catch (error) {
        console.error('Failed to restore default contextual rename prompt:', error);
        throw new Error('Failed to restore default contextual rename prompt template');
    }
};

/**
 * 格式化文件夹列表为 Prompt 文本
 * @param folders 文件夹列表
 * @param maxFolders 最大文件夹数量（防止 Prompt 过长）
 * @param locale 当前语言
 * @returns 格式化的文件夹列表文本
 */
export const formatFolderListForPrompt = (
    folders: any[],
    maxFolders: number = 50,
    locale: string = 'zh_CN'
): string => {
    // 扁平化文件夹列表
    const flattenFolders = (folders: any[], level: number = 0, result: any[] = []): any[] => {
        if (!folders || !Array.isArray(folders)) {
            return result;
        }

        for (const folder of folders) {
            if (!folder) continue;

            // 跳过特殊文件夹
            if (folder.id === 'all') continue;

            result.push({
                id: folder.id,
                title: folder.title,
                path: folder.path || folder.title,
                level
            });

            if (folder.children && folder.children.length > 0) {
                flattenFolders(folder.children, level + 1, result);
            }
        }

        return result;
    };

    const flatFolders = flattenFolders(folders);

    // 如果文件夹数量超过限制，优先选择顶层和二级文件夹
    let selectedFolders = flatFolders;
    if (flatFolders.length > maxFolders) {
        const topLevel = flatFolders.filter(f => f.level === 0);
        const secondLevel = flatFolders.filter(f => f.level === 1);
        selectedFolders = [...topLevel, ...secondLevel].slice(0, maxFolders);
    }

    // 格式化为文本列表
    return selectedFolders
        .map((folder, index) => {
            const indent = '  '.repeat(folder.level);
            return `${index + 1}. ${indent}[ID: ${folder.id}] ${folder.path}`;
        })
        .join('\n');
};

/**
 * 检查是否使用自定义文件夹推荐 Prompt
 */
export const isUsingCustomFolderRecommendationPrompt = async (): Promise<boolean> => {
    try {
        const useCustom = await configSyncManager.get(STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT);
        return useCustom || false;
    } catch (error) {
        console.error('Failed to check custom folder recommendation prompt status:', error);
        return false;
    }
};

/**
 * 检查是否使用自定义上下文重命名 Prompt
 */
export const isUsingCustomContextualRenamePrompt = async (): Promise<boolean> => {
    try {
        const useCustom = await configSyncManager.get(STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT);
        return useCustom || false;
    } catch (error) {
        console.error('Failed to check custom contextual rename prompt status:', error);
        return false;
    }
};

/**
 * 格式化文件夹推荐 Prompt（替换占位符）
 * @param template Prompt 模板
 * @param url 页面 URL
 * @param title 页面标题
 * @param folderList 文件夹列表文本
 * @param maxRecommendations 最大推荐数量（可选）
 * @returns 格式化后的 Prompt
 */
export const formatFolderRecommendationPrompt = (
    template: string,
    url: string,
    title: string,
    folderList: string,
    maxRecommendations?: number
): string => {
    let result = template
        .replace(/{url}/g, url)
        .replace(/{title}/g, title)
        .replace(/{folderList}/g, folderList);

    // 如果提供了 maxRecommendations，替换占位符
    if (maxRecommendations !== undefined) {
        result = result.replace(/{maxRecommendations}/g, maxRecommendations.toString());
    }

    return result;
};

/**
 * 格式化书签列表用于批量分类 Prompt
 * @param bookmarks 书签列表
 * @returns 格式化的文本
 */
export const formatBookmarkListForClassification = (
    bookmarks: Array<{ id: string; title: string; url: string }>
): string => {
    return bookmarks
        .map((b, index) => `${index + 1}. [ID: ${b.id}] ${b.title} (${b.url})`)
        .join('\n');
};
