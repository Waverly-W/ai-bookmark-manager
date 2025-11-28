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

/**
 * 移动Chrome书签
 * @param id 书签ID
 * @param parentId 目标父文件夹ID
 * @param index 目标位置索引（可选）
 */
export const moveChromeBookmark = async (id: string, parentId: string, index?: number): Promise<void> => {
    try {
        const destination: { parentId: string; index?: number } = { parentId };
        if (index !== undefined) {
            destination.index = index;
        }
        await browser.bookmarks.move(id, destination);
    } catch (error) {
        console.error('Failed to move Chrome bookmark:', error);
        throw new Error('Failed to move bookmark in Chrome');
    }
};
/**
 * 重复书签组接口
 */
export interface DuplicateGroup {
    url: string;
    bookmarks: any[]; // 使用 BookmarkNode 类型
}

/**
 * 查找重复书签
 * @param nodes 书签节点列表
 */
export const findDuplicateBookmarks = (nodes: any[]): DuplicateGroup[] => {
    const urlMap = new Map<string, any[]>();

    // 递归收集所有书签
    const collectBookmarks = (nodeList: any[]) => {
        for (const node of nodeList) {
            if (node.url) {
                // 标准化 URL (移除末尾斜杠，忽略大小写等 - 这里简单处理)
                const url = node.url.trim();
                if (!urlMap.has(url)) {
                    urlMap.set(url, []);
                }
                urlMap.get(url)?.push(node);
            }
            if (node.children) {
                collectBookmarks(node.children);
            }
        }
    };

    collectBookmarks(nodes);

    // 筛选出有重复的书签
    const duplicates: DuplicateGroup[] = [];
    urlMap.forEach((bookmarks, url) => {
        if (bookmarks.length > 1) {
            duplicates.push({
                url,
                bookmarks
            });
        }
    });

    return duplicates;
};

/**
 * 书签有效性检查结果
 */
export interface ValidityResult {
    id: string;
    title: string;
    url: string;
    status: 'valid' | 'invalid' | 'timeout' | 'error';
    error?: string;
}

/**
 * 检查单个书签的有效性
 * @param url 书签URL
 */
export const checkBookmarkValidity = async (url: string): Promise<{ status: 'valid' | 'invalid' | 'timeout' | 'error'; error?: string }> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            // Try HEAD first
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors' // Handle CORS
            });
            clearTimeout(timeoutId);
            // With no-cors, we get an opaque response (status 0), which we treat as valid for now
            // If it failed network-wise, it would throw
            return { status: 'valid' };
        } catch (headError) {
            // Fallback to GET if HEAD fails (some servers block HEAD)
            // or if it was a network error, try GET to be sure
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal,
                    mode: 'no-cors'
                });
                clearTimeout(timeoutId);
                return { status: 'valid' };
            } catch (getError: any) {
                clearTimeout(timeoutId);
                if (getError.name === 'AbortError') {
                    return { status: 'timeout' };
                }
                return { status: 'invalid', error: getError.message };
            }
        }
    } catch (error: any) {
        return { status: 'error', error: error.message };
    }
};

/**
 * 扫描书签有效性
 * @param bookmarks 书签列表
 * @param onProgress 进度回调
 * @param signal AbortSignal 用于取消
 */
export const scanBookmarkValidity = async (
    bookmarks: any[],
    onProgress?: (current: number, total: number, url: string, result?: ValidityResult) => void,
    signal?: AbortSignal
): Promise<ValidityResult[]> => {
    const results: ValidityResult[] = [];
    const flatBookmarks: any[] = [];

    // Flatten bookmarks
    const collect = (nodes: any[]) => {
        for (const node of nodes) {
            if (node.url) {
                flatBookmarks.push(node);
            }
            if (node.children) {
                collect(node.children);
            }
        }
    };
    collect(bookmarks);

    const total = flatBookmarks.length;
    let processed = 0;

    // Process in batches to avoid overwhelming the network
    const BATCH_SIZE = 5;
    for (let i = 0; i < flatBookmarks.length; i += BATCH_SIZE) {
        if (signal?.aborted) {
            break;
        }

        const batch = flatBookmarks.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (bookmark) => {
            if (signal?.aborted) return null;

            if (!bookmark.url.startsWith('http')) {
                processed++;
                onProgress?.(processed, total, bookmark.url);
                return null; // Skip non-http bookmarks
            }

            onProgress?.(processed, total, bookmark.url); // Notify start check

            const check = await checkBookmarkValidity(bookmark.url);

            processed++;

            if (check.status !== 'valid') {
                const result: ValidityResult = {
                    id: bookmark.id,
                    title: bookmark.title,
                    url: bookmark.url,
                    status: check.status,
                    error: check.error
                };
                onProgress?.(processed, total, bookmark.url, result); // Notify result
                return result;
            }

            onProgress?.(processed, total, bookmark.url); // Notify success
            return null;
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(res => {
            if (res) results.push(res);
        });
    }

    return results;
};

/**
 * 根据文件夹ID过滤书签
 * @param bookmarks 书签树
 * @param folderId 文件夹ID
 * @returns 过滤后的书签节点列表（包含子节点）
 */
export const filterBookmarksByFolder = (bookmarks: any[], folderId: string): any[] => {
    if (!folderId || folderId === 'all') {
        return bookmarks;
    }

    // Recursive search for the folder
    const findFolder = (nodes: any[]): any | null => {
        for (const node of nodes) {
            if (node.id === folderId) {
                return node;
            }
            if (node.children) {
                const found = findFolder(node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const targetFolder = findFolder(bookmarks);
    return targetFolder ? [targetFolder] : [];
};
/**
 * 查找空文件夹
 * @param nodes 书签树
 * @returns 空文件夹列表
 */
export const findEmptyFolders = (nodes: any[]): any[] => {
    const emptyFolders: any[] = [];

    const traverse = (node: any) => {
        // Check if it's a folder (has children property, even if empty, or specific type if available)
        // In Chrome bookmarks, folders usually have children array (can be empty) and no url
        if (!node.url && node.children) {
            // It's a folder
            if (node.children.length === 0) {
                emptyFolders.push(node);
            } else {
                // Recursively check children
                node.children.forEach(traverse);

                // Optional: If we want to consider folders containing only empty folders as empty, 
                // we'd need a post-order traversal and more complex logic. 
                // For now, let's stick to strictly empty folders (0 children).
            }
        }
    };

    nodes.forEach(traverse);
    return emptyFolders;
};
