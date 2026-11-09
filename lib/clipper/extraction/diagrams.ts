import { findWidgetRoot } from './code-blocks';

/**
 * 快照阶段（injected.ts）会把 Mermaid 图替换成 ```mermaid 代码块（拿到源码时）
 * 或 PNG 图片（拿不到源码时），并打上 data-clipper-diagram 标记。
 * 这里去掉图表组件的工具栏外壳，避免 "Mermaid" 标题、按钮文字混进正文，然后移除标记。
 */
export const DIAGRAM_MARKER_ATTRIBUTE = 'data-clipper-diagram';

export function collapseDiagramWidgets(document: Document): void {
  for (const diagram of Array.from(document.querySelectorAll(`[${DIAGRAM_MARKER_ATTRIBUTE}]`))) {
    diagram.removeAttribute(DIAGRAM_MARKER_ATTRIBUTE);
    if (!diagram.isConnected) continue;
    const root = findWidgetRoot(diagram);
    if (root !== diagram) root.replaceWith(diagram);
  }
}
