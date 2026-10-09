import {
  MAX_MARKDOWN_UTF8_BYTES,
  MAX_SAFE_SEGMENT_REQUESTS,
  concatenatedStringsWithinJsonWireLimit,
  withinJsonStringWireLimit,
} from '../contracts/limits';
import { formatMarkdownSystemPrompt } from '../../ai/scenarios/markdownFormat';
import { zhCN } from '../ui/zh-cn';
import { ProviderError, type ModelClient } from './client';
import {
  protectMarkdown,
  restoreProtectedMarkdown,
  splitProtectedMarkdown,
} from './protected-content';

/** Fixed safety rules only; callers normally pass the rules plus the user's requirements. */
export const SYSTEM_INSTRUCTION = formatMarkdownSystemPrompt('zh_CN');

export interface FormatMarkdownOptions {
  signal?: AbortSignal;
  maxChunkCharacters?: number;
  instructions?: string;
}

export type FormatMarkdownResult =
  | { ok: true; markdown: string }
  | { ok: false; markdown: string; warning: string };

export { MAX_SAFE_SEGMENT_REQUESTS } from '../contracts/limits';

class ModelOutputTooLargeError extends Error {
  constructor() {
    super('Model output exceeded the Markdown size limit.');
    this.name = 'ModelOutputTooLargeError';
  }
}

class ProtectedPlaceholderError extends Error {
  constructor(cause: unknown) {
    super('Protected placeholder multiset is invalid', { cause });
    this.name = 'ProtectedPlaceholderError';
  }
}

class SafeSegmentRequestLimitError extends Error {
  constructor() {
    super(`Safe-segment formatting exceeded ${MAX_SAFE_SEGMENT_REQUESTS} model requests.`);
    this.name = 'SafeSegmentRequestLimitError';
  }
}

function stripMarkdownWrapper(markdown: string): string {
  const match = /^```markdown[ \t]*\r?\n([\s\S]*)\r?\n```[ \t]*$/i.exec(markdown);
  return match ? match[1]! : markdown;
}

// Models do not reliably keep the blank lines around a segment or chunk, so
// re-apply the original boundary whitespace before segments are joined.
function withOriginalBoundaries(original: string, formatted: string): string {
  const leading = original.slice(0, original.length - original.trimStart().length);
  const trailing = original.slice(original.trimEnd().length);
  return `${leading}${formatted.trim()}${trailing}`;
}

async function formatOne(
  markdown: string,
  client: ModelClient,
  instructions: string,
  signal?: AbortSignal,
): Promise<string> {
  const protectedDocument = protectMarkdown(markdown);
  signal?.throwIfAborted();
  const response = await client.generate({
    instructions,
    input: protectedDocument.markdown,
    signal,
  });
  signal?.throwIfAborted();
  if (!withinJsonStringWireLimit(response.text, MAX_MARKDOWN_UTF8_BYTES)) {
    throw new ModelOutputTooLargeError();
  }
  let restored: string;
  try {
    restored = restoreProtectedMarkdown(
      withOriginalBoundaries(protectedDocument.markdown, stripMarkdownWrapper(response.text.trim())),
      protectedDocument,
    );
  } catch (error) {
    throw new ProtectedPlaceholderError(error);
  }
  if (!withinJsonStringWireLimit(restored, MAX_MARKDOWN_UTF8_BYTES)) {
    throw new ModelOutputTooLargeError();
  }
  return restored;
}

async function formatUnprotectedSegments(
  markdown: string,
  client: ModelClient,
  instructions: string,
  signal?: AbortSignal,
): Promise<string> {
  const protectedDocument = protectMarkdown(markdown);
  const segments = splitProtectedMarkdown(protectedDocument);
  const requestCount = segments.filter((segment: { kind: string; value: string }) => segment.kind === 'text' && segment.value.trim() !== '').length;
  if (requestCount > MAX_SAFE_SEGMENT_REQUESTS) {
    throw new SafeSegmentRequestLimitError();
  }
  const output: string[] = [];
  signal?.throwIfAborted();
  for (const segment of segments) {
    signal?.throwIfAborted();
    if (segment.kind === 'protected' || segment.value.trim() === '') {
      output.push(segment.value);
      continue;
    }
    const response = await client.generate({
      instructions,
      input: segment.value,
      signal,
    });
    signal?.throwIfAborted();
    if (!withinJsonStringWireLimit(response.text, MAX_MARKDOWN_UTF8_BYTES)) {
      throw new ModelOutputTooLargeError();
    }
    const formatted = withOriginalBoundaries(segment.value, stripMarkdownWrapper(response.text.trim()));
    if (/__W2O_PROTECTED_\d+__/.test(formatted)) {
      throw new ProtectedPlaceholderError(undefined);
    }
    output.push(formatted);
  }
  if (!concatenatedStringsWithinJsonWireLimit(output, MAX_MARKDOWN_UTF8_BYTES)) {
    throw new ModelOutputTooLargeError();
  }
  return output.join('');
}

function paragraphUnits(value: string, offset = 0): Array<{ start: number; end: number }> {
  const boundaries = [0];
  const separator = /\r?\n[ \t]*\r?\n/g;
  for (const match of value.matchAll(separator)) boundaries.push(match.index! + match[0].length);
  return boundaries.map((start, index) => ({
    start: offset + start,
    end: offset + (boundaries[index + 1] ?? value.length),
  }));
}

function chunkMarkdown(markdown: string, maximum: number): string[] | undefined {
  const headingStarts = Array.from(markdown.matchAll(/^#{1,6}[ \t]+\S.*$/gm), (match) => match.index!);
  const sectionStarts = headingStarts.length > 1 ? [0, ...headingStarts.slice(1)] : [0];
  const sections = sectionStarts.map((start, index) => ({ start, end: sectionStarts[index + 1] ?? markdown.length }));
  const units = sections.flatMap((unit) => {
    if (unit.end - unit.start <= maximum) return unit;
    return paragraphUnits(markdown.slice(unit.start, unit.end), unit.start);
  });
  if (units.some((unit) => unit.end - unit.start > maximum)) return undefined;

  const chunks: string[] = [];
  let start = units[0]?.start ?? 0;
  let end = start;
  for (const unit of units) {
    if (end > start && unit.end - start > maximum) {
      chunks.push(markdown.slice(start, end));
      start = unit.start;
    }
    end = unit.end;
  }
  if (end > start || markdown.length === 0) chunks.push(markdown.slice(start, end));
  return chunks;
}

function warningFrom(error: unknown): string {
  if (error instanceof ModelOutputTooLargeError) {
    return zhCN.model.outputTooLarge;
  }
  if (error instanceof SafeSegmentRequestLimitError) {
    return zhCN.model.segmentLimit(MAX_SAFE_SEGMENT_REQUESTS);
  }
  if (error instanceof ProtectedPlaceholderError) return zhCN.model.protectedChanged;
  if (error instanceof ProviderError) return zhCN.model.unavailable(error.code);
  return zhCN.model.unavailable();
}

async function recoverFromPlaceholderChange(
  markdown: string,
  client: ModelClient,
  instructions: string,
  signal?: AbortSignal,
): Promise<FormatMarkdownResult> {
  try {
    return { ok: true, markdown: await formatUnprotectedSegments(markdown, client, instructions, signal) };
  } catch (error) {
    return { ok: false, markdown, warning: warningFrom(error) };
  }
}

export async function formatMarkdown(
  markdown: string,
  client: ModelClient,
  options: FormatMarkdownOptions = {},
): Promise<FormatMarkdownResult> {
  const instructions = options.instructions ?? SYSTEM_INSTRUCTION;
  try {
    return { ok: true, markdown: await formatOne(markdown, client, instructions, options.signal) };
  } catch (error) {
    if (error instanceof ProtectedPlaceholderError) {
      return recoverFromPlaceholderChange(markdown, client, instructions, options.signal);
    }
    if (!(error instanceof ProviderError) || error.code !== 'CONTEXT_LENGTH') {
      return { ok: false, markdown, warning: warningFrom(error) };
    }
  }

  const maximum = Math.max(1, options.maxChunkCharacters ?? Math.max(1_000, Math.ceil(markdown.length / 2)));
  // Protect once before finding boundaries so headings and blank lines inside
  // fences are represented by one atomic placeholder and cannot become cuts.
  const protectedDocument = protectMarkdown(markdown);
  const chunks = chunkMarkdown(protectedDocument.markdown, maximum);
  if (!chunks || chunks.length < 2) {
    return { ok: false, markdown, warning: zhCN.model.unavailable('CONTEXT_LENGTH') };
  }
  try {
    const formatted: string[] = [];
    for (const chunk of chunks) {
      options.signal?.throwIfAborted();
      formatted.push(await formatOne(chunk, client, instructions, options.signal));
    }
    if (!concatenatedStringsWithinJsonWireLimit(formatted, MAX_MARKDOWN_UTF8_BYTES)) {
      throw new ModelOutputTooLargeError();
    }
    const restored = restoreProtectedMarkdown(formatted.join(''), protectedDocument);
    if (!withinJsonStringWireLimit(restored, MAX_MARKDOWN_UTF8_BYTES)) {
      throw new ModelOutputTooLargeError();
    }
    return { ok: true, markdown: restored };
  } catch (error) {
    if (error instanceof ProtectedPlaceholderError) {
      return recoverFromPlaceholderChange(markdown, client, instructions, options.signal);
    }
    return { ok: false, markdown, warning: warningFrom(error) };
  }
}
