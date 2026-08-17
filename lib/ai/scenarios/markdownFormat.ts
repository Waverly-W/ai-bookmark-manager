import { AIScenario } from '../types';

export interface MarkdownFormatInput {
  markdown: string;
}

export interface MarkdownFormatOutput {
  formattedMarkdown: string;
}

export const formatMarkdownSystemPrompt = (locale: string): string => {
  return `Format the supplied document as Obsidian-compatible Markdown.
Keep valid YAML frontmatter, heading levels and order, lists, quotes, fenced code, and tables valid.
Do not invent or infer facts, content, links, tags, callouts, or wikilinks.
Preserve every __W2O_PROTECTED_<index>__ placeholder exactly once and byte-for-byte.
Output only Markdown, without commentary or an enclosing code fence.`;
};

export const defaultMarkdownFormatUserPrompt = `{markdown}`;

export const markdownFormatScenario: AIScenario<MarkdownFormatInput, MarkdownFormatOutput> = {
  id: 'markdown_format',
  name: 'Markdown 结构化排版',
  description: '将网页提取的内容整理排版为符合 Obsidian 规范的 Markdown 格式，保留结构并保护代码块与图片占位符。',
  getSystemPrompt: formatMarkdownSystemPrompt,
  defaultUserPrompt: defaultMarkdownFormatUserPrompt,
  responseSchema: {
    name: 'markdown_format_response',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        formattedMarkdown: {
          type: 'string',
          description: 'Obsidian 兼容的排版后的完整 Markdown 内容',
        },
      },
      required: ['formattedMarkdown'],
    },
  },
  formatUserPrompt: (template: string, input: MarkdownFormatInput): string => {
    return template.replace('{markdown}', input.markdown);
  },
  parseResponse: (response: any): MarkdownFormatOutput => {
    if (typeof response === 'string') {
      return { formattedMarkdown: response };
    }
    if (response && typeof response.formattedMarkdown === 'string') {
      return { formattedMarkdown: response.formattedMarkdown };
    }
    return { formattedMarkdown: '' };
  },
};
