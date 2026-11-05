import { browser } from "wxt/browser";
import { fillTemplate } from "./ai/template";


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
 * 默认的文件夹推荐要求（中文）。
 * 书签信息、文件夹列表和 JSON 输出格式由 System Prompt 固定提供，这里只写选择规则。
 */
export const DEFAULT_FOLDER_RECOMMENDATION_PROMPT_ZH = `要求：
1. 分析网页内容和主题
2. 从现有文件夹列表中选择最匹配的3个文件夹
3. 如果没有完全匹配的，选择最相关的上级分类
4. 按相关性从高到低排序
5. 只返回 json 对象，不要返回其他文字`;

/**
 * 默认的文件夹推荐要求（英文）
 */
export const DEFAULT_FOLDER_RECOMMENDATION_PROMPT_EN = `Requirements:
1. Analyze the page content and topic
2. Select the top 3 matching folders from the existing list
3. If no exact match, select the most relevant parent category
4. Sort by relevance (highest first)
5. Return json only, without any extra text`;

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
 * 默认的自动标签 Prompt 模板（中文）
 */
export const DEFAULT_AUTO_TAG_PROMPT_ZH = `请为这个书签生成 3-5 个标签。

输入信息：
- 标题：{title}
- URL：{url}

要求：
1. 标签简短明确，优先 1-2 个词
2. 优先复用现有标签风格，避免同义词泛滥
3. 只返回 JSON 中的 tags 数组，不要补充解释`;

/**
 * 默认的自动标签 Prompt 模板（英文）
 */
export const DEFAULT_AUTO_TAG_PROMPT_EN = `Generate 3-5 tags for this bookmark.

Input:
- Title: {title}
- URL: {url}

Requirements:
1. Keep tags short and specific, ideally 1-2 words
2. Prefer reusing existing tag vocabulary when relevant
3. Return only the JSON tags array with no extra explanation`;

/**
 * 默认的备份冲突解决 Prompt 模板（中文）
 */
export const DEFAULT_BACKUP_CONFLICT_PROMPT_ZH = `请解决备份恢复中的冲突项。

要求：
1. 优先保证结果可用且不丢失关键信息
2. 如果两边都合理，优先遵循 {preferredSource}
3. 标签冲突尽量合并而不是丢弃
4. 只有在必要时才组合 local / remote 值
5. mergedValueJson 必须是合法 JSON 字符串`;

/**
 * 默认的备份冲突解决 Prompt 模板（英文）
 */
export const DEFAULT_BACKUP_CONFLICT_PROMPT_EN = `Resolve backup restore conflicts.

Requirements:
1. Prioritize correctness and preserving important information
2. When both sides are reasonable, prefer {preferredSource}
3. Merge tags when possible instead of dropping data
4. Use hybrid values only when necessary
5. mergedValueJson must be a valid JSON string`;

/**
 * 默认的剪藏排版 Prompt 模板（中文）
 */
export const DEFAULT_MARKDOWN_FORMAT_PROMPT_ZH = `排版要求：
1. 整理为结构清晰、符合 Obsidian 规范的 Markdown
2. 保持原文语言和措辞，只调整格式，不改写内容`;

/**
 * 默认的剪藏排版 Prompt 模板（英文）
 */
export const DEFAULT_MARKDOWN_FORMAT_PROMPT_EN = `Formatting requirements:
1. Produce clean, well-structured Obsidian-compatible Markdown
2. Keep the original language and wording; change formatting only, not content`;

/**
 * 存储键名
 */
export const STORAGE_KEYS = {
    CUSTOM_PROMPT: 'aiCustomPrompt',
    USE_CUSTOM_PROMPT: 'aiUseCustomPrompt',
    // 旧键 aiFolderRecommendationPrompt 存的是带 {folderList} 占位符、按序号输出的旧格式模板，
    // 与现在的场景不兼容，所以换成新键，旧值自然失效
    CUSTOM_FOLDER_RECOMMENDATION_PROMPT: 'aiFolderRecommendationRulesPrompt',
    USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT: 'aiUseCustomFolderRecommendationRulesPrompt',
    CUSTOM_CONTEXTUAL_RENAME_PROMPT: 'aiContextualRenamePrompt',
    USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT: 'aiUseCustomContextualRenamePrompt',
    CUSTOM_AUTO_TAG_PROMPT: 'aiAutoTagPrompt',
    USE_CUSTOM_AUTO_TAG_PROMPT: 'aiUseCustomAutoTagPrompt',
    CUSTOM_BACKUP_CONFLICT_PROMPT: 'aiBackupConflictPrompt',
    USE_CUSTOM_BACKUP_CONFLICT_PROMPT: 'aiUseCustomBackupConflictPrompt',
    CUSTOM_MARKDOWN_FORMAT_PROMPT: 'aiMarkdownFormatPrompt',
    USE_CUSTOM_MARKDOWN_FORMAT_PROMPT: 'aiUseCustomMarkdownFormatPrompt'
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
        await browser.storage.local.set({ [STORAGE_KEYS.CUSTOM_PROMPT]: prompt });
        await browser.storage.local.set({ [STORAGE_KEYS.USE_CUSTOM_PROMPT]: true });
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
        const result = await browser.storage.local.get([STORAGE_KEYS.USE_CUSTOM_PROMPT, STORAGE_KEYS.CUSTOM_PROMPT]);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_PROMPT];
        const customPrompt = result[STORAGE_KEYS.CUSTOM_PROMPT];

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
        const result = await browser.storage.local.get(STORAGE_KEYS.USE_CUSTOM_PROMPT);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_PROMPT];
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
        await browser.storage.local.set({ [STORAGE_KEYS.USE_CUSTOM_PROMPT]: false });
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
 * 获取默认自动标签 Prompt 模板
 */
export const getDefaultAutoTagPrompt = (locale: string = 'zh_CN'): string => {
    return locale.startsWith('zh') ? DEFAULT_AUTO_TAG_PROMPT_ZH : DEFAULT_AUTO_TAG_PROMPT_EN;
};

/**
 * 获取默认的备份冲突解决 Prompt
 */
export const getDefaultBackupConflictPrompt = (locale: string = 'zh_CN'): string => {
    return locale.startsWith('zh') ? DEFAULT_BACKUP_CONFLICT_PROMPT_ZH : DEFAULT_BACKUP_CONFLICT_PROMPT_EN;
};

/**
 * 获取当前使用的自动标签 Prompt 模板
 */
export const getCurrentAutoTagPrompt = async (locale: string = 'zh_CN'): Promise<string> => {
    try {
        const result = await browser.storage.local.get([
            STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT,
            STORAGE_KEYS.CUSTOM_AUTO_TAG_PROMPT
        ]);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT];
        const customPrompt = result[STORAGE_KEYS.CUSTOM_AUTO_TAG_PROMPT];

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultAutoTagPrompt(locale);
    } catch (error) {
        console.error('Failed to get current auto tag prompt:', error);
        return getDefaultAutoTagPrompt(locale);
    }
};

/**
 * 保存自定义自动标签 Prompt 模板
 */
export const saveCustomAutoTagPrompt = async (prompt: string): Promise<void> => {
    try {
        await browser.storage.local.set({
            [STORAGE_KEYS.CUSTOM_AUTO_TAG_PROMPT]: prompt,
            [STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT]: true
        });
    } catch (error) {
        console.error('Failed to save custom auto tag prompt:', error);
        throw new Error('Failed to save custom auto tag prompt template');
    }
};

/**
 * 恢复默认自动标签 Prompt 模板
 */
export const restoreDefaultAutoTagPrompt = async (): Promise<void> => {
    try {
        await browser.storage.local.set({ [STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT]: false });
    } catch (error) {
        console.error('Failed to restore default auto tag prompt:', error);
        throw new Error('Failed to restore default auto tag prompt template');
    }
};

/**
 * 检查是否使用自定义自动标签 Prompt
 */
export const isUsingCustomAutoTagPrompt = async (): Promise<boolean> => {
    try {
        const result = await browser.storage.local.get(STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT);
        return result[STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT] || false;
    } catch (error) {
        console.error('Failed to check custom auto tag prompt status:', error);
        return false;
    }
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

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * 格式化自动标签 Prompt（替换占位符）
 */
export const formatAutoTagPrompt = (
    template: string,
    url: string,
    title: string
): string => fillTemplate(template, { url, title });

/**
 * 获取默认文件夹推荐要求（根据当前语言）
 */
export const getDefaultFolderRecommendationPrompt = (locale: string = 'zh_CN'): string => {
    return locale.startsWith('zh')
        ? DEFAULT_FOLDER_RECOMMENDATION_PROMPT_ZH
        : DEFAULT_FOLDER_RECOMMENDATION_PROMPT_EN;
};

/**
 * 获取当前使用的文件夹推荐要求
 */
export const getCurrentFolderRecommendationPrompt = async (locale: string = 'zh_CN'): Promise<string> => {
    try {
        const result = await browser.storage.local.get([STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT, STORAGE_KEYS.CUSTOM_FOLDER_RECOMMENDATION_PROMPT]);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT];
        const customPrompt = result[STORAGE_KEYS.CUSTOM_FOLDER_RECOMMENDATION_PROMPT];

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultFolderRecommendationPrompt(locale);
    } catch (error) {
        console.error('Failed to get current folder recommendation prompt:', error);
        return getDefaultFolderRecommendationPrompt(locale);
    }
};

/**
 * 保存自定义文件夹推荐 Prompt 模板（自动同步到其他设备）
 * @param prompt 自定义 Prompt 模板
 */
export const saveCustomFolderRecommendationPrompt = async (prompt: string): Promise<void> => {
    try {
        await browser.storage.local.set({
            [STORAGE_KEYS.CUSTOM_FOLDER_RECOMMENDATION_PROMPT]: prompt,
            [STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT]: true
        });
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
        await browser.storage.local.set({ [STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT]: false });
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
        const result = await browser.storage.local.get([STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT, STORAGE_KEYS.CUSTOM_CONTEXTUAL_RENAME_PROMPT]);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT];
        const customPrompt = result[STORAGE_KEYS.CUSTOM_CONTEXTUAL_RENAME_PROMPT];

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
        await browser.storage.local.set({
            [STORAGE_KEYS.CUSTOM_CONTEXTUAL_RENAME_PROMPT]: prompt,
            [STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT]: true
        });
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
        await browser.storage.local.set({ [STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT]: false });
    } catch (error) {
        console.error('Failed to restore default contextual rename prompt:', error);
        throw new Error('Failed to restore default contextual rename prompt template');
    }
};

/**
 * 检查是否使用自定义文件夹推荐 Prompt
 */
export const isUsingCustomFolderRecommendationPrompt = async (): Promise<boolean> => {
    try {
        const result = await browser.storage.local.get(STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT];
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
        const result = await browser.storage.local.get(STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT];
        return useCustom || false;
    } catch (error) {
        console.error('Failed to check custom contextual rename prompt status:', error);
        return false;
    }
};

/**
 * 获取当前的备份冲突解决 Prompt
 */
export const getCurrentBackupConflictPrompt = async (locale: string = 'zh_CN'): Promise<string> => {
    try {
        const result = await browser.storage.local.get([
            STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT,
            STORAGE_KEYS.CUSTOM_BACKUP_CONFLICT_PROMPT
        ]);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT];
        const customPrompt = result[STORAGE_KEYS.CUSTOM_BACKUP_CONFLICT_PROMPT];

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultBackupConflictPrompt(locale);
    } catch (error) {
        console.error('Failed to get current backup conflict prompt:', error);
        return getDefaultBackupConflictPrompt(locale);
    }
};

/**
 * 保存自定义备份冲突解决 Prompt
 */
export const saveCustomBackupConflictPrompt = async (prompt: string): Promise<void> => {
    try {
        await browser.storage.local.set({
            [STORAGE_KEYS.CUSTOM_BACKUP_CONFLICT_PROMPT]: prompt,
            [STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT]: true
        });
    } catch (error) {
        console.error('Failed to save custom backup conflict prompt:', error);
        throw new Error('Failed to save custom backup conflict prompt template');
    }
};

/**
 * 恢复默认的备份冲突解决 Prompt
 */
export const restoreDefaultBackupConflictPrompt = async (): Promise<void> => {
    try {
        await browser.storage.local.set({
            [STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT]: false
        });
    } catch (error) {
        console.error('Failed to restore default backup conflict prompt:', error);
        throw new Error('Failed to restore default backup conflict prompt template');
    }
};

/**
 * 检查是否使用自定义备份冲突解决 Prompt
 */
export const isUsingCustomBackupConflictPrompt = async (): Promise<boolean> => {
    try {
        const result = await browser.storage.local.get(STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT);
        return result[STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT] || false;
    } catch (error) {
        console.error('Failed to check custom backup conflict prompt status:', error);
        return false;
    }
};

/**
 * 获取默认的剪藏排版 Prompt
 */
export const getDefaultMarkdownFormatPrompt = (locale: string = 'zh_CN'): string => {
    return locale.startsWith('zh') ? DEFAULT_MARKDOWN_FORMAT_PROMPT_ZH : DEFAULT_MARKDOWN_FORMAT_PROMPT_EN;
};

/**
 * 获取当前的剪藏排版 Prompt
 */
export const getCurrentMarkdownFormatPrompt = async (locale: string = 'zh_CN'): Promise<string> => {
    try {
        const result = await browser.storage.local.get([
            STORAGE_KEYS.USE_CUSTOM_MARKDOWN_FORMAT_PROMPT,
            STORAGE_KEYS.CUSTOM_MARKDOWN_FORMAT_PROMPT
        ]);
        const useCustom = result[STORAGE_KEYS.USE_CUSTOM_MARKDOWN_FORMAT_PROMPT];
        const customPrompt = result[STORAGE_KEYS.CUSTOM_MARKDOWN_FORMAT_PROMPT];

        if (useCustom && customPrompt) {
            return customPrompt;
        }

        return getDefaultMarkdownFormatPrompt(locale);
    } catch (error) {
        console.error('Failed to get current markdown format prompt:', error);
        return getDefaultMarkdownFormatPrompt(locale);
    }
};

/**
 * 保存自定义剪藏排版 Prompt
 */
export const saveCustomMarkdownFormatPrompt = async (prompt: string): Promise<void> => {
    try {
        await browser.storage.local.set({
            [STORAGE_KEYS.CUSTOM_MARKDOWN_FORMAT_PROMPT]: prompt,
            [STORAGE_KEYS.USE_CUSTOM_MARKDOWN_FORMAT_PROMPT]: true
        });
    } catch (error) {
        console.error('Failed to save custom markdown format prompt:', error);
        throw new Error('Failed to save custom markdown format prompt template');
    }
};

/**
 * 恢复默认的剪藏排版 Prompt
 */
export const restoreDefaultMarkdownFormatPrompt = async (): Promise<void> => {
    try {
        await browser.storage.local.set({
            [STORAGE_KEYS.USE_CUSTOM_MARKDOWN_FORMAT_PROMPT]: false
        });
    } catch (error) {
        console.error('Failed to restore default markdown format prompt:', error);
        throw new Error('Failed to restore default markdown format prompt template');
    }
};

/**
 * 检查是否使用自定义剪藏排版 Prompt
 */
export const isUsingCustomMarkdownFormatPrompt = async (): Promise<boolean> => {
    try {
        const result = await browser.storage.local.get(STORAGE_KEYS.USE_CUSTOM_MARKDOWN_FORMAT_PROMPT);
        return result[STORAGE_KEYS.USE_CUSTOM_MARKDOWN_FORMAT_PROMPT] || false;
    } catch (error) {
        console.error('Failed to check custom markdown format prompt status:', error);
        return false;
    }
};
