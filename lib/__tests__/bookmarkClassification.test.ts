import { describe, it, expect } from 'vitest';
import {
  KEEP_IN_PLACE_FOLDER_ID,
  chunkItems,
  normalizeClassifications,
  planClassificationMoves,
  toClassificationFolders,
} from '@/lib/bookmarkClassification';
import { fillTemplate } from '@/lib/ai/template';

const folders = [
  { id: '1', path: 'Bookmarks Bar' },
  { id: '10', path: 'Bookmarks Bar/Dev' },
  { id: '11', path: 'Bookmarks Bar/Dev/Frontend' },
];

const bookmarks = [
  { id: 'a', title: 'React', url: 'https://react.dev', parentId: '1' },
  { id: 'b', title: 'Vue', url: 'https://vuejs.org', parentId: '11' },
  { id: 'c', title: 'News', url: 'https://news.example', parentId: '1' },
];

describe('toClassificationFolders', () => {
  it('flattens trees, skips the virtual all node and removes duplicates', () => {
    const result = toClassificationFolders([
      { id: 'all', title: 'All Bookmarks', path: 'All Bookmarks' },
      { id: '1', title: 'Bar', children: [{ id: '10', title: 'Dev', path: 'Bar/Dev' }] },
      { id: '10', title: 'Dev', path: 'Bar/Dev' },
    ]);

    expect(result).toEqual([
      { id: '1', path: 'Bar' },
      { id: '10', path: 'Bar/Dev' },
    ]);
  });
});

describe('chunkItems', () => {
  it('splits into fixed-size chunks and keeps the remainder', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkItems([], 3)).toEqual([]);
  });
});

describe('normalizeClassifications', () => {
  it('drops unknown bookmark ids and keeps the first entry per bookmark', () => {
    const result = normalizeClassifications([
      { bookmarkId: 'zzz', suggestedFolderId: '10', confidence: 0.9 },
      { bookmarkId: 'a', suggestedFolderId: '11', confidence: 0.8 },
      { bookmarkId: 'a', suggestedFolderId: '10', confidence: 0.9 },
    ], bookmarks, folders);

    expect(result).toEqual([
      { bookmarkId: 'a', suggestedFolderId: '11', confidence: 0.8, reason: undefined },
    ]);
  });

  it('maps an invented folder id to keep-in-place instead of passing it through', () => {
    const [result] = normalizeClassifications([
      { bookmarkId: 'c', suggestedFolderId: '999', confidence: 0.7 },
    ], bookmarks, folders);

    expect(result.suggestedFolderId).toBe(KEEP_IN_PLACE_FOLDER_ID);
  });

  it('resolves a folder path or a bracketed id returned instead of a plain id', () => {
    const result = normalizeClassifications([
      { bookmarkId: 'a', suggestedFolderId: 'Bookmarks Bar > Dev > Frontend', confidence: 0.6 },
      { bookmarkId: 'c', suggestedFolderId: '[10]', confidence: 0.6 },
    ], bookmarks, folders);

    expect(result.map((item) => item.suggestedFolderId)).toEqual(['11', '10']);
  });

  it('removes bookmarks that are already in the suggested folder', () => {
    const result = normalizeClassifications([
      { bookmarkId: 'b', suggestedFolderId: '11', confidence: 0.95 },
    ], bookmarks, folders);

    expect(result).toEqual([]);
  });

  it('clamps confidence and returns results in input order', () => {
    const result = normalizeClassifications([
      { bookmarkId: 'c', suggestedFolderId: '10', confidence: 3 },
      { bookmarkId: 'a', suggestedFolderId: '11', confidence: 'abc', reason: '  frontend  ' },
    ], bookmarks, folders);

    expect(result).toEqual([
      { bookmarkId: 'a', suggestedFolderId: '11', confidence: 0, reason: 'frontend' },
      { bookmarkId: 'c', suggestedFolderId: '10', confidence: 1, reason: undefined },
    ]);
  });

  it('returns an empty list when the model output is not an array', () => {
    expect(normalizeClassifications({ foo: 1 }, bookmarks, folders)).toEqual([]);
  });
});

describe('planClassificationMoves', () => {
  it('skips keep-in-place, unknown folders, unchanged parents and duplicates', () => {
    const moves = planClassificationMoves([
      { bookmarkId: 'a', suggestedFolderId: '10' },
      { bookmarkId: 'a', suggestedFolderId: '11' },
      { bookmarkId: 'b', suggestedFolderId: '11' },
      { bookmarkId: 'c', suggestedFolderId: KEEP_IN_PLACE_FOLDER_ID },
      { bookmarkId: 'd', suggestedFolderId: 'all' },
    ], folders, new Map([
      ['a', '1'],
      ['b', '11'],
      ['c', '1'],
      ['d', '1'],
    ]));

    expect(moves).toEqual([{ bookmarkId: 'a', folderId: '10' }]);
  });
});

describe('fillTemplate', () => {
  it('inserts values literally, even when they contain replacement patterns', () => {
    expect(fillTemplate('Title: {title}', { title: "a$&b$'c" })).toBe("Title: a$&b$'c");
  });

  it('does not substitute placeholders that appear inside inserted values', () => {
    expect(fillTemplate('{url} | {title}', { url: 'https://x.dev/{title}', title: 'T' }))
      .toBe('https://x.dev/{title} | T');
  });

  it('keeps unknown placeholders and JSON examples untouched', () => {
    expect(fillTemplate('{"newTitle": "x"} {missing}', {})).toBe('{"newTitle": "x"} {missing}');
  });
});
