export interface PageSnapshot {
  pageUrl: string;
  html: string;
}

export interface SelectedPageRegion {
  selectionId: string;
  pageUrl: string;
  html: string;
}

/**
 * This function is passed directly to scripting.executeScript. Keep every
 * runtime dependency inside the function body so Chrome can serialize it.
 */
export async function snapshotPage(): Promise<PageSnapshot> {
  const maximumBytes = 8 * 1024 * 1024;
  const maximumDimension = 8192;
  const maximumPixels = 16_777_216;
  const pageUrl = window.location.href;
  const clonedRoot = document.documentElement.cloneNode(true) as HTMLElement;
  const liveSvgs = Array.from(document.documentElement.querySelectorAll('svg'));
  const clonedSvgs = Array.from(clonedRoot.querySelectorAll('svg'));
  const generatedImages: Array<{ element: HTMLImageElement; dataUrlLength: number }> = [];
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

    const detected = hasExplicitMarker || matchesConfluenceFallback;
    if (!detected) {
      conversions.push(Object.freeze({
        alt: '',
        clonedSvg,
        detected: false,
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
          || 'draw.io diagram',
        clonedSvg,
        detected: true,
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
export function selectPageRegion(selectionId: string): Promise<SelectedPageRegion> {
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

          const detected = hasExplicitMarker || matchesConfluenceFallback;
          if (!detected) {
            return {
              clonedSvg,
              detected: false,
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
              || 'draw.io diagram';
            return {
              clonedSvg,
              detected: true,
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
