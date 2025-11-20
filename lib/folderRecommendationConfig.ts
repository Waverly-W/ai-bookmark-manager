import { configSyncManager } from "./configSyncManager";

/**
 * 文件夹推荐配置接口
 */
export interface FolderRecommendationConfig {
    enabled: boolean;              // 是否启用推荐
    showReason: boolean;           // 是否显示推荐理由
    autoApply: boolean;            // 是否自动应用推荐
    fallbackToDefault: boolean;    // 失败时是否降级到默认文件夹
    timeoutMs: number;             // 超时时间（毫秒）
    maxRecommendations: number;    // 最大推荐数量（1-10，默认 3）
}

/**
 * 默认配置
 */
export const DEFAULT_FOLDER_RECOMMENDATION_CONFIG: FolderRecommendationConfig = {
    enabled: true,
    showReason: true,
    autoApply: true,
    fallbackToDefault: true,
    timeoutMs: 10000,
    maxRecommendations: 3
};

/**
 * 存储键名
 */
const STORAGE_KEY = 'folderRecommendationConfig';

/**
 * 获取文件夹推荐配置
 * @returns 文件夹推荐配置
 */
export const getFolderRecommendationConfig = async (): Promise<FolderRecommendationConfig> => {
    try {
        const savedConfig = await configSyncManager.get(STORAGE_KEY);

        if (savedConfig) {
            // 合并保存的配置和默认配置，确保所有字段都存在
            return {
                ...DEFAULT_FOLDER_RECOMMENDATION_CONFIG,
                ...savedConfig
            };
        }

        return DEFAULT_FOLDER_RECOMMENDATION_CONFIG;
    } catch (error) {
        console.error('Failed to get folder recommendation config:', error);
        return DEFAULT_FOLDER_RECOMMENDATION_CONFIG;
    }
};

/**
 * 保存文件夹推荐配置（自动同步到其他设备）
 * @param config 文件夹推荐配置
 */
export const saveFolderRecommendationConfig = async (config: FolderRecommendationConfig): Promise<void> => {
    try {
        await configSyncManager.set(STORAGE_KEY, config);
    } catch (error) {
        console.error('Failed to save folder recommendation config:', error);
        throw new Error('Failed to save folder recommendation configuration');
    }
};

/**
 * 重置为默认配置
 */
export const resetFolderRecommendationConfig = async (): Promise<void> => {
    try {
        await saveFolderRecommendationConfig(DEFAULT_FOLDER_RECOMMENDATION_CONFIG);
    } catch (error) {
        console.error('Failed to reset folder recommendation config:', error);
        throw new Error('Failed to reset folder recommendation configuration');
    }
};

/**
 * 检查是否启用文件夹推荐
 * @returns 是否启用
 */
export const isFolderRecommendationEnabled = async (): Promise<boolean> => {
    try {
        const config = await getFolderRecommendationConfig();
        return config.enabled;
    } catch (error) {
        console.error('Failed to check folder recommendation status:', error);
        return false;
    }
};

