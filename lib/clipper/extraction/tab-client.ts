import { browser } from 'wxt/browser';

import {
  cancelPageRegionSelection,
  selectPageRegion,
  snapshotPage,
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

export async function snapshotTab(
  tabId: number,
  browserLike: BrowserLike = defaultBrowser,
): Promise<PageSnapshot> {
  const result = await inject(tabId, snapshotPage, [], browserLike);
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
  const result = await inject(tabId, selectPageRegion, [selectionId], browserLike);
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
