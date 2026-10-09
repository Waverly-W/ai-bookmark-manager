import { browser } from 'wxt/browser';
import { getTagsMapForBookmarks, removeTagsForBookmarks, saveTagsForBookmarks } from './tagStorage';

export interface BookmarkSnapshotNode {
    title: string;
    url?: string;
    /** 仅书签（有 url）才有标签 */
    tags: string[];
    children?: BookmarkSnapshotNode[];
}

export interface BookmarkSnapshot {
    parentId: string;
    index: number;
    node: BookmarkSnapshotNode;
}

type BrowserBookmarkNode = {
    id: string;
    parentId?: string;
    index?: number;
    title: string;
    url?: string;
    children?: BrowserBookmarkNode[];
};

const collectBookmarkIds = (node: BrowserBookmarkNode): string[] => {
    if (node.url) return [node.id];
    return (node.children ?? []).flatMap(collectBookmarkIds);
};

const toSnapshotNode = (node: BrowserBookmarkNode, tagsMap: Record<string, string[]>): BookmarkSnapshotNode => {
    if (node.url) {
        return { title: node.title, url: node.url, tags: tagsMap[node.id] ?? [] };
    }
    return {
        title: node.title,
        tags: [],
        children: (node.children ?? []).map((child) => toSnapshotNode(child, tagsMap))
    };
};

/**
 * 删除书签或文件夹（含全部子项与标签），并返回可用于撤销的快照。
 * 文件夹使用 removeTree：浏览器的 bookmarks.remove 无法删除非空文件夹。
 */
export const deleteBookmarkWithSnapshot = async (id: string): Promise<BookmarkSnapshot> => {
    const [subTree] = await browser.bookmarks.getSubTree(id) as BrowserBookmarkNode[];
    if (!subTree?.parentId) {
        throw new Error('Cannot delete a root bookmark folder');
    }

    const bookmarkIds = collectBookmarkIds(subTree);
    const tagsMap = bookmarkIds.length > 0 ? await getTagsMapForBookmarks(bookmarkIds) : {};
    const snapshot: BookmarkSnapshot = {
        parentId: subTree.parentId,
        index: subTree.index ?? 0,
        node: toSnapshotNode(subTree, tagsMap)
    };

    if (subTree.url) {
        await browser.bookmarks.remove(id);
    } else {
        await browser.bookmarks.removeTree(id);
    }
    if (bookmarkIds.length > 0) {
        await removeTagsForBookmarks(bookmarkIds);
    }

    return snapshot;
};

// 原父文件夹可能已被删除：退回到「其他书签」，再退回到第一个根文件夹
const resolveParentId = async (parentId: string): Promise<string> => {
    try {
        const [parent] = await browser.bookmarks.get(parentId);
        if (parent && !parent.url) return parent.id;
    } catch {
        // 继续使用兜底文件夹
    }

    const [root] = await browser.bookmarks.getTree();
    const roots = root?.children ?? [];
    const fallback = roots.find((node) => node.id === '2') ?? roots[0];
    if (!fallback) throw new Error('No bookmark folder available to restore into');
    return fallback.id;
};

/**
 * 按快照重建被删除的书签/文件夹（含子项与标签），返回新节点的 id。
 * 书签 id 会变化，标签按新 id 重新写入。
 */
export const restoreBookmarkSnapshot = async (snapshot: BookmarkSnapshot): Promise<string> => {
    const parentId = await resolveParentId(snapshot.parentId);
    const siblings = await browser.bookmarks.getChildren(parentId);
    const restoredTags: Record<string, string[]> = {};

    const create = async (node: BookmarkSnapshotNode, targetParentId: string, index?: number): Promise<string> => {
        const created = await browser.bookmarks.create({
            parentId: targetParentId,
            title: node.title,
            ...(index === undefined ? {} : { index }),
            ...(node.url ? { url: node.url } : {})
        });

        if (node.url) {
            if (node.tags.length > 0) restoredTags[created.id] = node.tags;
        } else {
            for (const child of node.children ?? []) {
                await create(child, created.id);
            }
        }
        return created.id;
    };

    const restoredId = await create(snapshot.node, parentId, Math.min(snapshot.index, siblings.length));
    if (Object.keys(restoredTags).length > 0) {
        await saveTagsForBookmarks(restoredTags);
    }
    return restoredId;
};
