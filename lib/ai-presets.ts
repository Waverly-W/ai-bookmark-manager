import { AIConfig } from './aiConfigUtils';

/**
 * AI服务商预设配置接口
 */
export interface AIPreset {
    id: string;
    name: string;
    description: string;
    icon?: string;
    config: {
        apiUrl: string;
        modelId: string;
    };
    helpUrl: string; // 获取API Key的帮助链接
    docsUrl?: string; // 文档链接
}

/**
 * AI服务商预设配置列表
 */
export const AI_PRESETS: AIPreset[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5 等模型',
        icon: '🤖',
        config: {
            apiUrl: 'https://api.openai.com/v1',
            modelId: 'gpt-4o-mini'
        },
        helpUrl: 'https://platform.openai.com/api-keys',
        docsUrl: 'https://platform.openai.com/docs'
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        description: 'Claude 3.5 Sonnet 等模型',
        icon: '🧠',
        config: {
            apiUrl: 'https://api.anthropic.com/v1',
            modelId: 'claude-3-5-sonnet-20241022'
        },
        helpUrl: 'https://console.anthropic.com/settings/keys',
        docsUrl: 'https://docs.anthropic.com'
    }
];

/**
 * 根据ID获取预设配置
 */
export const getPresetById = (id: string): AIPreset | undefined => {
    return AI_PRESETS.find(preset => preset.id === id);
};

/**
 * 应用预设配置到AIConfig
 */
export const applyPreset = (presetId: string, apiKey: string): AIConfig => {
    const preset = getPresetById(presetId);
    if (!preset) {
        throw new Error(`Preset ${presetId} not found`);
    }

    return {
        apiUrl: preset.config.apiUrl,
        apiKey: apiKey,
        modelId: preset.config.modelId
    };
};

/**
 * 检查是否为预设配置
 */
export const isPresetConfig = (config: AIConfig): string | null => {
    for (const preset of AI_PRESETS) {
        if (
            config.apiUrl === preset.config.apiUrl &&
            config.modelId === preset.config.modelId
        ) {
            return preset.id;
        }
    }
    return null;
};
