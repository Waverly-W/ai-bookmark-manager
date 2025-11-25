import { AIScenario, JSONSchema } from "../types";

export interface BatchClassificationInput {
    bookmarks: Array<{ id: string; title: string; url: string }>;
    allFolders: string[]; // List of folder paths with IDs, e.g., "[123] Tech/Frontend"
}

export interface BatchClassificationOutput {
    classifications: Array<{
        bookmarkId: string;
        suggestedFolderId: string; // "0" for root/default
        reason?: string;
        confidence: number;
    }>;
}

const SYSTEM_PROMPT_ZH = `你是一个智能书签整理助手。请根据提供的书签列表和现有文件夹结构，为每个书签推荐最合适的文件夹。

现有文件夹列表 (格式: [ID] 路径):
{allFolders}

书签列表:
{bookmarks}

要求：
1. 分析每个书签的标题和URL，理解其内容。
2. 从现有文件夹列表中选择最匹配的一个。
3. 如果没有合适的文件夹，推荐 ID 为 "0" (默认书签栏)。
4. 置信度 (confidence) 范围 0-1。
5. 必须严格按照 JSON 格式输出，不要包含任何其他文字。

JSON 格式示例:
{
  "classifications": [
    {"bookmarkId": "b1", "suggestedFolderId": "123", "reason": "前端技术文章", "confidence": 0.9},
    {"bookmarkId": "b2", "suggestedFolderId": "0", "reason": "未找到匹配分类", "confidence": 0.5}
  ]
}`;

const SYSTEM_PROMPT_EN = `You are an intelligent bookmark organization assistant. Please recommend the most suitable folder for each bookmark based on the provided bookmark list and existing folder structure.

Existing Folder List (Format: [ID] Path):
{allFolders}

Bookmark List:
{bookmarks}

Requirements:
1. Analyze the title and URL of each bookmark to understand its content.
2. Select the most matching folder from the existing folder list.
3. If no suitable folder is found, recommend ID "0" (Default Bookmarks Bar).
4. Confidence range 0-1.
5. You must output strictly in JSON format, without any other text.

JSON Format Example:
{
  "classifications": [
    {"bookmarkId": "b1", "suggestedFolderId": "123", "reason": "Frontend tech article", "confidence": 0.9},
    {"bookmarkId": "b2", "suggestedFolderId": "0", "reason": "No matching category", "confidence": 0.5}
  ]
}`;

const DEFAULT_USER_PROMPT_ZH = `请分析上述书签并进行分类整理。`;
const DEFAULT_USER_PROMPT_EN = `Please analyze and classify the above bookmarks.`;

const RESPONSE_SCHEMA: JSONSchema = {
    type: "object",
    properties: {
        classifications: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    bookmarkId: { type: "string" },
                    suggestedFolderId: { type: "string" },
                    reason: { type: "string" },
                    confidence: { type: "number" }
                },
                required: ["bookmarkId", "suggestedFolderId", "confidence"]
            }
        }
    },
    required: ["classifications"],
    additionalProperties: false
};

export const batchClassificationScenario: AIScenario<BatchClassificationInput, BatchClassificationOutput> = {
    id: "batch-classification",
    name: "Batch Classification",
    description: "Classifies a batch of bookmarks into existing folders.",
    getSystemPrompt: (locale: string) => {
        return locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    },
    defaultUserPrompt: DEFAULT_USER_PROMPT_ZH,
    responseSchema: {
        name: "batch_classification_response",
        strict: true,
        schema: RESPONSE_SCHEMA
    },
    formatUserPrompt: (template: string, input: BatchClassificationInput) => {
        return template;
    },
    parseResponse: (response: any) => {
        return {
            classifications: response.classifications || []
        };
    }
};

export const formatBatchClassificationSystemPrompt = (
    bookmarksStr: string,
    allFoldersStr: string,
    locale: string = 'zh_CN'
): string => {
    const template = locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    return template
        .replace("{bookmarks}", bookmarksStr)
        .replace("{allFolders}", allFoldersStr);
};
