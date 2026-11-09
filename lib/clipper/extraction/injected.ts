export interface PageSnapshot {
  pageUrl: string;
  html: string;
}

export interface SelectedPageRegion {
  selectionId: string;
  pageUrl: string;
  html: string;
}

/** 页面上某个图表 <svg> 对应的源码。svgIndex 是它在 document.documentElement.querySelectorAll('svg') 中的位置 */
export interface DiagramSource {
  svgIndex: number;
  svgId: string | null;
  source: string;
}

/**
 * 在页面主环境（world: 'MAIN'）运行，读取编辑器里保存的 Mermaid 源码。
 * 页面上只有渲染后的 SVG，源码存放在编辑器实例中，扩展默认的隔离环境读不到。
 * 目前支持 Tiptap / ProseMirror（根元素上挂有 editor 实例）。
 *
 * This function is passed directly to scripting.executeScript. Keep every
 * runtime dependency inside the function body so Chrome can serialize it.
 */
export function collectDiagramSources(): DiagramSource[] {
  const maximumSources = 200;
  const maximumSourceLength = 100_000;
  const mermaidStart = /^\s*(?:%%\{[\s\S]*?\}%%\s*)?(?:---[\s\S]*?---\s*)?(?:graph|flowchart|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4\w*|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|architecture(?:-beta)?|kanban|radar(?:-beta)?|treemap(?:-beta)?)\b/;
  const allSvgs = Array.from(document.documentElement.querySelectorAll('svg'));
  const results: DiagramSource[] = [];
  const used = new Set<number>();

  // 节点视图里还有工具栏图标，取元素最多的那个 <svg> 作为图表本身
  const diagramSvgIn = (container: Element): SVGSVGElement | null => {
    let best: SVGSVGElement | null = null;
    let bestCount = 0;
    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      const count = svg.querySelectorAll('*').length;
      if (count > bestCount) {
        best = svg;
        bestCount = count;
      }
    }
    return bestCount >= 10 ? best : null;
  };

  type ProseMirrorNode = {
    type?: { name?: string };
    attrs?: Record<string, unknown>;
    textContent?: string;
  };
  type EditorLike = {
    view?: {
      state?: { doc?: { descendants?: (callback: (node: ProseMirrorNode, position: number) => boolean | void) => void } };
      nodeDOM?: (position: number) => unknown;
    };
  };

  for (const root of Array.from(document.querySelectorAll('.ProseMirror'))) {
    const view = (root as Element & { editor?: EditorLike }).editor?.view;
    const descendants = view?.state?.doc?.descendants;
    if (!view || typeof descendants !== 'function' || typeof view.nodeDOM !== 'function') continue;

    try {
      descendants.call(view.state!.doc, (node, position) => {
        if (results.length >= maximumSources) return false;
        if (!/mermaid/i.test(node.type?.name ?? '')) return true;

        const attributes = node.attrs ?? {};
        const source = [attributes.code, attributes.source, attributes.content, attributes.lastValidCode, node.textContent]
          .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        const dom = view.nodeDOM!(position);
        if (source && source.length <= maximumSourceLength && mermaidStart.test(source) && dom instanceof Element) {
          const svg = diagramSvgIn(dom);
          const svgIndex = svg ? allSvgs.indexOf(svg) : -1;
          if (svg && svgIndex >= 0 && !used.has(svgIndex)) {
            used.add(svgIndex);
            results.push({ svgIndex, svgId: svg.id || null, source: source.replace(/\r\n?/g, '\n').trim() });
          }
        }
        return false;
      });
    } catch {
      // 编辑器结构不符合预期时忽略，快照阶段会把图表转成图片
    }
  }

  return results;
}

/**
 * This function is passed directly to scripting.executeScript. Keep every
 * runtime dependency inside the function body so Chrome can serialize it.
 */
export async function snapshotPage(diagramSources: DiagramSource[] = []): Promise<PageSnapshot> {
  const maximumBytes = 8 * 1024 * 1024;
  const maximumDimension = 8192;
  const maximumPixels = 16_777_216;
  const pageUrl = window.location.href;
  const clonedRoot = document.documentElement.cloneNode(true) as HTMLElement;
  const liveSvgs = Array.from(document.documentElement.querySelectorAll('svg'));
  const clonedSvgs = Array.from(clonedRoot.querySelectorAll('svg'));
  const generatedImages: Array<{ element: HTMLImageElement; dataUrlLength: number }> = [];
  const mermaidRole = /^(?:flowchart|graph|sequence|class|state|er|gantt|pie|journey|gitGraph|mindmap|timeline|quadrant|requirement|c4|sankey|xychart|block|packet|architecture|kanban|radar|treemap)/i;
  // 源码由页面主环境收集，用 id 再核对一次，防止页面在两次注入之间变化导致错位
  const sourceBySvgIndex = new Map<number, string>();
  for (const entry of Array.isArray(diagramSources) ? diagramSources : []) {
    const liveSvg = liveSvgs[entry?.svgIndex];
    if (!liveSvg || typeof entry.source !== 'string') continue;
    if (entry.svgId !== null && liveSvg.id !== entry.svgId) continue;
    sourceBySvgIndex.set(entry.svgIndex, entry.source);
  }
  const explicitAncestorSelector = '[data-macro-name="drawio" i], [data-macro-name="draw.io" i], .drawio-embedded-diagram';
  const explicitMarker = /draw\.?io|mxgraph|mxfile/i;
  const confluenceMarker = /confluence/i;
  const confluenceMeta = Array.from(document.querySelectorAll('meta')).some((meta) => {
    const name = meta.getAttribute('name') ?? '';
    const content = meta.getAttribute('content') ?? '';
    return /^(?:ajs-product-name|application-name)$/i.test(name)
      && confluenceMarker.test(content);
  });
  const confluenceRoot = [document.documentElement, document.body].some((element) => {
    if (!element) return false;
    return confluenceMarker.test(`${element.id} ${element.className}`);
  });
  const isConfluence = confluenceMeta || confluenceRoot;

  type ConversionRecord = Readonly<{
    alt: string;
    clonedSvg: SVGElement;
    detected: boolean;
    mermaid: boolean;
    height: number;
    serializedSvg: string;
    valid: boolean;
    width: number;
  }>;
  const conversions: ConversionRecord[] = [];

  for (let index = 0; index < clonedSvgs.length; index += 1) {
    const clonedSvg = clonedSvgs[index];
    const liveSvg = liveSvgs[index];
    if (!clonedSvg || !liveSvg) continue;

    const diagramSource = sourceBySvgIndex.get(index);
    if (diagramSource !== undefined) {
      // 有源码时输出 ```mermaid 代码块，Obsidian 可以直接渲染
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-mermaid';
      code.textContent = diagramSource;
      pre.append(code);
      pre.setAttribute('data-clipper-diagram', 'mermaid');
      clonedSvg.replaceWith(pre);
      continue;
    }

    const attributeMarker = Array.from(clonedSvg.attributes).some((attribute) => {
      const name = attribute.name.toLowerCase();
      const authoritativeValue = name === 'id' || name === 'class' || name.startsWith('data-');
      return explicitMarker.test(attribute.name)
        || (authoritativeValue && explicitMarker.test(attribute.value));
    });
    const structuralMarker = Array.from(clonedSvg.querySelectorAll('*')).some((element) => (
      /^(?:draw\.?io|mxgraph|mxfile|mxgraphmodel)$/i.test(element.localName)
    ));
    const metadataMarker = Array.from(clonedSvg.querySelectorAll('metadata')).some((element) => (
      Array.from(element.attributes).some((attribute) => (
        explicitMarker.test(attribute.name) || explicitMarker.test(attribute.value)
      ))
    ));
    const hasExplicitMarker = Boolean(clonedSvg.closest(explicitAncestorSelector))
      || attributeMarker
      || structuralMarker
      || metadataMarker;

    const descendants = [clonedSvg, ...Array.from(clonedSvg.querySelectorAll('*'))];
    const pointerEvents = descendants.map((element) => (
      (element.getAttribute('pointer-events') ?? element.getAttribute('style') ?? '').toLowerCase()
    ));
    const hasStrokePointerEvents = pointerEvents.some((value) => (
      value === 'stroke' || /pointer-events\s*:\s*stroke(?:\s*[;}]|\s*$)/.test(value)
    ));
    const hasAllPointerEvents = pointerEvents.some((value) => (
      value === 'all' || /pointer-events\s*:\s*all(?:\s*[;}]|\s*$)/.test(value)
    ));
    const hasUnsafeCenter = descendants.some((element) => (
      /align-items\s*:\s*unsafe\s+center(?:\s*[;}]|\s*$)/i.test(element.getAttribute('style') ?? '')
    ));
    const hasTransformOrigin = descendants.some((element) => (
      Array.from(element.attributes).some((attribute) => attribute.name.toLowerCase() === 'transformorigin')
    ));
    const matchesConfluenceFallback = isConfluence
      && clonedSvg.querySelectorAll('foreignObject').length >= 2
      && hasStrokePointerEvents
      && hasAllPointerEvents
      && hasUnsafeCenter
      && hasTransformOrigin;
    // 读不到源码的 Mermaid 图与 draw.io 一样栅格化为 PNG；节点数门槛排除工具栏图标
    const isMermaid = !hasExplicitMarker
      && descendants.length >= 10
      && (/^mermaid/i.test(clonedSvg.id)
        || (mermaidRole.test(clonedSvg.getAttribute('aria-roledescription') ?? '')
          && Boolean(liveSvg.closest('[class*="mermaid" i]'))));

    const detected = hasExplicitMarker || matchesConfluenceFallback || isMermaid;
    if (!detected) {
      conversions.push(Object.freeze({
        alt: '',
        clonedSvg,
        detected: false,
        mermaid: false,
        height: 0,
        serializedSvg: '',
        valid: false,
        width: 0,
      }));
      continue;
    }

    try {
      const bounds = liveSvg.getBoundingClientRect();
      const width = Math.ceil(bounds.width);
      const height = Math.ceil(bounds.height);
      if (
        !Number.isFinite(width)
        || !Number.isFinite(height)
        || width <= 0
        || height <= 0
        || width > maximumDimension
        || height > maximumDimension
        || width * height > maximumPixels
      ) {
        throw new Error('draw.io diagram dimensions are invalid.');
      }

      conversions.push(Object.freeze({
        alt: clonedSvg.getAttribute('aria-label')
          || clonedSvg.querySelector('title')?.textContent?.trim()
          || (isMermaid ? 'mermaid diagram' : 'draw.io diagram'),
        clonedSvg,
        detected: true,
        mermaid: isMermaid,
        height,
        serializedSvg: new XMLSerializer().serializeToString(clonedSvg),
        valid: true,
        width,
      }));
    } catch {
      conversions.push(Object.freeze({
        alt: '',
        clonedSvg,
        detected: true,
        mermaid: isMermaid,
        height: 0,
        serializedSvg: '',
        valid: false,
        width: 0,
      }));
    }
  }

  for (const conversion of conversions) {
    if (!conversion.detected) continue;
    if (!conversion.valid) {
      conversion.clonedSvg.remove();
      continue;
    }

    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('draw.io diagram could not be loaded.'));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(conversion.serializedSvg)}`;
      });

      const canvas = document.createElement('canvas');
      canvas.width = conversion.width;
      canvas.height = conversion.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D rendering is unavailable.');
      context.drawImage(image, 0, 0, conversion.width, conversion.height);
      const png = canvas.toDataURL('image/png');
      const replacement = document.createElement('img');
      replacement.src = png;
      replacement.alt = conversion.alt;
      replacement.width = conversion.width;
      replacement.height = conversion.height;
      if (conversion.mermaid) replacement.setAttribute('data-clipper-diagram', 'mermaid');
      conversion.clonedSvg.replaceWith(replacement);
      generatedImages.push({ element: replacement, dataUrlLength: png.length });
    } catch {
      conversion.clonedSvg.remove();
    }
  }

  const jsonWireBytes = (value: string): number => {
    let wireBytes = 2;
    for (let index = 0; index < value.length && wireBytes <= maximumBytes; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit === 0x22 || codeUnit === 0x5c) wireBytes += 2;
      else if (codeUnit <= 0x1f) wireBytes += 6;
      else if (codeUnit <= 0x7f) wireBytes += 1;
      else if (codeUnit <= 0x7ff) wireBytes += 2;
      else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const following = value.charCodeAt(index + 1);
        if (following >= 0xdc00 && following <= 0xdfff) {
          wireBytes += 4;
          index += 1;
        } else wireBytes += 6;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) wireBytes += 6;
      else wireBytes += 3;
    }
    return wireBytes;
  };

  let html = clonedRoot.outerHTML;
  let wireBytes = jsonWireBytes(html);
  if (wireBytes > maximumBytes) {
    generatedImages.sort((left, right) => right.dataUrlLength - left.dataUrlLength);
    for (const generatedImage of generatedImages) {
      generatedImage.element.remove();
      html = clonedRoot.outerHTML;
      wireBytes = jsonWireBytes(html);
      if (wireBytes <= maximumBytes) break;
    }
  }
  if (wireBytes > maximumBytes) {
    const error = new Error('Page snapshot exceeds the 8 MiB JSON wire limit.') as Error & { code: string };
    error.name = 'SnapshotTooLargeError';
    error.code = 'SNAPSHOT_TOO_LARGE';
    throw error;
  }
  return {
    pageUrl,
    html,
  };
}

/**
 * This function is passed directly to scripting.executeScript. Keep every
 * runtime dependency inside the function body so Chrome can serialize it.
 */
export function selectPageRegion(
  selectionId: string,
  diagramSources: DiagramSource[] = [],
): Promise<SelectedPageRegion> {
  // The literal is intentionally duplicated in cancelPageRegionSelection so
  // both injected functions remain completely self-contained.
  const cancelEventName = 'web-to-obsidian:cancel-region-selection';
  const ownershipAttribute = 'data-web-to-obsidian-region-selector-owner';
  const ownershipValue = selectionId;
  const minimumWidth = 80;
  const minimumHeight = 40;

  const previousIds = new Set(Array.from(
    document.querySelectorAll(`[${ownershipAttribute}]`),
    (element) => element.getAttribute(ownershipAttribute),
  ).filter((value): value is string => Boolean(value)));
  previousIds.forEach((previousId) => {
    document.dispatchEvent(new CustomEvent(cancelEventName, { detail: previousId }));
  });

  return new Promise<SelectedPageRegion>((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.setAttribute(ownershipAttribute, ownershipValue);
    overlay.style.setProperty('position', 'fixed', 'important');
    overlay.style.setProperty('display', 'none', 'important');
    overlay.style.setProperty('pointer-events', 'none', 'important');
    overlay.style.setProperty('box-sizing', 'border-box', 'important');
    overlay.style.setProperty('border', '3px solid #7c3aed', 'important');
    overlay.style.setProperty(
      'background',
      'rgba(124, 58, 237, 0.12)',
      'important',
    );
    overlay.style.setProperty('z-index', '2147483647', 'important');

    let selected: Element | null = null;
    let settled = false;
    let processing = false;
    let cancelActiveImage: (() => void) | null = null;

    const cleanup = (): void => {
      cancelActiveImage?.();
      cancelActiveImage = null;
      window.removeEventListener('pointerdown', suppressGestureEvent, true);
      window.removeEventListener('pointerup', suppressGestureEvent, true);
      window.removeEventListener('mousedown', suppressGestureEvent, true);
      window.removeEventListener('mouseup', suppressGestureEvent, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', clearSelection, true);
      window.removeEventListener('resize', clearSelection, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener(cancelEventName, onCancel, true);
      overlay.remove();
    };

    const cancelError = (): Error & { code: string } => {
      const error = new Error('W2O_SELECTION_CANCELLED') as Error & {
        code: string;
      };
      error.name = 'SelectionCancelledError';
      error.code = 'SELECTION_CANCELLED';
      return error;
    };

    const settle = (
      outcome: 'resolve' | 'reject',
      value: SelectedPageRegion | unknown,
    ): void => {
      if (settled) return;
      settled = true;
      try {
        if (outcome === 'resolve') {
          resolve(value as SelectedPageRegion);
        } else {
          reject(value);
        }
      } finally {
        cleanup();
      }
    };

    const candidateFrom = (event: Event): Element | null => {
      const path = event.composedPath();
      const elements = path.filter(
        (item): item is Element => item instanceof Element,
      );

      if (elements.length === 0 && event.target instanceof Element) {
        let current: Element | null = event.target;
        while (current) {
          elements.push(current);
          current = current.parentElement;
        }
      }

      for (const element of elements) {
        const ownedAncestor = element.closest(`[${ownershipAttribute}]`);
        if (
          element === document.documentElement ||
          element === document.body ||
          ownedAncestor?.getAttribute(ownershipAttribute) === ownershipValue
        ) {
          continue;
        }

        const bounds = element.getBoundingClientRect();
        if (bounds.width >= minimumWidth && bounds.height >= minimumHeight) {
          return element;
        }
      }

      return null;
    };

    function clearSelection(): void {
      if (processing) return;
      selected = null;
      overlay.style.setProperty('display', 'none', 'important');
    }

    function onPointerMove(event: Event): void {
      if (processing) return;
      const candidate = candidateFrom(event);
      if (!candidate) {
        clearSelection();
        return;
      }

      selected = candidate;
      const bounds = candidate.getBoundingClientRect();
      overlay.style.setProperty('display', 'block', 'important');
      overlay.style.setProperty('left', `${bounds.left}px`, 'important');
      overlay.style.setProperty('top', `${bounds.top}px`, 'important');
      overlay.style.setProperty('width', `${bounds.width}px`, 'important');
      overlay.style.setProperty('height', `${bounds.height}px`, 'important');
    }

    async function onClick(event: Event): Promise<void> {
      suppressGestureEvent(event);
      if (settled || processing) return;
      const directCandidate = candidateFrom(event);
      let candidate = directCandidate;
      if (!candidate && selected?.isConnected) {
        const bounds = selected.getBoundingClientRect();
        if (bounds.width >= minimumWidth && bounds.height >= minimumHeight) {
          candidate = selected;
        }
      }
      if (!candidate) return;
      processing = true;
      selected = null;
      overlay.style.setProperty('display', 'none', 'important');
      const capturedPageUrl = window.location.href;

      try {
        const clonedNode = candidate.cloneNode(true);
        if (!(clonedNode instanceof Element)) {
          throw new Error('Selected region could not be serialized.');
        }
        let clone: Element = clonedNode;

        // Clone before the first await so later page mutations cannot alter
        // the selected subtree while diagram images are loading.
        const maximumBytes = 8 * 1024 * 1024;
        const maximumDimension = 8192;
        const maximumPixels = 16_777_216;
        const explicitAncestorSelector = '[data-macro-name="drawio" i], [data-macro-name="draw.io" i], .drawio-embedded-diagram';
        const explicitMarker = /draw\.?io|mxgraph|mxfile/i;
        const confluenceMarker = /confluence/i;
        const liveSvgs = candidate.matches('svg')
          ? [candidate, ...Array.from(candidate.querySelectorAll('svg'))]
          : Array.from(candidate.querySelectorAll('svg'));
        const clonedSvgs = clone.matches('svg')
          ? [clone, ...Array.from(clone.querySelectorAll('svg'))]
          : Array.from(clone.querySelectorAll('svg'));
        const generatedImages: Array<{ element: HTMLImageElement; dataUrlLength: number }> = [];
        let cloneRemoved = false;
        const mermaidRole = /^(?:flowchart|graph|sequence|class|state|er|gantt|pie|journey|gitGraph|mindmap|timeline|quadrant|requirement|c4|sankey|xychart|block|packet|architecture|kanban|radar|treemap)/i;
        // 源码按整页 <svg> 的位置收集，这里换算回选区内的 <svg>，并用 id 再核对一次
        const allLiveSvgs = Array.from(document.documentElement.querySelectorAll('svg'));
        const sourceByLiveSvg = new Map<Element, string>();
        for (const entry of Array.isArray(diagramSources) ? diagramSources : []) {
          const liveSvg = allLiveSvgs[entry?.svgIndex];
          if (!liveSvg || typeof entry.source !== 'string') continue;
          if (entry.svgId !== null && liveSvg.id !== entry.svgId) continue;
          sourceByLiveSvg.set(liveSvg, entry.source);
        }
        const mermaidBlock = (source: string): HTMLPreElement => {
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.className = 'language-mermaid';
          code.textContent = source;
          pre.append(code);
          pre.setAttribute('data-clipper-diagram', 'mermaid');
          return pre;
        };
        const confluenceMeta = Array.from(document.querySelectorAll('meta')).some((meta) => {
          const name = meta.getAttribute('name') ?? '';
          const content = meta.getAttribute('content') ?? '';
          return /^(?:ajs-product-name|application-name)$/i.test(name)
            && confluenceMarker.test(content);
        });
        const confluenceRoot = [document.documentElement, document.body].some((element) => {
          if (!element) return false;
          return confluenceMarker.test(`${element.id} ${element.className}`);
        });
        const isConfluence = confluenceMeta || confluenceRoot;

        const conversionRecords = clonedSvgs.map((clonedSvg, index) => {
          const liveSvg = liveSvgs[index];
          if (!clonedSvg || !liveSvg) return null;

          const diagramSource = sourceByLiveSvg.get(liveSvg);
          if (diagramSource !== undefined) {
            const block = mermaidBlock(diagramSource);
            if (clonedSvg === clone) clone = block;
            else clonedSvg.replaceWith(block);
            return null;
          }

          const attributeMarker = Array.from(clonedSvg.attributes).some((attribute) => {
            const name = attribute.name.toLowerCase();
            const authoritativeValue = name === 'id' || name === 'class' || name.startsWith('data-');
            return explicitMarker.test(attribute.name)
              || (authoritativeValue && explicitMarker.test(attribute.value));
          });
          const structuralMarker = Array.from(clonedSvg.querySelectorAll('*')).some((element) => (
            /^(?:draw\.?io|mxgraph|mxfile|mxgraphmodel)$/i.test(element.localName)
          ));
          const metadataMarker = Array.from(clonedSvg.querySelectorAll('metadata')).some((element) => (
            Array.from(element.attributes).some((attribute) => (
              explicitMarker.test(attribute.name) || explicitMarker.test(attribute.value)
            ))
          ));
          const hasExplicitMarker = Boolean(liveSvg.closest(explicitAncestorSelector))
            || Boolean(clonedSvg.closest(explicitAncestorSelector))
            || attributeMarker
            || structuralMarker
            || metadataMarker;

          const descendants = [clonedSvg, ...Array.from(clonedSvg.querySelectorAll('*'))];
          const pointerEvents = descendants.map((element) => (
            (element.getAttribute('pointer-events') ?? element.getAttribute('style') ?? '').toLowerCase()
          ));
          const hasStrokePointerEvents = pointerEvents.some((value) => (
            value === 'stroke' || /pointer-events\s*:\s*stroke(?:\s*[;}]|\s*$)/.test(value)
          ));
          const hasAllPointerEvents = pointerEvents.some((value) => (
            value === 'all' || /pointer-events\s*:\s*all(?:\s*[;}]|\s*$)/.test(value)
          ));
          const hasUnsafeCenter = descendants.some((element) => (
            /align-items\s*:\s*unsafe\s+center(?:\s*[;}]|\s*$)/i.test(element.getAttribute('style') ?? '')
          ));
          const hasTransformOrigin = descendants.some((element) => (
            Array.from(element.attributes).some((attribute) => attribute.name.toLowerCase() === 'transformorigin')
          ));
          const matchesConfluenceFallback = isConfluence
            && clonedSvg.querySelectorAll('foreignObject').length >= 2
            && hasStrokePointerEvents
            && hasAllPointerEvents
            && hasUnsafeCenter
            && hasTransformOrigin;
          const isMermaid = !hasExplicitMarker
            && descendants.length >= 10
            && (/^mermaid/i.test(clonedSvg.id)
              || (mermaidRole.test(clonedSvg.getAttribute('aria-roledescription') ?? '')
                && Boolean(liveSvg.closest('[class*="mermaid" i]'))));

          const detected = hasExplicitMarker || matchesConfluenceFallback || isMermaid;
          if (!detected) {
            return {
              clonedSvg,
              detected: false,
              mermaid: false,
              valid: false,
              width: 0,
              height: 0,
              serializedSvg: '',
              alt: '',
            };
          }

          try {
            const bounds = liveSvg.getBoundingClientRect();
            const width = Math.ceil(bounds.width);
            const height = Math.ceil(bounds.height);
            if (
              !Number.isFinite(width)
              || !Number.isFinite(height)
              || width <= 0
              || height <= 0
              || width > maximumDimension
              || height > maximumDimension
              || width * height > maximumPixels
            ) {
              throw new Error('draw.io diagram dimensions are invalid.');
            }
            const serializedSvg = new XMLSerializer().serializeToString(clonedSvg);
            const alt = clonedSvg.getAttribute('aria-label')
              || clonedSvg.querySelector('title')?.textContent?.trim()
              || (isMermaid ? 'mermaid diagram' : 'draw.io diagram');
            return {
              clonedSvg,
              detected: true,
              mermaid: isMermaid,
              valid: true,
              width,
              height,
              serializedSvg,
              alt,
            };
          } catch {
            return {
              clonedSvg,
              detected: true,
              mermaid: isMermaid,
              valid: false,
              width: 0,
              height: 0,
              serializedSvg: '',
              alt: '',
            };
          }
        });

        for (const record of conversionRecords) {
          if (settled) return;
          if (!record?.detected) continue;
          const { clonedSvg } = record;
          if (!record.valid) {
            if (clonedSvg === clone) cloneRemoved = true;
            else clonedSvg.remove();
            continue;
          }

          try {
            const image = new Image();
            await new Promise<void>((resolveImage, rejectImage) => {
              let completed = false;
              const finish = (error?: Error): void => {
                if (completed) return;
                completed = true;
                image.onload = null;
                image.onerror = null;
                if (cancelActiveImage === cancelImage) cancelActiveImage = null;
                if (error) rejectImage(error);
                else resolveImage();
              };
              const cancelImage = (): void => {
                finish(new Error('draw.io diagram loading was cancelled.'));
              };
              cancelActiveImage = cancelImage;
              image.onload = () => finish();
              image.onerror = () => finish(new Error('draw.io diagram could not be loaded.'));
              try {
                image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(record.serializedSvg)}`;
              } catch (error) {
                finish(error instanceof Error ? error : new Error(String(error)));
              }
            });
            if (settled) return;

            const canvas = document.createElement('canvas');
            canvas.width = record.width;
            canvas.height = record.height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas 2D rendering is unavailable.');
            context.drawImage(image, 0, 0, record.width, record.height);
            const png = canvas.toDataURL('image/png');
            const replacement = document.createElement('img');
            replacement.src = png;
            replacement.alt = record.alt;
            replacement.width = record.width;
            replacement.height = record.height;
            if (record.mermaid) replacement.setAttribute('data-clipper-diagram', 'mermaid');
            if (clonedSvg === clone) clone = replacement;
            else clonedSvg.replaceWith(replacement);
            generatedImages.push({ element: replacement, dataUrlLength: png.length });
          } catch {
            if (settled) return;
            if (clonedSvg === clone) cloneRemoved = true;
            else clonedSvg.remove();
          }
        }

        if (settled) return;

        const jsonWireBytes = (value: string): number => {
          let bytes = 2;
          for (let index = 0; index < value.length && bytes <= maximumBytes; index += 1) {
            const codeUnit = value.charCodeAt(index);
            if (codeUnit === 0x22 || codeUnit === 0x5c) bytes += 2;
            else if (codeUnit <= 0x1f) bytes += 6;
            else if (codeUnit <= 0x7f) bytes += 1;
            else if (codeUnit <= 0x7ff) bytes += 2;
            else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
              const following = value.charCodeAt(index + 1);
              if (following >= 0xdc00 && following <= 0xdfff) {
                bytes += 4;
                index += 1;
              } else bytes += 6;
            } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) bytes += 6;
            else bytes += 3;
          }
          return bytes;
        };

        let html = cloneRemoved ? '' : clone.outerHTML;
        let wireBytes = jsonWireBytes(html);
        if (wireBytes > maximumBytes) {
          generatedImages.sort((left, right) => right.dataUrlLength - left.dataUrlLength);
          for (const generatedImage of generatedImages) {
            if (generatedImage.element === clone) cloneRemoved = true;
            else generatedImage.element.remove();
            html = cloneRemoved ? '' : clone.outerHTML;
            wireBytes = jsonWireBytes(html);
            if (wireBytes <= maximumBytes) break;
          }
        }
        if (wireBytes > maximumBytes) {
          const error = new Error('Selected region exceeds the 8 MiB JSON wire limit.') as Error & { code: string };
          error.name = 'SnapshotTooLargeError';
          error.code = 'SNAPSHOT_TOO_LARGE';
          throw error;
        }
        settle('resolve', {
          selectionId: ownershipValue,
          pageUrl: capturedPageUrl,
          html,
        });
      } catch (error) {
        settle('reject', error);
      }
    }

    function suppressGestureEvent(event: Event): void {
      event.preventDefault();
      // A window capture listener stops the selection gesture from reaching
      // later page listeners. It cannot undo a handler that ran before this
      // injected listener was registered or was ordered ahead of it.
      event.stopImmediatePropagation();
    }

    function onKeyDown(event: Event): void {
      if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      settle('reject', cancelError());
    }

    function onCancel(event: Event): void {
      if (!(event instanceof CustomEvent) || event.detail !== ownershipValue) return;
      settle('reject', cancelError());
    }

    try {
      (document.body ?? document.documentElement).appendChild(overlay);
      window.addEventListener('pointerdown', suppressGestureEvent, true);
      window.addEventListener('pointerup', suppressGestureEvent, true);
      window.addEventListener('mousedown', suppressGestureEvent, true);
      window.addEventListener('mouseup', suppressGestureEvent, true);
      window.addEventListener('click', onClick, true);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('scroll', clearSelection, {
        capture: true,
        passive: true,
      });
      window.addEventListener('resize', clearSelection, true);
      document.addEventListener('pointermove', onPointerMove, true);
      document.addEventListener(cancelEventName, onCancel, true);
    } catch (error) {
      settle('reject', error);
    }
  });
}

/**
 * This function is injected separately from selectPageRegion. The stable
 * literal is repeated because closing over a module constant would break when
 * Chrome serializes this function.
 */
export function cancelPageRegionSelection(selectionId?: string): void {
  if (!selectionId) return;
  document.dispatchEvent(
    new CustomEvent('web-to-obsidian:cancel-region-selection', { detail: selectionId }),
  );
}
