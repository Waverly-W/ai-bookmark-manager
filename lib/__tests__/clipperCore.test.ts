// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { extractArticle } from '../clipper/extraction/readability';
import { convertArticleToMarkdown } from '../clipper/markdown/converter';
import { protectMarkdown, restoreProtectedMarkdown } from '../clipper/llm/protected-content';

describe('Clipper Core Integration', () => {
  it('extracts readable article from HTML DOM and converts to markdown', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Article</title></head>
        <body>
          <article>
            <h1>Test Article Title for Web Clipper</h1>
            <p>This is a sufficiently long paragraph designed to satisfy the readability extractor length requirements in unit tests. We want to make sure that the text length is definitely longer than two hundred characters so that the minimum length check passes cleanly without throwing CONTENT_TOO_SHORT error.</p>
            <p>Here is another paragraph containing additional informative content, links like <a href="https://example.com">Example Site</a>, and structured information that represents a typical clipped article.</p>
            <pre><code class="language-typescript">const x = 1;</code></pre>
            <img src="https://example.com/image.png" alt="Example Image" />
          </article>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const article = extractArticle(doc, 'https://example.com/article');

    expect(article.title).toBe('Test Article Title for Web Clipper');
    expect(article.contentHtml).toContain('This is a sufficiently long paragraph');

    const result = await convertArticleToMarkdown(article, {
      clipped: '2026-07-20T00:00:00.000Z',
    });

    expect(result.markdown).toContain('---');
    expect(result.markdown).toContain('title: Test Article Title for Web Clipper');
    expect(result.markdown).toContain('const x = 1;');
    expect(result.imageReferences.length).toBe(1);
    expect(result.imageReferences[0].sourceUrl).toBe('https://example.com/image.png');
  });

  it('protects and restores code blocks and placeholders correctly during AI formatting', () => {
    const inputMd = `# Title

\`\`\`javascript
const secret = "don't change me";
\`\`\`

Here is an image: ![Alt](__W2O_IMG_0__)
`;

    const protectedDoc = protectMarkdown(inputMd);
    expect(protectedDoc.markdown).toContain('__W2O_PROTECTED_0__');
    expect(protectedDoc.markdown).toContain('__W2O_PROTECTED_1__');

    // Simulate AI formatted response that preserves placeholders
    const aiOutput = `# Formatted Title\n\n${protectedDoc.markdown.slice(protectedDoc.markdown.indexOf('__W2O_PROTECTED_0__'))}`;

    const restored = restoreProtectedMarkdown(aiOutput, protectedDoc);
    expect(restored).toContain('const secret = "don\'t change me";');
    expect(restored).toContain('![Alt](__W2O_IMG_0__)');
  });
});
