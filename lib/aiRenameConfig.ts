import { configSyncManager } from "./configSyncManager";

/**
 * AI 重命名配置接口
 */
export interface AIRenameConfig {
    useReferenceNaming: boolean; // 是否参考文件夹中现有书签的命名格式
}

/**
 * 默认配置
 */
export const DEFAULT_AI_RENAME_CONFIG: AIRenameConfig = {
    useReferenceNaming: true
};

/**
 * 配置存储键名
 */
const AI_RENAME_CONFIG_KEY = 'ai_rename_config';

/**
 * 获取 AI 重命名配置
 */
export const getAIRenameConfig = async (): Promise<AIRenameConfig> => {
    try {
        const config = await configSyncManager.get<AIRenameConfig>(AI_RENAME_CONFIG_KEY);
        return config || DEFAULT_AI_RENAME_CONFIG;
    } catch (error) {
        console.error('Failed to get AI rename config:', error);
        return DEFAULT_AI_RENAME_CONFIG;
    }
};

/**
 * 保存 AI 重命名配置
 */
export const saveAIRenameConfig = async (config: AIRenameConfig): Promise<void> => {
    try {
        await configSyncManager.set(AI_RENAME_CONFIG_KEY, config);
    } catch (error) {
        console.error('Failed to save AI rename config:', error);
        throw error;
    }
};

