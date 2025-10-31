import { browser } from "wxt/browser";
import { configSyncManager } from "./configSyncManager";

/**
 * AI配置接口
 */
export interface AIConfig {
    apiUrl: string;      // API代理URL
    apiKey: string;      // API密钥（加密存储）
    modelId: string;     // 模型ID
}

/**
 * 存储键名
 */
const STORAGE_KEYS = {
    AI_CONFIG: 'aiConfig'
};

/**
 * 简单的Base64编码（用于API Key的基本混淆）
 * 注意：这不是真正的加密，只是防止明文存储
 * 在生产环境中，建议使用更强的加密方法
 */
const encodeApiKey = (apiKey: string): string => {
    try {
        return btoa(apiKey);
    } catch (error) {
        console.error('Failed to encode API key:', error);
        return apiKey;
    }
};

/**
 * Base64解码
 */
export const decodeApiKey = (encodedKey: string): string => {
    try {
        return atob(encodedKey);
    } catch (error) {
        console.error('Failed to decode API key:', error);
        return encodedKey;
    }
};

/**
 * 保存AI配置到本地存储（自动同步到其他设备）
 * @param config AI配置对象
 */
export const saveAIConfig = async (config: AIConfig): Promise<void> => {
    try {
        // 加密API Key
        const configToSave = {
            ...config,
            apiKey: encodeApiKey(config.apiKey)
        };

        // 使用同步管理器保存配置
        await configSyncManager.saveConfig(STORAGE_KEYS.AI_CONFIG, configToSave);
    } catch (error) {
        console.error('Failed to save AI config:', error);
        throw new Error('Failed to save AI configuration');
    }
};

/**
 * 从本地存储读取AI配置
 * @returns AI配置对象，如果不存在则返回默认配置
 */
export const getAIConfig = async (): Promise<AIConfig> => {
    try {
        // 使用同步管理器读取配置
        const savedConfig = await configSyncManager.getConfig(STORAGE_KEYS.AI_CONFIG);

        if (savedConfig) {
            // 解密API Key
            return {
                ...savedConfig,
                apiKey: decodeApiKey(savedConfig.apiKey)
            };
        }

        // 返回默认配置
        return {
            apiUrl: 'https://api.openai.com/v1',
            apiKey: '',
            modelId: 'gpt-3.5-turbo'
        };
    } catch (error) {
        console.error('Failed to get AI config:', error);
        // 返回默认配置
        return {
            apiUrl: 'https://api.openai.com/v1',
            apiKey: '',
            modelId: 'gpt-3.5-turbo'
        };
    }
};

/**
 * 验证AI配置是否完整
 * @param config AI配置对象
 * @returns 验证结果对象
 */
export const validateAIConfig = (config: AIConfig): {
    valid: boolean;
    errors: string[];
} => {
    const errors: string[] = [];
    
    if (!config.apiUrl || config.apiUrl.trim() === '') {
        errors.push('apiUrlRequired');
    }
    
    if (!config.apiKey || config.apiKey.trim() === '') {
        errors.push('apiKeyRequired');
    }
    
    if (!config.modelId || config.modelId.trim() === '') {
        errors.push('modelIdRequired');
    }
    
    // 验证URL格式
    if (config.apiUrl) {
        try {
            new URL(config.apiUrl);
        } catch {
            errors.push('Invalid API URL format');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * 清除AI配置
 */
export const clearAIConfig = async (): Promise<void> => {
    try {
        // 清除本地存储
        await browser.storage.local.remove(STORAGE_KEYS.AI_CONFIG);
        // 清除同步存储
        await browser.storage.sync.remove([STORAGE_KEYS.AI_CONFIG, `${STORAGE_KEYS.AI_CONFIG}__metadata`]);
    } catch (error) {
        console.error('Failed to clear AI config:', error);
        throw new Error('Failed to clear AI configuration');
    }
};

/**
 * 检查是否已配置AI
 * @returns 是否已配置
 */
export const isAIConfigured = async (): Promise<boolean> => {
    try {
        const config = await getAIConfig();
        const validation = validateAIConfig(config);
        return validation.valid;
    } catch (error) {
        console.error('Failed to check AI configuration:', error);
        return false;
    }
};
