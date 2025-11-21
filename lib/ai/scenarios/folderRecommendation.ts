import { AIScenario, JSONSchema } from "../types";

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

const DEFAULT_USER_PROMPT_ZH = `要求：
1. 分析网页内容和主题
2. 从现有文件夹列表中选择最匹配的3个文件夹
3. 如果没有完全匹配的，选择最相关的上级分类
4. 按相关性从高到低排序`;

const DEFAULT_USER_PROMPT_EN = `Requirements:
1. Analyze the page content and topic
2. Select the top 3 matching folders from the existing list
3. If no exact match, select the most relevant parent category
4. Sort by relevance (highest first)`;

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
                required: ["folderId", "folderPath"]
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
    defaultUserPrompt: DEFAULT_USER_PROMPT_ZH,
    responseSchema: {
        name: "folder_recommendation_response",
        strict: true,
        schema: RESPONSE_SCHEMA
    },
    formatUserPrompt: (template: string, input: FolderRecommendationInput) => {
        return template;
    },
    parseResponse: (response: any) => {
        return {
            recommendations: response.recommendations || []
        };
    }
};

export const formatFolderRecommendationSystemPrompt = (url: string, title: string, allFolders: string[], locale: string = 'zh_CN'): string => {
    const template = locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    const folderListStr = allFolders.join('\n');

    return template
        .replace("{url}", url)
        .replace("{title}", title)
        .replace("{allFolders}", folderListStr);
};
