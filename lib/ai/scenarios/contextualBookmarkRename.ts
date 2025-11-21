import { AIScenario, JSONSchema } from "../types";

export interface ContextualBookmarkRenameInput {
    url: string;
    title: string;
    currentFolder: string;
    otherBookmarks: string[]; // Titles of other bookmarks in the same folder
}

export interface ContextualBookmarkRenameOutput {
    newTitle: string;
}

const SYSTEM_PROMPT_ZH = `请根据用户提供的书签URL、当前标题、所在文件夹名称以及该文件夹中其他书签的标题，生成一个简洁、描述性的新标题。新标题应与文件夹中其他书签的命名风格保持一致。

书签URL: {url}
当前标题: {title}
所在文件夹: {currentFolder}
同文件夹其他书签:
{otherBookmarks}

重要：必须严格按照JSON格式输出，不要包含任何Markdown格式（如 \`\`\`json），不要输出任何解释或其他文字。只返回纯JSON字符串。
JSON格式示例：
{"newTitle": "这里是新标题"}`;

const SYSTEM_PROMPT_EN = `Please generate a concise and descriptive new title based on the provided URL, current title, folder name, and titles of other bookmarks in the same folder. The new title should be consistent with the naming style of other bookmarks in the folder.

Bookmark URL: {url}
Current Title: {title}
Folder Name: {currentFolder}
Other Bookmarks in Folder:
{otherBookmarks}

IMPORTANT: You must output strictly in JSON format. Do not include any Markdown formatting (like \`\`\`json). Do not output any explanations or other text. Return only the raw JSON string.
JSON Format Example:
{"newTitle": "New Title Here"}`;

const DEFAULT_USER_PROMPT_ZH = `要求：
1. 分析同文件夹其他书签的命名模式（如：语言、长度、格式、分隔符等）
2. 生成的新标题必须遵循这种模式
3. 准确反映网页内容
4. 便于搜索和识别
5. 只返回新标题`;

const DEFAULT_USER_PROMPT_EN = `Requirements:
1. Analyze the naming pattern of other bookmarks in the folder (e.g., language, length, format, separators)
2. The new title must follow this pattern
3. Accurately reflect the page content
4. Easy to search and identify
5. Return only the new title`;

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

export const contextualBookmarkRenameScenario: AIScenario<ContextualBookmarkRenameInput, ContextualBookmarkRenameOutput> = {
    id: "contextual-bookmark-rename",
    name: "Contextual Bookmark Rename",
    description: "Renames a bookmark considering the context of its folder and sibling bookmarks.",
    getSystemPrompt: (locale: string) => {
        return locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    },
    defaultUserPrompt: DEFAULT_USER_PROMPT_ZH,
    responseSchema: {
        name: "contextual_bookmark_rename_response",
        strict: true,
        schema: RESPONSE_SCHEMA
    },
    formatUserPrompt: (template: string, input: ContextualBookmarkRenameInput) => {
        return template;
    },
    parseResponse: (response: any) => {
        return {
            newTitle: response.newTitle
        };
    }
};

export const formatContextualBookmarkRenameSystemPrompt = (
    url: string,
    title: string,
    currentFolder: string,
    otherBookmarks: string[],
    locale: string = 'zh_CN'
): string => {
    const template = locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    const otherBookmarksStr = otherBookmarks.length > 0 ? otherBookmarks.join('\n') : (locale.startsWith('zh') ? "(无其他书签)" : "(No other bookmarks)");

    return template
        .replace("{url}", url)
        .replace("{title}", title)
        .replace("{currentFolder}", currentFolder)
        .replace("{otherBookmarks}", otherBookmarksStr);
};
