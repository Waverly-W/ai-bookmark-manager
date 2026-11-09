import { AIScenario, JSONSchema } from "../types";
import { fillTemplate } from "../template";
import { DEFAULT_FOLDER_RECOMMENDATION_PROMPT_ZH } from "../../aiPromptUtils";

export interface FolderRecommendationInput {
    url: string;
    title: string;
    allFolders: string[]; // List of all available folder paths with IDs
}

export interface FolderRecommendationOutput {
    recommendations: Array<{
        folderId: string;
        folderPath: string;
        reason?: string;
    }>;
}

const SYSTEM_PROMPT_ZH = `你是一个智能书签管理助手。请根据用户提供的书签URL、标题以及现有的文件夹列表，推荐最合适的3个文件夹用于保存该书签。

书签URL: {url}
书签标题: {title}
现有文件夹列表 (格式: [ID] 路径):
{allFolders}

重要：必须严格按照JSON格式输出，不要包含任何Markdown格式（如 \`\`\`json），不要输出任何解释或其他文字。只返回纯JSON字符串。
JSON格式示例：
{
  "recommendations": [
    {"folderId": "123", "folderPath": "技术/前端", "reason": "内容关于React开发"},
    {"folderId": "456", "folderPath": "阅读/文章", "reason": "这是一篇技术文章"},
    {"folderId": "789", "folderPath": "工具", "reason": "这是一个开发工具"}
  ]
}`;

const SYSTEM_PROMPT_EN = `You are an intelligent bookmark management assistant. Please recommend the top 3 most suitable folders for saving the bookmark based on the provided URL, title, and existing folder list.

Bookmark URL: {url}
Bookmark Title: {title}
Existing Folder List (Format: [ID] Path):
{allFolders}

IMPORTANT: You must output strictly in JSON format. Do not include any Markdown formatting (like \`\`\`json). Do not output any explanations or other text. Return only the raw JSON string.
JSON Format Example:
{
  "recommendations": [
    {"folderId": "123", "folderPath": "Tech/Frontend", "reason": "Content is about React development"},
    {"folderId": "456", "folderPath": "Read/Articles", "reason": "This is a technical article"},
    {"folderId": "789", "folderPath": "Tools", "reason": "This is a development tool"}
  ]
}`;

const RESPONSE_SCHEMA: JSONSchema = {
    type: "object",
    properties: {
        recommendations: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    folderId: { type: "string" },
                    folderPath: { type: "string" },
                    reason: { type: "string" }
                },
                // The legacy parser accepts either a folder ID or a folder path and
                // resolves the missing value against the current bookmark tree.
                required: []
            },
            description: "List of recommended folders with IDs and paths"
        }
    },
    required: ["recommendations"],
    additionalProperties: false
};

export const folderRecommendationScenario: AIScenario<FolderRecommendationInput, FolderRecommendationOutput> = {
    id: "folder-recommendation",
    name: "Folder Recommendation",
    description: "Recommends folders for a bookmark based on its content and existing folder structure.",
    getSystemPrompt: (locale: string) => {
        return locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    },
    defaultUserPrompt: DEFAULT_FOLDER_RECOMMENDATION_PROMPT_ZH,
    responseSchema: {
        name: "folder_recommendation_response",
        strict: true,
        schema: RESPONSE_SCHEMA
    },
    formatUserPrompt: (template: string) => template,
    parseResponse: (response: any) => {
        if (!Array.isArray(response.recommendations)) {
            throw new Error('recommendations must be an array');
        }

        for (const recommendation of response.recommendations) {
            if (!recommendation || typeof recommendation !== 'object') {
                throw new Error('recommendation items must be objects');
            }
            if (!recommendation.folderId && !recommendation.folderPath) {
                throw new Error('recommendation items require folderId or folderPath');
            }
        }

        return {
            recommendations: response.recommendations
        };
    }
};

export const formatFolderRecommendationSystemPrompt = (url: string, title: string, allFolders: string[], locale: string = 'zh_CN'): string => {
    const template = locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    const folderListStr = allFolders.join('\n');

    return fillTemplate(template, { url, title, allFolders: folderListStr });
};
