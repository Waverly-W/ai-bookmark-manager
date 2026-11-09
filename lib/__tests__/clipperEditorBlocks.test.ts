// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractArticle } from '../clipper/extraction/readability';
import { normalizeDocument } from '../clipper/extraction/normalize-document';
import { collectDiagramSources, snapshotPage } from '../clipper/extraction/injected';
import { collectDiagramSourcesInTab, sanitizeDiagramSources } from '../clipper/extraction/tab-client';
import { convertArticleToMarkdown } from '../clipper/markdown/converter';

vi.mock('wxt/browser', () => ({ browser: { scripting: { executeScript: vi.fn() } } }));

const PAGE_URL = 'https://docs.example.com/docs/1';

const paragraph = (index: number) =>
  `<p>第 ${index} 段正文，模拟技术方案文档里的说明文字。售后商品剩余事实经过统一入口路由，再由赠品服务判断门槛并返回结果，内容足够长以便 Readability 按正常流程打分。</p>`;

// 结构取自一个真实的 Tiptap 文档站：工具栏、行号栏、类名含 scroll 的滚动容器
const tiptapCodeBlock = (language: string, codeHtml: string, lineCount: number) => `
<div class="code-block-wrapper" data-type="codeBlock" data-node-view-wrapper="" contenteditable="false">
  <div class="code-block-outer">
    <div class="code-block-head"><div class="code-block-toolbar">
      <div class="code-block-toolbar__leading">
        <button class="code-block-collapse-btn"><svg class="remixicon" viewBox="0 0 24 24"><path d="M0 0"/></svg></button>
        <div class="code-block-title-row"><span class="code-block-title-row__text">代码块</span></div>
      </div>
      <div class="code-block-toolbar__controls">
        <div class="code-block-toolbar__readonly-group"><span class="code-block-toolbar__readonly-text">${language}</span></div>
        <div class="code-block-copy-action"><span class="code-block-copy-action__divider">|</span><button class="code-block-copy-btn"><span>复制</span></button></div>
      </div>
    </div></div>
    <div class="code-block-body cb-hljs-scope-githubLight"><div class="code-block-editor-layout">
      <div class="code-block-line-gutter">${Array.from({ length: lineCount }, (_, i) => `<div class="code-block-line-gutter__line">${i + 1}</div>`).join('')}</div>
      <div class="code-block-pre-scroll"><pre class="code-block-pre"><code class="hljs" data-node-view-content="">${codeHtml}</code></pre></div>
    </div></div>
  </div>
</div>`;

const mermaidSvg = (id: string) => `
<svg id="${id}" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart" viewBox="0 0 600 400" aria-roledescription="flowchart-v2">
  <style>#${id}{font-family:sans-serif;}</style>
  <g><g class="nodes">${Array.from({ length: 6 }, (_, i) => `<g class="node"><rect width="100" height="40"></rect><g class="label"><foreignObject width="100" height="40"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel"><p>节点${i}</p></span></div></foreignObject></g></g>`).join('')}</g></g>
</svg>`;

const tiptapMermaid = (id: string) => `
<div class="mermaid-wrapper" data-node-view-wrapper="" contenteditable="false">
  <div class="mermaid-block-outer"><div class="mermaid-editor">
    <div class="editor-toolbar"><div class="toolbar-left"><div class="mermaid-title-row"><span class="mermaid-title-row__text">Mermaid</span></div></div>
      <div class="toolbar-right"><button class="diagram-toolbar-icon-btn"><svg class="remixicon" viewBox="0 0 24 24"><path d="M0 0"/></svg></button></div></div>
    <div class="editor-body"><div class="preview-panel"><div class="preview-svg-host">${mermaidSvg(id)}</div></div></div>
  </div></div>
</div>`;

const page = (blocks: string) => `<!DOCTYPE html><html><head><title>技术方案 - Docs</title></head><body>
<div id="app"><aside class="sidebar"><a href="/a">目录 A</a><a href="/b">目录 B</a></aside>
<main><div class="tiptap ProseMirror" contenteditable="false" role="textbox">
<h1>技术方案</h1><h2>1. 背景</h2>${[1, 2, 3, 4, 5, 6].map(paragraph).join('')}
${blocks}
${paragraph(7)}
</div></main></div></body></html>`;

async function clip(html: string): Promise<string> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const article = extractArticle(document, PAGE_URL);
  const { markdown } = await convertArticleToMarkdown(article, { clipped: '2026-11-09T00:00:00.000Z' });
  return markdown;
}

describe('editor code block widgets', () => {
  it('keeps code inside scroll containers that Readability would otherwise drop', async () => {
    const markdown = await clip(page(
      tiptapCodeBlock('text', '售后商品剩余事实\n  → promo-order 统一入口', 2)
      + paragraph(8)
      + tiptapCodeBlock('json', '<span class="hljs-punctuation">{</span>\n  <span class="hljs-attr">"tradeOrderId"</span>: <span class="hljs-string">"100001"</span>\n<span class="hljs-punctuation">}</span>', 3),
    ));

    expect(markdown).toContain('```\n售后商品剩余事实\n  → promo-order 统一入口\n```');
    expect(markdown).toContain('```json\n{\n  "tradeOrderId": "100001"\n}\n```');
    expect(markdown).not.toContain('代码块');
    expect(markdown).not.toContain('复制');
    expect(markdown).not.toMatch(/^\s*1\s*$/m);
  });

  it('keeps the language class of ordinary code blocks through Readability', async () => {
    const markdown = await clip(page('<pre><code class="language-typescript">const x: number = 1;</code></pre>'));
    expect(markdown).toContain('```typescript\nconst x: number = 1;\n```');
  });

  it('does not replace list items or other semantic containers around a code block', () => {
    const document = new DOMParser().parseFromString(
      `<ul><li><span>步骤一</span><div class="scroll"><pre><code>npm install</code></pre></div></li></ul>`,
      'text/html',
    );
    const normalized = normalizeDocument(document, PAGE_URL);
    expect(normalized.querySelector('ul > li > pre > code')?.textContent).toBe('npm install');
    expect(normalized.querySelector('li')?.textContent).toContain('步骤一');
  });

  it('leaves plain pre elements with mixed content untouched', () => {
    const html = '<article><pre>Output: <code>ok</code></pre></article>';
    const normalized = normalizeDocument(new DOMParser().parseFromString(html, 'text/html'), PAGE_URL);
    expect(normalized.querySelector('pre')?.innerHTML).toBe('Output: <code>ok</code>');
  });
});

describe('mermaid diagrams', () => {
  afterEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  const loadPage = (html: string) => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.documentElement.innerHTML = parsed.documentElement.innerHTML;
  };

  it('collects the source of Tiptap mermaid nodes from the editor instance', () => {
    loadPage(page(tiptapMermaid('mermaid-a-view') + paragraph(9) + tiptapMermaid('mermaid-b-view')));
    const root = document.querySelector('.ProseMirror')!;
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    const nodes = [
      { position: 10, node: { type: { name: 'paragraph' }, attrs: {} } },
      { position: 20, node: { type: { name: 'customMermaid' }, attrs: { code: 'flowchart TD\r\n  A --> B' } } },
      { position: 30, node: { type: { name: 'customMermaid' }, attrs: { code: 'not a diagram' } } },
    ];
    (root as any).editor = {
      view: {
        state: { doc: { descendants(callback: (node: unknown, position: number) => unknown) { nodes.forEach(({ node, position }) => callback(node, position)); } } },
        nodeDOM: (position: number) => (position === 20 ? wrappers[0] : position === 30 ? wrappers[1] : null),
      },
    };

    const sources = collectDiagramSources();
    const svgs = Array.from(document.documentElement.querySelectorAll('svg'));
    expect(sources).toEqual([
      { svgIndex: svgs.findIndex((svg) => svg.id === 'mermaid-a-view'), svgId: 'mermaid-a-view', source: 'flowchart TD\n  A --> B' },
    ]);
  });

  it('turns a mermaid diagram with a known source into a mermaid code block without its toolbar', async () => {
    loadPage(page(tiptapMermaid('mermaid-a-view')));
    const svgIndex = Array.from(document.documentElement.querySelectorAll('svg')).findIndex((svg) => svg.id === 'mermaid-a-view');

    const snapshot = await snapshotPage([{ svgIndex, svgId: 'mermaid-a-view', source: 'flowchart TD\n  A --> B' }]);
    const markdown = await clip(snapshot.html);

    expect(markdown).toContain('```mermaid\nflowchart TD\n  A --> B\n```');
    expect(markdown).not.toContain('Mermaid\n');
    expect(markdown).not.toContain('节点0');
  });

  it('ignores a source whose svg id no longer matches and falls back to the diagram image path', async () => {
    loadPage(page(tiptapMermaid('mermaid-a-view')));
    const svgIndex = Array.from(document.documentElement.querySelectorAll('svg')).findIndex((svg) => svg.id === 'mermaid-a-view');

    const snapshot = await snapshotPage([{ svgIndex, svgId: 'mermaid-other', source: 'flowchart TD\n  X --> Y' }]);

    expect(snapshot.html).not.toContain('X --&gt; Y');
    // jsdom 没有布局，图表尺寸为 0，栅格化失败时整张图被移除，而不是留下零散的节点文字
    expect(snapshot.html).not.toContain('mermaid-a-view');
  });
});

describe('diagram source collection in the tab', () => {
  it('drops malformed entries returned by the page', () => {
    expect(sanitizeDiagramSources([
      { svgIndex: 1, svgId: 'a', source: 'graph TD' },
      { svgIndex: 1, svgId: 'b', source: 'graph LR' },
      { svgIndex: -1, svgId: null, source: 'graph TD' },
      { svgIndex: 2, svgId: 3, source: 'graph TD' },
      { svgIndex: 3, svgId: null, source: '  ' },
      { svgIndex: 4, svgId: null, source: 'x'.repeat(100_001) },
      'junk',
    ])).toEqual([{ svgIndex: 1, svgId: 'a', source: 'graph TD' }]);
    expect(sanitizeDiagramSources({ length: 1 })).toEqual([]);
  });

  it('runs in the main world and falls back to no sources when injection fails', async () => {
    const executeScript = vi.fn(async (_injection: unknown) => [{ result: [{ svgIndex: 0, svgId: null, source: 'graph TD' }] }]);
    await expect(collectDiagramSourcesInTab(7, { scripting: { executeScript } } as any))
      .resolves.toEqual([{ svgIndex: 0, svgId: null, source: 'graph TD' }]);
    expect(executeScript.mock.calls[0][0]).toMatchObject({ target: { tabId: 7 }, world: 'MAIN' });

    const failing = { scripting: { executeScript: () => Promise.reject(new Error('world not supported')) } };
    await expect(collectDiagramSourcesInTab(7, failing as any)).resolves.toEqual([]);
  });
});
