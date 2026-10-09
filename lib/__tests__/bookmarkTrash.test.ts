import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Node {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  children?: Node[];
}

let tree: Node;
let nextId: number;
let tags: Record<string, string[]>;

const walk = (node: Node, visit: (n: Node) => void) => {
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
};
const find = (id: string): Node | undefined => {
  let found: Node | undefined;
  walk(tree, (n) => { if (n.id === id) found = n; });
  return found;
};
const reindex = (node: Node) => node.children?.forEach((child, i) => { child.index = i; child.parentId = node.id; });

vi.mock('wxt/browser', () => ({
  browser: {
    bookmarks: {
      getSubTree: vi.fn(async (id: string) => {
        const node = find(id);
        if (!node) throw new Error('not found');
        return [structuredClone(node)];
      }),
      get: vi.fn(async (id: string) => {
        const node = find(id);
        if (!node) throw new Error('not found');
        return [structuredClone(node)];
      }),
      getChildren: vi.fn(async (id: string) => structuredClone(find(id)?.children ?? [])),
      getTree: vi.fn(async () => [structuredClone(tree)]),
      remove: vi.fn(async (id: string) => {
        const node = find(id)!;
        if (node.children?.length) throw new Error("Can't remove non-empty folder");
        const parent = find(node.parentId!)!;
        parent.children = parent.children!.filter((c) => c.id !== id);
        reindex(parent);
      }),
      removeTree: vi.fn(async (id: string) => {
        const node = find(id)!;
        const parent = find(node.parentId!)!;
        parent.children = parent.children!.filter((c) => c.id !== id);
        reindex(parent);
      }),
      create: vi.fn(async ({ parentId, title, url, index }: { parentId: string; title: string; url?: string; index?: number }) => {
        const parent = find(parentId);
        if (!parent) throw new Error('bad parent');
        const node: Node = { id: String(nextId++), title, ...(url ? { url } : { children: [] }) };
        const at = index ?? parent.children!.length;
        parent.children!.splice(at, 0, node);
        reindex(parent);
        return structuredClone(node);
      }),
    },
  },
}));

vi.mock('../tagStorage', () => ({
  getTagsMapForBookmarks: vi.fn(async (ids: string[]) => Object.fromEntries(ids.filter((id) => tags[id]).map((id) => [id, tags[id]]))),
  removeTagsForBookmarks: vi.fn(async (ids: string[]) => { ids.forEach((id) => delete tags[id]); }),
  saveTagsForBookmarks: vi.fn(async (map: Record<string, string[]>) => { Object.assign(tags, map); }),
}));

import { deleteBookmarkWithSnapshot, restoreBookmarkSnapshot } from '../bookmarkTrash';

beforeEach(() => {
  nextId = 100;
  tags = { '11': ['react', 'docs'], '13': ['vue'] };
  tree = {
    id: '0', title: '', children: [
      { id: '1', title: 'Bar', children: [
        { id: '10', title: 'First', url: 'https://a.example' },
        { id: '11', title: 'Second', url: 'https://b.example' },
        { id: '12', title: 'Folder', children: [
          { id: '13', title: 'Inner', url: 'https://c.example' },
          { id: '14', title: 'Sub', children: [{ id: '15', title: 'Deep', url: 'https://d.example' }] },
        ] },
      ] },
      { id: '2', title: 'Other', children: [] },
    ],
  };
  reindex(tree); reindex(find('1')!); reindex(find('12')!); reindex(find('14')!);
});

describe('bookmark trash', () => {
  it('restores a deleted bookmark at its original position with its tags', async () => {
    const snapshot = await deleteBookmarkWithSnapshot('11');

    expect(find('1')!.children!.map((c) => c.title)).toEqual(['First', 'Folder']);
    expect(tags['11']).toBeUndefined();

    const newId = await restoreBookmarkSnapshot(snapshot);

    expect(find('1')!.children!.map((c) => c.title)).toEqual(['First', 'Second', 'Folder']);
    expect(find(newId)).toMatchObject({ title: 'Second', url: 'https://b.example' });
    expect(tags[newId]).toEqual(['react', 'docs']);
  });

  it('deletes a non-empty folder as a tree and restores its whole subtree', async () => {
    const snapshot = await deleteBookmarkWithSnapshot('12');

    expect(find('12')).toBeUndefined();
    expect(Object.keys(tags)).toEqual(['11']);

    const newId = await restoreBookmarkSnapshot(snapshot);
    const restored = find(newId)!;

    expect(restored.title).toBe('Folder');
    expect(restored.children!.map((c) => c.title)).toEqual(['Inner', 'Sub']);
    expect(restored.children![1].children![0]).toMatchObject({ title: 'Deep', url: 'https://d.example' });
    const inner = restored.children![0];
    expect(tags[inner.id]).toEqual(['vue']);
  });

  it('falls back to Other Bookmarks when the original parent was deleted', async () => {
    const snapshot = await deleteBookmarkWithSnapshot('13');
    await deleteBookmarkWithSnapshot('12');

    const newId = await restoreBookmarkSnapshot(snapshot);

    expect(find('2')!.children!.map((c) => c.id)).toEqual([newId]);
  });

  it('clamps the original index when siblings were removed in the meantime', async () => {
    const snapshot = await deleteBookmarkWithSnapshot('12');
    await deleteBookmarkWithSnapshot('10');
    await deleteBookmarkWithSnapshot('11');

    const newId = await restoreBookmarkSnapshot(snapshot);

    expect(find('1')!.children!.map((c) => c.id)).toEqual([newId]);
  });

  it('refuses to delete the bookmark tree root', async () => {
    await expect(deleteBookmarkWithSnapshot('0')).rejects.toThrow('root');
    expect(find('1')).toBeDefined();
  });
});
