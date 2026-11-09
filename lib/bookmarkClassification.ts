/**
 * 批量分类的纯逻辑：分块、文件夹列表、AI 结果校验。
 * 网络请求在 lib/aiService.ts 的 batchClassifyBookmarks 中。
 */

/** AI 找不到合适文件夹时返回的值，含义是"保持原位，不移动" */
export const KEEP_IN_PLACE_FOLDER_ID = '0';

export interface ClassifiableBookmark {
    id: string;
    title: string;
    url: string;
    /** 当前所在文件夹，用于剔除"建议位置就是当前位置"的结果 */
    parentId?: string;
}

export interface ClassificationFolder {
    id: string;
    path: string;
}

export interface BookmarkClassification {
    bookmarkId: string;
    suggestedFolderId: string;
    reason?: string;
    confidence: number;
}

/**
 * 把任意文件夹列表（树或平铺）整理成去重的 {id, path} 列表，跳过虚拟的 "all" 节点。
 */
export const toClassificationFolders = (
    folders: Array<{ id: string; title?: string; path?: string; children?: unknown[] }>
): ClassificationFolder[] => {
    const result: ClassificationFolder[] = [];
    const seen = new Set<string>();

    const visit = (nodes: unknown[]) => {
        for (const node of nodes as Array<{ id?: string; title?: string; path?: string; children?: unknown[] }>) {
            if (!node || !node.id) continue;
            if (node.id !== 'all' && node.id !== KEEP_IN_PLACE_FOLDER_ID && !seen.has(node.id)) {
                seen.add(node.id);
                result.push({ id: node.id, path: node.path || node.title || node.id });
            }
            if (Array.isArray(node.children) && node.children.length > 0) {
                visit(node.children);
            }
        }
    };

    visit(folders);
    return result;
};

export const chunkItems = <T>(items: T[], size: number): T[][] => {
    const chunkSize = Math.max(1, Math.floor(size));
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};

export const formatClassificationFolderList = (folders: ClassificationFolder[]): string =>
    folders.map((folder) => `[${folder.id}] ${folder.path}`).join('\n');

export const formatClassificationBookmarkList = (bookmarks: ClassifiableBookmark[]): string =>
    bookmarks.map((bookmark) => `[${bookmark.id}] ${bookmark.title} (${bookmark.url})`).join('\n');

const normalizePath = (path: string): string =>
    path
        .trim()
        .replace(/\s*[>›]\s*/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '')
        .toLowerCase();

const stripIdBrackets = (value: unknown): string =>
    String(value ?? '')
        .trim()
        .replace(/^\[(?:ID:\s*)?([^\]]+)\]$/i, '$1')
        .trim();

const clampConfidence = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(1, Math.max(0, parsed));
};

/**
 * 校验并清洗 AI 返回的分类结果：
 * - 只保留本批次里存在的书签，同一书签只取第一条；
 * - 文件夹 ID 不存在时尝试按路径匹配，仍匹配不上则视为"保持原位"；
 * - 建议位置与当前位置相同的结果直接剔除（不需要移动）；
 * - 置信度限制在 0-1。
 * 返回顺序与输入书签顺序一致。
 */
export const normalizeClassifications = (
    raw: unknown,
    bookmarks: ClassifiableBookmark[],
    folders: ClassificationFolder[]
): BookmarkClassification[] => {
    if (!Array.isArray(raw)) return [];

    const bookmarkById = new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark]));
    const folderIds = new Set(folders.map((folder) => folder.id));
    const folderIdByPath = new Map(folders.map((folder) => [normalizePath(folder.path), folder.id]));
    const byBookmark = new Map<string, BookmarkClassification>();
    const seen = new Set<string>();

    for (const item of raw as Array<Record<string, unknown>>) {
        if (!item || typeof item !== 'object') continue;

        const bookmarkId = stripIdBrackets(item.bookmarkId);
        const bookmark = bookmarkById.get(bookmarkId);
        if (!bookmark || seen.has(bookmarkId)) continue;
        seen.add(bookmarkId);

        const candidate = stripIdBrackets(item.suggestedFolderId);
        let suggestedFolderId = KEEP_IN_PLACE_FOLDER_ID;
        if (folderIds.has(candidate)) {
            suggestedFolderId = candidate;
        } else if (candidate && candidate !== KEEP_IN_PLACE_FOLDER_ID) {
            suggestedFolderId = folderIdByPath.get(normalizePath(candidate)) ?? KEEP_IN_PLACE_FOLDER_ID;
        }

        if (bookmark.parentId && suggestedFolderId === bookmark.parentId) {
            // 已经在建议的文件夹里，不需要移动
            continue;
        }

        const reason = typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined;
        byBookmark.set(bookmarkId, {
            bookmarkId,
            suggestedFolderId,
            reason,
            confidence: clampConfidence(item.confidence)
        });
    }

    return bookmarks
        .map((bookmark) => byBookmark.get(bookmark.id))
        .filter((result): result is BookmarkClassification => Boolean(result));
};

/**
 * 应用前再校验一次（用户可能在弹窗里手动改了目标文件夹）：
 * 只返回目标文件夹真实存在、且与当前位置不同的移动操作。
 */
export const planClassificationMoves = (
    selected: Array<{ bookmarkId: string; suggestedFolderId: string }>,
    folders: ClassificationFolder[],
    currentParentById: Map<string, string | undefined>
): Array<{ bookmarkId: string; folderId: string }> => {
    const folderIds = new Set(folders.map((folder) => folder.id));
    const seen = new Set<string>();
    const moves: Array<{ bookmarkId: string; folderId: string }> = [];

    for (const item of selected) {
        if (seen.has(item.bookmarkId)) continue;
        seen.add(item.bookmarkId);
        if (!folderIds.has(item.suggestedFolderId)) continue;
        if (currentParentById.get(item.bookmarkId) === item.suggestedFolderId) continue;
        moves.push({ bookmarkId: item.bookmarkId, folderId: item.suggestedFolderId });
    }

    return moves;
};
