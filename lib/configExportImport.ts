import { browser } from "wxt/browser";
import { AIConfig } from "./aiConfigUtils";
import { FolderRecommendationConfig } from "./folderRecommendationConfig";
import { BackgroundConfig } from "@/components/background-provider";
import { AIRenameConfig } from "./aiRenameConfig";

export interface AppConfiguration {
    version: number;
    timestamp: number;
    settings: {
        theme?: string;
        accentColor?: string;
        i18nextLng?: string;
        aiConfig?: AIConfig;
        aiCustomPrompt?: string;
        aiUseCustomPrompt?: boolean;
        aiFolderRecommendationPrompt?: string;
        aiUseCustomFolderRecommendationPrompt?: boolean;
        aiContextualRenamePrompt?: string;
        aiUseCustomContextualRenamePrompt?: boolean;
        ai_rename_config?: AIRenameConfig;
        folderRecommendationConfig?: FolderRecommendationConfig;
        backgroundConfig?: BackgroundConfig;
    };
}

const CURRENT_CONFIG_VERSION = 1;

/**
 * Keys to export from local storage
 */
const CONFIG_KEYS = [
    'theme',
    'accentColor',
    'i18nextLng',
    'aiConfig',
    'aiCustomPrompt',
    'aiUseCustomPrompt',
    'aiFolderRecommendationPrompt',
    'aiUseCustomFolderRecommendationPrompt',
    'aiContextualRenamePrompt',
    'aiUseCustomContextualRenamePrompt',
    'ai_rename_config',
    'folderRecommendationConfig',
    'backgroundConfig'
];

/**
 * Export all application configuration
 */
export const exportConfiguration = async (): Promise<void> => {
    try {
        const result = await browser.storage.local.get(CONFIG_KEYS);

        const exportData: AppConfiguration = {
            version: CURRENT_CONFIG_VERSION,
            timestamp: Date.now(),
            settings: result
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-bookmark-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export configuration:', error);
        throw new Error('Failed to export configuration');
    }
};

/**
 * Import application configuration
 */
export const importConfiguration = async (jsonString: string): Promise<void> => {
    try {
        const data = JSON.parse(jsonString) as AppConfiguration;

        if (!data || typeof data !== 'object') {
            throw new Error('Invalid configuration file format');
        }

        // Basic version check (can be expanded for migration logic)
        if (data.version > CURRENT_CONFIG_VERSION) {
            console.warn(`Warning: Importing configuration from newer version (${data.version})`);
        }

        if (!data.settings || Object.keys(data.settings).length === 0) {
            throw new Error('No settings found in configuration file');
        }

        // Filter out unknown keys to prevent pollution
        const settingsToImport: Record<string, any> = {};
        for (const key of CONFIG_KEYS) {
            // @ts-ignore
            if (data.settings[key] !== undefined) {
                // @ts-ignore
                settingsToImport[key] = data.settings[key];
            }
        }

        if (Object.keys(settingsToImport).length === 0) {
            throw new Error('No valid settings found to import');
        }

        await browser.storage.local.set(settingsToImport);

    } catch (error) {
        console.error('Failed to import configuration:', error);
        throw error;
    }
};
