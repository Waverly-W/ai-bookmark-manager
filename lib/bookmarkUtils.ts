import { browser } from 'wxt/browser';

export interface BookmarkFolder {
    id: string;
    title: string;
    parentId?: string;
    path: string; // 显示用的路径，如 "书签栏/开发工具"
    children?: BookmarkFolder[]; // 子文件夹
    level: number; // 层级深度
}

/**
 * 递归构建文件夹树结构
 */
function buildFolderTree(nodes: any[], level = 0): BookmarkFolder[] {
    const folders: BookmarkFolder[] = [];

    for (const node of nodes) {
        if (!node.url && node.children) { // 是文件夹
            const folder: BookmarkFolder = {
                id: node.id,
                title: node.title,
                parentId: node.parentId,
                path: node.title,
                level: level,
                children: buildFolderTree(node.children, level + 1)
            };

            folders.push(folder);
        }
    }

    return folders;
}

/**
 * 递归获取所有书签文件夹（平铺列表，用于过滤）
 */
function collectFolders(nodes: any[], parentPath = ''): BookmarkFolder[] {
    const folders: BookmarkFolder[] = [];

    for (const node of nodes) {
        if (!node.url && node.children) { // 是文件夹
            const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;

            folders.push({
                id: node.id,
                title: node.title,
                parentId: node.parentId,
                path: currentPath,
                level: 0
            });

            // 递归处理子文件夹
            const subFolders = collectFolders(node.children, currentPath);
            if (Array.isArray(subFolders)) {
                folders.push(...subFolders);
            }
        }
    }

    return folders;
}

/**
 * 获取书签文件夹树结构
 */
export async function getBookmarkFolderTree(): Promise<BookmarkFolder[]> {
    try {
        const bookmarkTree = await browser.bookmarks.getTree();
        const rootNodes = bookmarkTree[0]?.children || [];

        // 添加"全部书签"选项
        const allOption: BookmarkFolder = {
            id: 'all',
            title: 'All Bookmarks',
            path: 'All Bookmarks',
            level: 0,
            children: []
        };

        // 构建文件夹树
        const folderTree = buildFolderTree(rootNodes);

        if (Array.isArray(folderTree)) {
            return [allOption, ...folderTree];
        } else {
            return [allOption];
        }
    } catch (error) {
        console.error('Error getting bookmark folder tree:', error);
        return [
            {
                id: 'all',
                title: 'All Bookmarks',
                path: 'All Bookmarks',
                level: 0,
                children: []
            }
        ];
    }
}

/**
 * 获取所有书签文件夹列表（平铺，用于过滤）
 */
export async function getBookmarkFolders(): Promise<BookmarkFolder[]> {
    try {
        const bookmarkTree = await browser.bookmarks.getTree();
        const rootNodes = bookmarkTree[0]?.children || [];

        // 添加"全部书签"选项
        const allFolders: BookmarkFolder[] = [
            {
                id: 'all',
                title: 'All Bookmarks',
                path: 'All Bookmarks',
                level: 0
            }
        ];

        // 获取所有文件夹
        const folders = collectFolders(rootNodes);

        if (Array.isArray(allFolders) && Array.isArray(folders)) {
            return [...allFolders, ...folders];
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error getting bookmark folders:', error);
        return [
            {
                id: 'all',
                title: 'All Bookmarks',
                path: 'All Bookmarks',
                level: 0
            }
        ];
    }
}

/**
 * 根据根目录ID过滤书签树
 */
export function filterBookmarksByRoot(
    bookmarks: any[],
    rootFolderId: string
): any[] {
    if (rootFolderId === 'all') {
        return bookmarks;
    }

    // 递归查找指定的根文件夹
    function findFolder(nodes: any[]): any | null {
        for (const node of nodes) {
            if (node.id === rootFolderId) {
                return node;
            }
            if (node.children) {
                const found = findFolder(node.children);
                if (found) return found;
            }
        }
        return null;
    }

    const rootFolder = findFolder(bookmarks);
    return rootFolder?.children || [];
}

/**
 * 保存书签根目录设置
 */
export async function saveBookmarkRootSetting(rootFolderId: string): Promise<void> {
    try {
        await browser.storage.local.set({ bookmarkRootFolder: rootFolderId });
    } catch (error) {
        console.error('Error saving bookmark root setting:', error);
    }
}

/**
 * 获取书签根目录设置
 */
export async function getBookmarkRootSetting(): Promise<string> {
    try {
        const result = await browser.storage.local.get('bookmarkRootFolder');
        return result.bookmarkRootFolder || 'all';
    } catch (error) {
        console.error('Error getting bookmark root setting:', error);
        return 'all';
    }
}

/**
 * 更新Chrome书签
 * @param id 书签ID
 * @param title 新标题
 * @param url 新URL
 */
export const updateChromeBookmark = async (id: string, title: string, url: string): Promise<void> => {
    try {
        await browser.bookmarks.update(id, {
            title: title.trim(),
            url: url.trim()
        });
    } catch (error) {
        console.error('Failed to update Chrome bookmark:', error);
        throw new Error('Failed to update bookmark in Chrome');
    }
};

/**
 * 获取书签详情
 * @param id 书签ID
 */
export const getChromeBookmark = async (id: string): Promise<any | null> => {
    try {
        const results = await browser.bookmarks.get(id);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Failed to get Chrome bookmark:', error);
        return null;
    }
};

/**
 * 删除Chrome书签
 * @param id 书签ID
 */
export const deleteChromeBookmark = async (id: string): Promise<void> => {
    try {
        await browser.bookmarks.remove(id);
    } catch (error) {
        console.error('Failed to delete Chrome bookmark:', error);
        throw new Error('Failed to delete bookmark from Chrome');
    }
};

/**
 * 验证书签URL格式
 * @param url URL字符串
 */
export const validateBookmarkUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * 验证书签标题
 * @param title 标题字符串
 */
export const validateBookmarkTitle = (title: string): boolean => {
    return title.trim().length > 0 && title.trim().length <= 200;
};

/**
 * 发送书签更新消息到其他页面
 * @param bookmarkId 书签ID
 * @param newTitle 新标题
 * @param newUrl 新URL
 */
export const broadcastBookmarkUpdate = async (bookmarkId: string, newTitle: string, newUrl: string): Promise<void> => {
    try {
        // 发送消息到所有打开的插件页面
        await browser.runtime.sendMessage({
            type: 'BOOKMARK_UPDATED',
            payload: {
                id: bookmarkId,
                title: newTitle,
                url: newUrl
            }
        });
    } catch (error) {
        // 忽略发送消息失败的错误，因为可能没有其他页面在监听
        console.log('No listeners for bookmark update message');
    }
};

/**
 * 创建Chrome书签
 * @param title 书签标题
 * @param url 书签URL
 * @param parentId 父文件夹ID（可选，默认为书签栏）
 */
export const createChromeBookmark = async (title: string, url: string, parentId?: string): Promise<any> => {
    try {
        const bookmark = await browser.bookmarks.create({
            parentId: parentId || '1', // 默认添加到书签栏（ID为'1'）
            title: title.trim(),
            url: url.trim()
        });
        return bookmark;
    } catch (error) {
        console.error('Failed to create Chrome bookmark:', error);
        throw new Error('Failed to create bookmark in Chrome');
    }
};

/**
 * 获取指定文件夹中的所有书签
 * @param folderId 文件夹ID
 * @returns 书签列表
 */
export const getBookmarksInFolder = async (folderId: string): Promise<Array<{ id: string; title: string; url: string }>> => {
    try {
        const folder = await browser.bookmarks.getSubTree(folderId);
        const bookmarks: Array<{ id: string; title: string; url: string }> = [];

        const extractBookmarks = (nodes: any[]) => {
            if (!nodes || !Array.isArray(nodes)) {
                return;
            }

            for (const node of nodes) {
                if (!node) continue;

                if (node.url) {
                    // 这是一个书签
                    bookmarks.push({
                        id: node.id,
                        title: node.title || '',
                        url: node.url
                    });
                } else if (node.children) {
                    // 这是一个文件夹，递归处理
                    extractBookmarks(node.children);
                }
            }
        };

        if (folder && Array.isArray(folder) && folder[0] && folder[0].children) {
            extractBookmarks(folder[0].children);
        }

        return bookmarks;
    } catch (error) {
        console.error('Failed to get bookmarks in folder:', error);
        // 返回空数组而不是抛出错误，避免页面崩溃
        return [];
    }
};

/**
 * 获取指定文件夹中的书签标题列表（用于 AI 参考命名格式）
 * @param folderId 文件夹 ID
 * @param maxCount 最多返回的书签数量（默认 20）
 * @returns 书签标题列表
 */
export const getBookmarkTitlesInFolder = async (
    folderId: string,
    maxCount: number = 20
): Promise<string[]> => {
    try {
        const children = await browser.bookmarks.getChildren(folderId);

        // 只获取书签（有 URL 的节点），不包括子文件夹
        const bookmarks = children
            .filter(node => node.url)
            .slice(0, maxCount)
            .map(node => node.title);

        return bookmarks;
    } catch (error) {
        console.error('Failed to get bookmark titles in folder:', error);
        return [];
    }
};
