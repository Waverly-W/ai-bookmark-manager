import { AIScenario, JSONSchema } from "../types";

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

const DEFAULT_USER_PROMPT_ZH = `要求：
1. 不超过30个字符
2. 准确反映网页内容
3. 便于搜索和识别
4. 只返回新标题，不要有其他说明文字
5. 格式为：网站名称 | 功能`;

const DEFAULT_USER_PROMPT_EN = `Requirements:
1. No more than 50 characters
2. Accurately reflect the page content
3. Easy to search and identify
4. Return only the new title, no additional text
5. Format: Site Name | Function`;

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
    defaultUserPrompt: DEFAULT_USER_PROMPT_ZH, // Note: User prompt is usually loaded from config, this is just a fallback
    responseSchema: {
        name: "bookmark_rename_response",
        strict: true,
        schema: RESPONSE_SCHEMA
    },
    formatUserPrompt: (template: string, input: BookmarkRenameInput) => {
        // Note: The System Prompt actually contains the placeholders in the user's request example,
        // but usually we put dynamic data in the User message or System message.
        // In the user's request:
        // System Prompt: ... URL: {url}, Title: {title} ...
        // User Prompt: Requirements ...

        // However, to allow the user to customize the "Requirements", we should keep the dynamic data 
        // separate or inject it into the System prompt if the System prompt is fixed but has placeholders.

        // Wait, the user request says:
        // System Prompt (Hidden): ... URL: {url}, Title: {title}, JSON format.
        // User Prompt (Customizable): Requirements...

        // So the System Prompt needs to be formatted with the input data too?
        // Or should we construct the messages such that:
        // System: "You are a helper... Output JSON..."
        // User: "URL: ..., Title: ... \n Requirements: ..."

        // The user request specifically asked for:
        // System Prompt: "Please generate ... URL: {url}, Title: {title}, output JSON."

        // This means the System Prompt IS dynamic per request.
        // But `systemPrompt` in the interface is usually a static template.
        // Let's adjust the logic in `aiService` to handle formatting the System Prompt if needed,
        // OR we define `formatSystemPrompt` in the interface.

        // Actually, looking at the user request again:
        // "System Prompt (User invisible): Please generate ... URL: {url}, Current Title: {title} ... JSON format."

        // If I make the System Prompt dynamic, I need a way to pass data to it.
        // Let's assume `formatUserPrompt` is for the User Prompt part.
        // I might need `formatSystemPrompt` as well.

        return template;
    },
    parseResponse: (response: any) => {
        return {
            newTitle: response.newTitle
        };
    }
};

// Helper to format the system prompt since it contains data in this specific requirement
export const formatBookmarkRenameSystemPrompt = (url: string, title: string, locale: string = 'zh_CN'): string => {
    const template = locale.startsWith('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
    return template
        .replace("{url}", url)
        .replace("{title}", title);
};
