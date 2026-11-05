import { AIScenario, JSONSchema } from "../types";
import { fillTemplate } from "../template";
import { DEFAULT_PROMPT_ZH } from "../../aiPromptUtils";

export interface BookmarkRenameInput {
    url: string;
    title: string;
}

export interface BookmarkRenameOutput {
    newTitle: string;
}

const SYSTEM_PROMPT_ZH = `请根据用户提供的书签URL和当前标题，生成一个简洁、描述性的书签标题。
书签URL: {url}
当前标题: {title}

重要：必须严格按照JSON格式输出，不要包含任何Markdown格式（如 \`\`\`json），不要输出任何解释或其他文字。只返回纯JSON字符串。
JSON格式示例：
{"newTitle": "这里是新标题"}`;

const SYSTEM_PROMPT_EN = `Please generate a concise and descriptive bookmark title based on the provided URL and current title.
Bookmark URL: {url}
Current Title: {title}

IMPORTANT: You must output strictly in JSON format. Do not include any Markdown formatting (like \`\`\`json). Do not output any explanations or other text. Return only the raw JSON string.
JSON Format Example:
{"newTitle": "New Title Here"}`;

const RESPONSE_SCHEMA: JSONSchema = {
    type: "object",
    properties: {
        newTitle: {
            type: "string",
            description: "The new title for the bookmark"
        }
    },
    required: ["newTitle"],
    additionalProperties: false
};

export const bookmarkRenameScenario: AIScenario<BookmarkRenameInput, BookmarkRenameOutput> = {
    id: "bookmark-rename",
    name: "Bookmark Rename",
    description: "Renames a bookmark based on its URL and current title.",
    getSystemPrompt: (locale: string) => {
        return locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    },
    defaultUserPrompt: DEFAULT_PROMPT_ZH, // 实际使用 getCurrentPrompt 读取的用户配置，这里只是兜底
    responseSchema: {
        name: "bookmark_rename_response",
        strict: true,
        schema: RESPONSE_SCHEMA
    },
    // URL 和标题由 formatBookmarkRenameSystemPrompt 填入 System Prompt，User Prompt 只包含用户的命名要求
    formatUserPrompt: (template: string) => template,
    parseResponse: (response: any) => {
        return {
            newTitle: response.newTitle
        };
    }
};

// Helper to format the system prompt since it contains data in this specific requirement
export const formatBookmarkRenameSystemPrompt = (url: string, title: string, locale: string = 'zh_CN'): string => {
    const template = locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    return fillTemplate(template, { url, title });
};
