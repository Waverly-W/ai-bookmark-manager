import { browser } from 'wxt/browser';

interface BookmarkTreeNode {
    id: string;
    parentId?: string;
    index?: number;
    url?: string;
    title: string;
    dateAdded?: number;
    dateGroupModified?: number;
    unmodifiable?: any;
    children?: BookmarkTreeNode[];
}

export type ExportFormat = 'html' | 'json' | 'markdown';

export interface ExportOptions {
    format: ExportFormat;
}

/**
 * 导出书签的主函数
 */
export const exportBookmarks = async (options: ExportOptions) => {
    const tree = await browser.bookmarks.getTree();
    let content = '';
    let mimeType = '';
    let extension = '';

    switch (options.format) {
        case 'html':
            content = generateNetscapeHTML(tree);
            mimeType = 'text/html';
            extension = 'html';
            break;
        case 'json':
            content = JSON.stringify(tree, null, 2);
            mimeType = 'application/json';
            extension = 'json';
            break;
        case 'markdown':
            content = generateMarkdown(tree);
            mimeType = 'text/markdown';
            extension = 'md';
            break;
    }

    downloadFile(content, mimeType, `bookmarks_${new Date().toISOString().slice(0, 10)}.${extension}`);
};

/**
 * 生成 Netscape Bookmark File Format HTML
 */
const generateNetscapeHTML = (tree: BookmarkTreeNode[]): string => {
    const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const footer = `</DL><p>`;

    const processNode = (node: BookmarkTreeNode, indent: number): string => {
        const spaces = '    '.repeat(indent);
        let html = '';

        if (node.url) {
            // 书签节点
            const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';
            html += `${spaces}<DT><A HREF="${node.url}"${addDate}>${escapeHtml(node.title)}</A>\n`;
        } else if (node.children) {
            // 文件夹节点（跳过根节点本身，但处理其子节点）
            if (node.id === '0') {
                // 根节点，直接处理子节点
                for (const child of node.children) {
                    html += processNode(child, indent);
                }
            } else {
                const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';
                const lastModified = node.dateGroupModified ? ` LAST_MODIFIED="${Math.floor(node.dateGroupModified / 1000)}"` : '';

                // 根目录下的直接子文件夹（如书签栏、其他书签）通常不需要特殊的文件夹属性，但为了兼容性，我们还是按标准文件夹处理
                // 注意：根节点的直接子节点（如id为1的书签栏）通常不显示为文件夹，而是作为顶级容器
                // 这里为了简化，我们统一处理为文件夹结构

                html += `${spaces}<DT><H3${addDate}${lastModified}>${escapeHtml(node.title)}</H3>\n`;
                html += `${spaces}<DL><p>\n`;
                for (const child of node.children) {
                    html += processNode(child, indent + 1);
                }
                html += `${spaces}</DL><p>\n`;
            }
        }

        return html;
    };

    return header + processNode(tree[0], 0) + footer;
};

/**
 * 生成 Markdown 格式
 */
const generateMarkdown = (tree: BookmarkTreeNode[]): string => {
    let markdown = '# Bookmarks\n\n';

    const processNode = (node: BookmarkTreeNode, level: number): string => {
        let md = '';
        const indent = '  '.repeat(Math.max(0, level - 1)); // Markdown 列表缩进

        if (node.url) {
            // 书签节点
            md += `${indent}- [${escapeMarkdown(node.title)}](${node.url})\n`;
        } else if (node.children) {
            // 文件夹节点
            if (node.id !== '0') {
                // 非根节点显示标题
                if (level > 0) {
                    md += `${indent}- **${escapeMarkdown(node.title)}**\n`;
                }
            }

            // 处理子节点
            for (const child of node.children) {
                md += processNode(child, node.id === '0' ? 0 : level + 1);
            }
        }

        return md;
    };

    return markdown + processNode(tree[0], 0);
};

/**
 * 触发文件下载
 */
const downloadFile = (content: string, mimeType: string, filename: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * 转义 HTML 特殊字符
 */
const escapeHtml = (text: string): string => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * 转义 Markdown 特殊字符
 */
const escapeMarkdown = (text: string): string => {
    // 简单转义 [] 和 () 以防止破坏链接格式
    return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
};
