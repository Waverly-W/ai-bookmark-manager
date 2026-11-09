import { browser } from 'wxt/browser';

import {
  cancelPageRegionSelection,
  collectDiagramSources,
  selectPageRegion,
  snapshotPage,
  type DiagramSource,
  type PageSnapshot,
  type SelectedPageRegion,
} from './injected';

export type ScriptingLike = Pick<typeof browser.scripting, 'executeScript'>;

export interface BrowserLike {
  scripting: ScriptingLike;
}

export type TabInjectionErrorCode =
  | 'INVALID_TAB_ID'
  | 'INJECTION_FAILED'
  | 'EMPTY_INJECTION_RESULT'
  | 'SELECTION_CANCELLED'
  | 'SNAPSHOT_TOO_LARGE'
  | 'SELECTION_ID_MISMATCH';

export class TabInjectionError extends Error {
  constructor(
    readonly code: TabInjectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TabInjectionError';
  }
}

const defaultBrowser: BrowserLike = browser;

function validateTabId(tabId: number): void {
  if (!Number.isSafeInteger(tabId) || tabId <= 0) {
    throw new TabInjectionError(
      'INVALID_TAB_ID',
      'A positive integer tab ID is required.',
    );
  }
}

function isSelectionCancellation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === 'SELECTION_CANCELLED' ||
    (typeof candidate.message === 'string' &&
      candidate.message.includes('W2O_SELECTION_CANCELLED'))
  );
}

function isSnapshotTooLarge(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'SNAPSHOT_TOO_LARGE'
    || (typeof candidate.message === 'string' && candidate.message.includes('exceeds the 8 MiB'));
}

async function inject<TArgs extends unknown[], T>(
  tabId: number,
  func: (...args: TArgs) => T,
  args: TArgs,
  browserLike: BrowserLike,
): Promise<Awaited<T> | undefined> {
  validateTabId(tabId);

  let results: Array<{ result?: Awaited<T> }>;
  try {
    results = await browserLike.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
  } catch (error) {
    if (isSnapshotTooLarge(error)) {
      throw new TabInjectionError(
        'SNAPSHOT_TOO_LARGE',
        'The page snapshot exceeds the 8 MiB limit.',
      );
    }
    if (isSelectionCancellation(error)) {
      throw new TabInjectionError(
        'SELECTION_CANCELLED',
        'Region selection was cancelled.',
      );
    }
    throw new TabInjectionError(
      'INJECTION_FAILED',
      'Unable to run the requested action in this tab.',
    );
  }

  if (results.length === 0 || !results[0]) {
    throw new TabInjectionError(
      'EMPTY_INJECTION_RESULT',
      'The tab did not return a result for the requested action.',
    );
  }

  return results[0].result;
}

const MAX_DIAGRAM_SOURCES = 200;
const MAX_DIAGRAM_SOURCE_LENGTH = 100_000;

/**
 * 只保留结构正确的条目：结果来自页面主环境，页面脚本可以篡改，不能直接信任。
 */
export function sanitizeDiagramSources(value: unknown): DiagramSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const sources: DiagramSource[] = [];
  for (const entry of value.slice(0, MAX_DIAGRAM_SOURCES)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { svgIndex, svgId, source } = entry as Record<string, unknown>;
    if (!Number.isSafeInteger(svgIndex) || (svgIndex as number) < 0 || seen.has(svgIndex as number)) continue;
    if (svgId !== null && typeof svgId !== 'string') continue;
    if (typeof source !== 'string' || !source.trim() || source.length > MAX_DIAGRAM_SOURCE_LENGTH) continue;
    seen.add(svgIndex as number);
    sources.push({ svgIndex: svgIndex as number, svgId: svgId as string | null, source });
  }
  return sources;
}

/**
 * 在页面主环境读取 Mermaid 等图表的源码。浏览器不支持 world: 'MAIN'（例如较旧的 Firefox）
 * 或页面不是受支持的编辑器时返回空数组，快照阶段会退回到把图表栅格化为图片。
 */
export async function collectDiagramSourcesInTab(
  tabId: number,
  browserLike: BrowserLike = defaultBrowser,
): Promise<DiagramSource[]> {
  validateTabId(tabId);
  try {
    // @types/webextension-polyfill 只声明了 'ISOLATED'，Chrome 102+ 与 Firefox 128+ 都支持 'MAIN'
    const injection = {
      target: { tabId },
      func: collectDiagramSources,
      world: 'MAIN',
    } as unknown as Parameters<ScriptingLike['executeScript']>[0];
    const results = await browserLike.scripting.executeScript(injection);
    return sanitizeDiagramSources(results?.[0]?.result);
  } catch {
    return [];
  }
}

export async function snapshotTab(
  tabId: number,
  browserLike: BrowserLike = defaultBrowser,
): Promise<PageSnapshot> {
  const diagramSources = await collectDiagramSourcesInTab(tabId, browserLike);
  const result = await inject(tabId, snapshotPage, [diagramSources], browserLike);
  if (result === undefined) {
    throw new TabInjectionError(
      'EMPTY_INJECTION_RESULT',
      'The tab did not return a result for the requested action.',
    );
  }
  return result;
}

export async function selectRegionInTab(
  tabId: number,
  selectionId: string,
  browserLike: BrowserLike = defaultBrowser,
): Promise<SelectedPageRegion> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(selectionId)) {
    throw new TabInjectionError('SELECTION_ID_MISMATCH', 'Region selection ID is invalid.');
  }
  const diagramSources = await collectDiagramSourcesInTab(tabId, browserLike);
  const result = await inject(tabId, selectPageRegion, [selectionId, diagramSources], browserLike);
  if (result === undefined) {
    throw new TabInjectionError(
      'EMPTY_INJECTION_RESULT',
      'The tab did not return a result for the requested action.',
    );
  }
  if (result.selectionId !== selectionId) {
    throw new TabInjectionError('SELECTION_ID_MISMATCH', 'Region selection returned a mismatched ID.');
  }
  return result;
}

export async function cancelRegionSelectionInTab(
  tabId: number,
  selectionId: string,
  browserLike: BrowserLike = defaultBrowser,
): Promise<void> {
  await inject(tabId, cancelPageRegionSelection, [selectionId], browserLike);
}
