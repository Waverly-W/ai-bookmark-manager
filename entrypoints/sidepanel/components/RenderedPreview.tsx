import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeLinkUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

const components: Components = {
  a({ href, children, ...props }) {
    const safeHref = safeLinkUrl(href);
    if (!safeHref) return <span>{children}</span>;
    return (
      <a
        {...props}
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:opacity-80"
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const safeSrc = typeof src === 'string' ? safeHttpUrl(src) : undefined;
    if (!safeSrc) return null;
    return (
      <img
        src={safeSrc}
        alt={alt ?? ''}
        loading="lazy"
        className="max-w-full h-auto rounded border my-2"
      />
    );
  },
  h1({ children }) {
    return <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>;
  },
  p({ children }) {
    return <p className="text-sm leading-relaxed mb-2 text-foreground/90">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside text-sm space-y-1 mb-2">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside text-sm space-y-1 mb-2">{children}</ol>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-primary/40 pl-3 italic text-muted-foreground my-2">
        {children}
      </blockquote>
    );
  },
  code({ className, children, ...props }) {
    return (
      <code
        className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground/90"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="bg-muted/80 p-3 rounded-lg overflow-x-auto text-xs font-mono my-2 border">
        {children}
      </pre>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="w-full text-xs border-collapse border border-border">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border border-border p-1.5 bg-muted font-medium text-left">{children}</th>;
  },
  td({ children }) {
    return <td className="border border-border p-1.5">{children}</td>;
  },
};

export function RenderedPreview({ markdown }: { markdown: string }) {
  return (
    <div className="rendered-preview prose prose-sm dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
        urlTransform={(url) => safeLinkUrl(url) ?? ''}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
