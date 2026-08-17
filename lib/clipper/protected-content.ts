export interface ProtectedPlaceholder {
  token: string;
  value: string;
}

export interface ProtectedMarkdown {
  markdown: string;
  placeholders: ProtectedPlaceholder[];
}

export type ProtectedSegment =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{ kind: 'protected'; value: string }>;

interface Range {
  start: number;
  end: number;
}

const PLACEHOLDER_PATTERN = /__W2O_PROTECTED_\d+__/g;
const IMAGE_TOKEN_PATTERN = /__W2O_IMAGE_[a-f0-9]{16,64}__/g;

function overlaps(range: Range, ranges: readonly Range[]): boolean {
  return ranges.some((candidate) => range.start < candidate.end && candidate.start < range.end);
}

function beforeTrailingLineEnding(end: number, value: string): number {
  if (value.endsWith('\r\n')) return end - 2;
  if (value.endsWith('\n')) return end - 1;
  return end;
}

function fencedRanges(markdown: string): Range[] {
  const ranges: Range[] = [];
  const opening = /^(?: {0,3})(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/gm;
  let match: RegExpExecArray | null;
  while ((match = opening.exec(markdown))) {
    const fence = match[1]!;
    const closing = new RegExp(`^(?: {0,3})${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*(?:\\r?\\n|$)`, 'gm');
    closing.lastIndex = opening.lastIndex;
    const close = closing.exec(markdown);
    const end = close
      ? beforeTrailingLineEnding(close.index + close[0].length, close[0])
      : markdown.length;
    ranges.push({ start: match.index, end });
    opening.lastIndex = end;
  }
  return ranges;
}

function frontmatterRanges(markdown: string): Range[] {
  const opening = /^---[ \t]*\r?\n/.exec(markdown);
  if (!opening) return [];
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/gm;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(markdown);
  return match ? [{
    start: 0,
    end: beforeTrailingLineEnding(match.index + match[0].length, match[0]),
  }] : [];
}

function imageTokenRanges(markdown: string, occupied: readonly Range[]): Range[] {
  return Array.from(markdown.matchAll(IMAGE_TOKEN_PATTERN), (match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  })).filter((range) => !overlaps(range, occupied));
}

function sourcePlaceholderRanges(markdown: string, occupied: readonly Range[]): Range[] {
  return Array.from(markdown.matchAll(PLACEHOLDER_PATTERN), (match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  })).filter((range) => !overlaps(range, occupied));
}

function externalLinkRanges(markdown: string, occupied: readonly Range[]): Range[] {
  const ranges: Range[] = [];
  for (let marker = markdown.indexOf(']('); marker >= 0; marker = markdown.indexOf('](', marker + 2)) {
    if (marker > 0 && markdown[marker - 1] === '!') continue;
    let start = marker + 2;
    while (markdown[start] === ' ' || markdown[start] === '\t') start += 1;
    if (markdown[start] === '<') {
      const end = markdown.indexOf('>', start + 1);
      if (end > start + 1) {
        const range = { start, end: end + 1 };
        if (!overlaps(range, occupied) && !overlaps(range, ranges)) ranges.push(range);
      }
      continue;
    }
    if (markdown[start] === ')' || markdown[start] === '\n' || markdown[start] === '\r' || start >= markdown.length) continue;
    let depth = 1;
    let escaped = false;
    let cursor = start;
    for (; cursor < markdown.length; cursor += 1) {
      const character = markdown[cursor]!;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
        if (depth === 0) break;
      } else if ((character === '\n' || character === '\r') && depth === 1) {
        break;
      }
    }
    if (depth === 0 && cursor > start) {
      const range = { start, end: cursor };
      if (!overlaps(range, occupied) && !overlaps(range, ranges)) ranges.push(range);
    }
  }
  return ranges;
}

function referenceLinkRanges(markdown: string, occupied: readonly Range[]): Range[] {
  const ranges: Range[] = [];
  const definition = /^[ \t]{0,3}\[[^\]\r\n]+\]:[ \t]*/gm;
  for (const match of markdown.matchAll(definition)) {
    const start = match.index! + match[0].length;
    if (markdown[start] === '<') {
      const close = markdown.indexOf('>', start + 1);
      if (close > start + 1) {
        const range = { start, end: close + 1 };
        if (!overlaps(range, occupied)) ranges.push(range);
      }
      continue;
    }
    let cursor = start;
    let depth = 0;
    let escaped = false;
    for (; cursor < markdown.length; cursor += 1) {
      const character = markdown[cursor]!;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '(') depth += 1;
      else if (character === ')' && depth > 0) depth -= 1;
      else if (/\s/.test(character) && depth === 0) break;
    }
    if (cursor > start) {
      const range = { start, end: cursor };
      if (!overlaps(range, occupied)) ranges.push(range);
    }
  }
  return ranges;
}

function nextToken(markdown: string, reserved: ReadonlySet<string>, index: number): { token: string; next: number } {
  let candidate = index;
  while (true) {
    const token = `__W2O_PROTECTED_${candidate}__`;
    if (!markdown.includes(token) && !reserved.has(token)) return { token, next: candidate + 1 };
    candidate += 1;
  }
}

export function protectMarkdown(markdown: string): ProtectedMarkdown {
  const frontmatter = frontmatterRanges(markdown);
  const fences = fencedRanges(markdown).filter((range) => !overlaps(range, frontmatter));
  const images = imageTokenRanges(markdown, [...frontmatter, ...fences]);
  const sourcePlaceholders = sourcePlaceholderRanges(markdown, [...frontmatter, ...fences, ...images]);
  const occupied = [...frontmatter, ...fences, ...images, ...sourcePlaceholders];
  const links = externalLinkRanges(markdown, occupied);
  const references = referenceLinkRanges(markdown, [...occupied, ...links]);
  const ranges = [...occupied, ...links, ...references].sort((left, right) => left.start - right.start);
  const placeholders: ProtectedPlaceholder[] = [];
  const reserved = new Set<string>();
  let output = '';
  let cursor = 0;
  let tokenIndex = 0;

  for (const range of ranges) {
    if (range.start < cursor) continue;
    const allocated = nextToken(markdown, reserved, tokenIndex);
    tokenIndex = allocated.next;
    reserved.add(allocated.token);
    output += markdown.slice(cursor, range.start) + allocated.token;
    placeholders.push({ token: allocated.token, value: markdown.slice(range.start, range.end) });
    cursor = range.end;
  }
  output += markdown.slice(cursor);
  return { markdown: output, placeholders };
}

export function splitProtectedMarkdown(document: ProtectedMarkdown): ProtectedSegment[] {
  const byToken = new Map(document.placeholders.map((placeholder) => [placeholder.token, placeholder.value]));
  return document.markdown
    .split(/(__W2O_PROTECTED_\d+__)/g)
    .filter((value) => value.length > 0)
    .map((value) => byToken.has(value)
      ? { kind: 'protected' as const, value: byToken.get(value)! }
      : { kind: 'text' as const, value });
}

function validatePlaceholders(markdown: string, placeholders: readonly ProtectedPlaceholder[]): void {
  const expected = new Set(placeholders.map(({ token }) => token));
  const actual = markdown.match(PLACEHOLDER_PATTERN) ?? [];
  if (actual.length !== placeholders.length) throw new Error('Protected placeholder multiset is invalid');
  const counts = new Map<string, number>();
  for (const token of actual) counts.set(token, (counts.get(token) ?? 0) + 1);
  if ([...counts].some(([token, count]) => !expected.has(token) || count !== 1) ||
      placeholders.some(({ token }) => counts.get(token) !== 1)) {
    throw new Error('Protected placeholder multiset is invalid');
  }
}

export function restoreProtectedMarkdown(markdown: string, protectedDocument: ProtectedMarkdown): string {
  validatePlaceholders(markdown, protectedDocument.placeholders);
  let restored = markdown;
  for (const placeholder of protectedDocument.placeholders) {
    restored = restored.replace(placeholder.token, placeholder.value);
  }
  return restored;
}
