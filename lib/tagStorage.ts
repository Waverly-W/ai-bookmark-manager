import { storage } from 'wxt/storage';

const TAGS_STORAGE_KEY = 'local:bookmarkTags';
const ALL_TAGS_STORAGE_KEY = 'local:allTags';

// { [bookmarkId]: string[] }
interface BookmarkTagsMap {
    [key: string]: string[];
}

const normalizeTags = (tags: string[]): string[] =>
    Array.from(
        new Set(
            tags
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0)
        )
    );

/**
 * Get tags for a specific bookmark
 */
export const getTagsForBookmark = async (bookmarkId: string): Promise<string[]> => {
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    return map[bookmarkId] || [];
};

/**
 * Get a subset of bookmark tags keyed by bookmark id
 */
export const getTagsMapForBookmarks = async (bookmarkIds: string[]): Promise<BookmarkTagsMap> => {
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    const result: BookmarkTagsMap = {};

    bookmarkIds.forEach((bookmarkId) => {
        result[bookmarkId] = map[bookmarkId] || [];
    });

    return result;
};

/**
 * Save tags for a bookmark and update global index
 */
export const saveTagsForBookmark = async (bookmarkId: string, tags: string[]): Promise<void> => {
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    const uniqueTags = normalizeTags(tags);

    map[bookmarkId] = uniqueTags;
    await storage.setItem(TAGS_STORAGE_KEY, map);

    await addTagsToGlobalIndex(uniqueTags);
};

/**
 * Save tags for multiple bookmarks and update the global index
 */
export const saveTagsForBookmarks = async (bookmarkTags: BookmarkTagsMap): Promise<void> => {
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    const allTags: string[] = [];

    Object.entries(bookmarkTags).forEach(([bookmarkId, tags]) => {
        const uniqueTags = normalizeTags(tags);
        map[bookmarkId] = uniqueTags;
        allTags.push(...uniqueTags);
    });

    await storage.setItem(TAGS_STORAGE_KEY, map);
    await addTagsToGlobalIndex(allTags);
};

/**
 * Remove tags for a specific bookmark
 */
export const removeTagsForBookmark = async (bookmarkId: string): Promise<void> => {
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};

    if (!(bookmarkId in map)) {
        return;
    }

    delete map[bookmarkId];
    await storage.setItem(TAGS_STORAGE_KEY, map);
};

/**
 * Remove tags for multiple bookmarks
 */
export const removeTagsForBookmarks = async (bookmarkIds: string[]): Promise<void> => {
    if (bookmarkIds.length === 0) {
        return;
    }

    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    let changed = false;

    bookmarkIds.forEach((bookmarkId) => {
        if (bookmarkId in map) {
            delete map[bookmarkId];
            changed = true;
        }
    });

    if (changed) {
        await storage.setItem(TAGS_STORAGE_KEY, map);
    }
};

/**
 * Get all known tags (for autocomplete)
 */
export const getAllTags = async (): Promise<string[]> => {
    return await storage.getItem<string[]>(ALL_TAGS_STORAGE_KEY) || [];
};

/**
 * Add new tags to the global index
 */
export const addTagsToGlobalIndex = async (newTags: string[]): Promise<void> => {
    const existingTags = await getAllTags();
    const tagSet = new Set(existingTags);
    const normalizedTags = normalizeTags(newTags);

    let changed = false;
    normalizedTags.forEach(tag => {
        if (tag && !tagSet.has(tag)) {
            tagSet.add(tag);
            changed = true;
        }
    });

    if (changed) {
        await storage.setItem(ALL_TAGS_STORAGE_KEY, Array.from(tagSet));
    }
};

/**
 * Get Top N most used tags (Optional optimization)
 * Currently just returns first N from global list, 
 * but could be improved to track frequency.
 */
export const getTopTags = async (limit: number = 50): Promise<string[]> => {
    const tags = await getAllTags();
    return tags.slice(0, limit);
};

export const mergeTags = (existingTags: string[], incomingTags: string[]): string[] =>
    normalizeTags([...existingTags, ...incomingTags]);
