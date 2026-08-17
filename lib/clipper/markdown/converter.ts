import TurndownService from 'turndown';

import type { ExtractedArticle, ImageReference } from '../contracts/article';
import { buildFrontmatter, combineFrontmatterAndBody } from './frontmatter';
import { tokenizeImages } from './image-references';

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export interface MarkdownConversionOptions {
  clipped: string;
  tags?: readonly string[];
  sourceUrl?: string;
}

export interface MarkdownConversionResult {
  markdown: string;
  imageReferences: ImageReference[];
}

function element(node: Node): Element {
  return node as Element;
}

function codeLanguage(node: Node, directCode?: Element): string {
  const pre = element(node);
  const code = directCode ?? pre.querySelector(':scope > code');
  const classes = `${pre.getAttribute('class') ?? ''} ${code?.getAttribute('class') ?? ''}`;
  return classes.match(/(?:^|\s)(?:language|lang)-([\w+-]+)/)?.[1] ?? '';
}

function fenceFor(code: string): string {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((match) => match.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function normalizeFootnoteId(value: string | null | undefined, reference: boolean): string | undefined {
  if (!value) return undefined;
  const hash = value.includes('#') ? value.slice(value.lastIndexOf('#') + 1) : value;
  let decoded: string;
  try {
    decoded = decodeURIComponent(hash);
  } catch {
    decoded = hash;
  }
  const structuralId = decoded.replace(/^user-content-/i, '');
  const prefix = reference ? /^fnref[:_-]?(.+)$/i : /^fn[:_-]?(.+)$/i;
  const label = structuralId.match(prefix)?.[1]?.trim();
  return label && /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(label) ? label : undefined;
}

function meaningfulChildNodes(node: Element): ChildNode[] {
  return Array.from(node.childNodes).filter((child) =>
    child.nodeType === Node.ELEMENT_NODE
    || (child.nodeType === Node.TEXT_NODE && Boolean(child.textContent?.trim())));
}

function fencedCode(pre: Element, codeElement: Element): string {
  const code = (codeElement.textContent ?? '').replace(/^\n/, '').replace(/\n$/, '');
  const fence = fenceFor(code);
  return `${fence}${codeLanguage(pre, codeElement)}\n${code}\n${fence}`;
}

function directTableRows(table: Element): HTMLTableRowElement[] {
  return Array.from(table.querySelectorAll('tr'))
    .filter((row): row is HTMLTableRowElement => row.closest('table') === table);
}

function directRowCells(row: Element): Element[] {
  return Array.from(row.children).filter((cell) => cell.matches('th, td'));
}

function readableText(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function flattenNestedTables(root: Element): void {
  const tables = Array.from(root.querySelectorAll('table')).reverse();
  for (const table of tables) {
    const caption = readableText(table.querySelector(':scope > caption') ?? table.ownerDocument.createTextNode(''));
    const rows = directTableRows(table).map((row) =>
      directRowCells(row).map(readableText).filter(Boolean).join(' / ')).filter(Boolean);
    const fragment = table.ownerDocument.createDocumentFragment();
    fragment.append(' ');
    if (caption) {
      fragment.append(caption);
      if (rows.length > 0) fragment.append(table.ownerDocument.createElement('br'));
    }
    rows.forEach((row, index) => {
      if (index > 0) fragment.append(table.ownerDocument.createElement('br'));
      fragment.append(row);
    });
    fragment.append(' ');
    table.replaceWith(fragment);
  }
}

function tableCellMarkdown(service: TurndownService, cell: Element): string {
  const clone = cell.cloneNode(true) as Element;
  flattenNestedTables(clone);
  return service
    .turndown(clone.innerHTML)
    .trim()
    .replace(/[ \t]{2,}\n/g, '<br>')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|');
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---',
  });

  service.addRule('language-fenced-code', {
    filter: (node) => {
      if (node.nodeName !== 'PRE') return false;
      const children = meaningfulChildNodes(element(node));
      return children.length === 1 && children[0]?.nodeName === 'CODE';
    },
    replacement: (_content, node) => {
      const codeElement = element(node).querySelector(':scope > code');
      return codeElement ? `\n\n${fencedCode(element(node), codeElement)}\n\n` : '';
    },
  });

  service.addRule('mixed-preformatted-content', {
    filter: (node) => {
      if (node.nodeName !== 'PRE') return false;
      const children = meaningfulChildNodes(element(node));
      return children.some((child) => child.nodeName === 'CODE')
        && !(children.length === 1 && children[0]?.nodeName === 'CODE');
    },
    replacement: (_content, node) => {
      const pre = element(node);
      const parts = Array.from(pre.childNodes).map((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && child.nodeName === 'CODE') {
          return fencedCode(pre, element(child));
        }
        const container = pre.ownerDocument.createElement('div');
        container.append(child.cloneNode(true));
        return service.turndown(container.innerHTML).trim();
      }).filter(Boolean);
      return parts.length > 0 ? `\n\n${parts.join('\n\n')}\n\n` : '';
    },
  });

  service.addRule('strikethrough', {
    filter: (node) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
    replacement: (content) => content.trim() ? `~~${content}~~` : '',
  });

  service.addRule('task-checkbox', {
    filter: (node) => node.nodeName === 'INPUT'
      && element(node).getAttribute('type')?.toLowerCase() === 'checkbox',
    replacement: (_content, node) => element(node).hasAttribute('checked') ? '[x]' : '[ ]',
  });

  service.addRule('footnote-reference', {
    filter: (node) => {
      const current = element(node);
      const anchor = node.nodeName === 'A' ? current : current.querySelector('a[href]');
      return (node.nodeName === 'SUP' || current.hasAttribute('data-footnote-ref'))
        && Boolean(
          normalizeFootnoteId(anchor?.getAttribute('href'), false)
          ?? normalizeFootnoteId(current.getAttribute('id'), true)
          ?? normalizeFootnoteId(anchor?.getAttribute('id'), true)
        );
    },
    replacement: (_content, node) => {
      const current = element(node);
      const anchor = node.nodeName === 'A' ? current : current.querySelector('a[href]');
      const id = normalizeFootnoteId(anchor?.getAttribute('href'), false)
        ?? normalizeFootnoteId(current.getAttribute('id'), true)
        ?? normalizeFootnoteId(anchor?.getAttribute('id'), true);
      return id ? `[^${id}]` : '';
    },
  });

  service.addRule('footnote-definition', {
    filter: (node) => node.nodeName === 'LI'
      && Boolean(normalizeFootnoteId(element(node).getAttribute('id'), false)),
    replacement: (content, node) => {
      const id = normalizeFootnoteId(element(node).getAttribute('id'), false);
      const definition = content.trim().replace(/\n/g, '\n    ');
      return id && definition ? `\n\n[^${id}]: ${definition}\n\n` : '';
    },
  });

  service.addRule('figure', {
    filter: 'figure',
    replacement: (_content, node) => {
      const clone = element(node).cloneNode(true) as Element;
      const captions = Array.from(clone.querySelectorAll(':scope > figcaption'));
      const captionMarkdown = captions
        .map((caption) => service.turndown(caption.innerHTML).trim())
        .filter(Boolean);
      captions.forEach((caption) => caption.remove());
      const main = service.turndown(clone.innerHTML).trim();
      const parts = [main, ...captionMarkdown].filter(Boolean);
      return parts.length > 0 ? `\n\n${parts.join('\n\n')}\n\n` : '';
    },
  });

  service.addRule('gfm-table', {
    filter: 'table',
    replacement: (_content, node) => {
      const table = element(node);
      const captionElement = table.querySelector(':scope > caption');
      const caption = captionElement ? service.turndown(captionElement.innerHTML).trim() : '';
      const rows = directTableRows(table)
        .map((row) => directRowCells(row).map((cell) => tableCellMarkdown(service, cell)))
        .filter((row) => row.length > 0);
      if (rows.length === 0) return '';

      const columnCount = Math.max(...rows.map((row) => row.length));
      const normalizedRows = rows.map((row) => [
        ...row,
        ...Array.from({ length: columnCount - row.length }, () => ''),
      ]);
      const line = (row: string[]) => `| ${row.join(' | ')} |`;
      const separator = Array.from({ length: columnCount }, () => '---');
      const renderedTable = [line(normalizedRows[0]!), line(separator), ...normalizedRows.slice(1).map(line)].join('\n');
      return `\n\n${caption ? `${caption}\n\n` : ''}${renderedTable}\n\n`;
    },
  });

  return service;
}

function sanitizeLinks(html: string, baseUrl: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const anchor of Array.from(document.body.querySelectorAll('a'))) {
    const href = anchor.getAttribute('href')?.trim();
    if (
      anchor.classList.contains('footnote-backref')
      || anchor.hasAttribute('data-footnote-backref')
      || normalizeFootnoteId(href, true)
    ) {
      anchor.remove();
      continue;
    }
    if (!href) {
      anchor.removeAttribute('href');
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl);
      if (!SAFE_LINK_PROTOCOLS.has(resolved.protocol)) {
        anchor.removeAttribute('href');
      } else {
        anchor.setAttribute('href', resolved.href);
      }
    } catch {
      anchor.removeAttribute('href');
    }
  }
  return document.body.innerHTML;
}

export async function convertArticleToMarkdown(
  article: ExtractedArticle,
  options: MarkdownConversionOptions,
): Promise<MarkdownConversionResult> {
  const pageUrl = options.sourceUrl ?? article.sourceUrl;
  const source = article.canonicalUrl ?? pageUrl;
  const frontmatter = buildFrontmatter({
    title: article.title,
    source,
    author: article.byline,
    published: article.published,
    clipped: options.clipped,
    tags: options.tags,
  });
  const tokenized = await tokenizeImages(article.contentHtml, pageUrl, [frontmatter]);
  const body = createTurndownService()
    .turndown(sanitizeLinks(tokenized.html, pageUrl))
    .replace(/^(\s*)-\s+\[([ x])\]\s+/gm, '$1- [$2] ');

  return {
    markdown: combineFrontmatterAndBody(frontmatter, body),
    imageReferences: tokenized.imageReferences,
  };
}
