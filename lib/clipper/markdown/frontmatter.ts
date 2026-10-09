import { stringify } from 'yaml';

export interface FrontmatterInput {
  title: string;
  source: string;
  author?: string | null;
  published?: string | null;
  clipped: string;
  tags?: readonly string[];
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizedTags(tags: readonly string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
}

export function buildFrontmatter(input: FrontmatterInput): string {
  const properties: Record<string, string | string[]> = {};
  const title = nonEmpty(input.title);
  const source = nonEmpty(input.source);
  const author = nonEmpty(input.author);
  const published = nonEmpty(input.published);
  const clipped = nonEmpty(input.clipped);
  const tags = normalizedTags(input.tags);

  if (title) properties.title = title;
  if (source) properties.source = source;
  if (author) properties.author = author;
  if (published) properties.published = published;
  if (clipped) properties.clipped = clipped;
  if (tags.length > 0) properties.tags = tags;

  if (Object.keys(properties).length === 0) return '---\n---';

  const yaml = stringify(properties, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  }).trimEnd();
  return `---\n${yaml}\n---`;
}

export function combineFrontmatterAndBody(frontmatter: string, body: string): string {
  const normalizedFrontmatter = frontmatter.trim();
  const normalizedBody = body.trim();
  return normalizedBody
    ? `${normalizedFrontmatter}\n\n${normalizedBody}\n`
    : `${normalizedFrontmatter}\n`;
}

/**
 * 去掉开头的 YAML 元数据块，仅用于预览：笔记里仍保留元数据，
 * 预览若不处理，会把 `title: ...` 这些行当成普通段落显示出来。
 */
export function stripFrontmatter(markdown: string): string {
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  return match ? markdown.slice(match[0].length).replace(/^\s*\n/, '') : markdown;
}
