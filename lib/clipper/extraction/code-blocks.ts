/**
 * 在线编辑器（Tiptap、各类文档站）常把 <pre> 包在带工具栏、行号栏、滚动容器的组件里。
 * 这些外壳会干扰 Readability：例如类名含 "scroll" 的容器会被判为负面元素整块删除，
 * 连带里面的代码一起丢失；保留下来时工具栏文字和行号也会混进 Markdown。
 *
 * normalizeCodeBlockWidgets 把这类组件整体替换成干净的 <pre><code class="language-x">。
 */

// 只向上穿过这些通用容器；li、td、blockquote、figure 等有语义的元素不会被替换
const WRAPPER_TAGS = new Set(['DIV', 'SPAN']);
// 组件外壳里除代码和行号以外允许出现的文字长度（工具栏标题、语言名、"复制"按钮等）
const MAX_CHROME_TEXT = 60;
const CONTENT_OUTSIDE_CODE_SELECTOR = 'pre, p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, img, figure';
const LINE_NUMBER_SELECTOR = [
  '[class*="line-number" i]',
  '[class*="linenumber" i]',
  '[class*="line-numbers-rows" i]',
  '[class*="lineno" i]',
  '[class*="gutter" i]',
].join(',');
const LANGUAGE_ATTRIBUTES = ['data-language', 'data-lang', 'data-code-language', 'lang'] as const;
const CLASS_LANGUAGE = /(?:^|\s)(?:language|lang)-([\w#+.-]+)/i;

const KNOWN_LANGUAGES = new Map<string, string>([
  ...[
    'bash', 'c', 'clojure', 'cpp', 'csharp', 'css', 'dart', 'diff', 'dockerfile', 'elixir', 'erlang',
    'go', 'graphql', 'groovy', 'haskell', 'html', 'http', 'ini', 'java', 'javascript', 'json', 'json5',
    'jsx', 'kotlin', 'less', 'lua', 'makefile', 'markdown', 'mermaid', 'nginx', 'objectivec', 'perl',
    'php', 'powershell', 'properties', 'protobuf', 'python', 'r', 'ruby', 'rust', 'scala', 'scss',
    'shell', 'sql', 'swift', 'toml', 'tsx', 'typescript', 'vue', 'xml', 'yaml',
  ].map((language) => [language, language] as const),
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['py', 'python'],
  ['sh', 'bash'],
  ['zsh', 'bash'],
  ['yml', 'yaml'],
  ['md', 'markdown'],
  ['golang', 'go'],
  ['c++', 'cpp'],
  ['c#', 'csharp'],
  ['cs', 'csharp'],
  ['kt', 'kotlin'],
  ['rb', 'ruby'],
  ['rs', 'rust'],
  ['proto', 'protobuf'],
  ['objective-c', 'objectivec'],
  ['ps1', 'powershell'],
  // 纯文本不加语言标记
  ['text', ''],
  ['plaintext', ''],
  ['plain', ''],
  ['txt', ''],
  ['plain text', ''],
]);

function normalizeLanguage(value: string | null | undefined): string | undefined {
  const key = value?.trim().toLowerCase();
  if (!key) return undefined;
  return KNOWN_LANGUAGES.get(key);
}

/** 统计外壳中目标元素以外的文字长度（纯数字的文本节点视为行号） */
function chromeTextLength(container: Element, target: Element): number {
  const walker = container.ownerDocument.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */);
  let length = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (target.contains(node)) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, '');
    if (!text || /^\d+$/.test(text)) continue;
    length += text.length;
  }
  return length;
}

function hasContentOutside(container: Element, target: Element): boolean {
  return Array.from(container.querySelectorAll(CONTENT_OUTSIDE_CODE_SELECTOR))
    .some((element) => element !== target && !target.contains(element) && !element.contains(target));
}

/**
 * 从目标元素（代码块的 <pre>、图表图片）向上找到组件的最外层。
 * 只穿过 div / span，且外壳里只能有工具栏、行号这类短文字，不能有其他正文内容。
 */
export function findWidgetRoot(target: Element): Element {
  let root: Element = target;
  let candidate = target.parentElement;
  while (candidate && WRAPPER_TAGS.has(candidate.tagName)) {
    if (hasContentOutside(candidate, target)) break;
    if (chromeTextLength(candidate, target) > MAX_CHROME_TEXT) break;
    root = candidate;
    candidate = candidate.parentElement;
  }
  return root;
}

function detectLanguage(root: Element, pre: Element): string {
  const code = pre.querySelector('code');
  for (const element of [code, pre, root].filter((item): item is Element => Boolean(item))) {
    const fromClass = element.getAttribute('class')?.match(CLASS_LANGUAGE)?.[1];
    if (fromClass) return normalizeLanguage(fromClass) ?? fromClass.toLowerCase();
  }

  for (const element of [code, pre, root, ...Array.from(root.querySelectorAll('*'))]) {
    if (!element || (element !== pre && element !== code && pre.contains(element))) continue;
    for (const attribute of LANGUAGE_ATTRIBUTES) {
      // lang 属性常用于自然语言（如 zh-CN），只接受已知的编程语言名
      const language = normalizeLanguage(element.getAttribute(attribute));
      if (language !== undefined) return language;
    }
  }

  // 工具栏里显示的语言名，例如 "json"、"Java"
  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (pre.contains(element) || element.children.length > 0) continue;
    const text = element.textContent?.trim() ?? '';
    if (text.length === 0 || text.length > 24) continue;
    const language = normalizeLanguage(text);
    if (language !== undefined) return language;
  }

  return '';
}

/** 取代码文本：去掉 <pre> 内部的行号；每行一个块元素且没有换行符时按行拼接 */
function codeText(pre: Element): string {
  const clone = pre.cloneNode(true) as Element;
  clone.querySelectorAll(LINE_NUMBER_SELECTOR).forEach((element) => element.remove());
  const text = clone.textContent ?? '';
  if (text.includes('\n')) return text;

  const lineContainer = clone.querySelector(':scope > code') ?? clone;
  const lines = Array.from(lineContainer.children).filter((child) => ['DIV', 'P', 'LI'].includes(child.tagName));
  return lines.length > 1 ? lines.map((line) => line.textContent ?? '').join('\n') : text;
}

export function normalizeCodeBlockWidgets(document: Document): void {
  for (const pre of Array.from(document.querySelectorAll('pre'))) {
    // 嵌套的 <pre> 由外层处理
    if (!pre.isConnected || pre.parentElement?.closest('pre')) continue;

    const root = findWidgetRoot(pre);
    // 没有外壳也没有行号的普通 <pre> 保持原样，交给转换器处理（含混合内容的 <pre> 也在此列）
    if (root === pre && !pre.querySelector(LINE_NUMBER_SELECTOR)) continue;

    const language = detectLanguage(root, pre);
    const text = codeText(pre);

    const cleanPre = document.createElement('pre');
    const code = document.createElement('code');
    if (language) code.className = `language-${language}`;
    code.textContent = text;
    cleanPre.append(code);
    root.replaceWith(cleanPre);
  }
}
