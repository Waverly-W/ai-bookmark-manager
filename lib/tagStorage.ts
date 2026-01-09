import { storage } from 'wxt/storage';

const TAGS_STORAGE_KEY = 'local:bookmarkTags';
const ALL_TAGS_STORAGE_KEY = 'local:allTags';

// { [bookmarkId]: string[] }
interface BookmarkTagsMap {
    [key: string]: string[];
}

/**
 * Get tags for a specific bookmark
 */
export const getTagsForBookmark = async (bookmarkId: string): Promise<string[]> => {
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    return map[bookmarkId] || [];
};

/**
 * Save tags for a bookmark and update global index
 */
export const saveTagsForBookmark = async (bookmarkId: string, tags: string[]): Promise<void> => {
    // 1. Update bookmark-tag map
    const map = await storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY) || {};
    // Filter empty tags and duplicates
    const uniqueTags = Array.from(new Set(tags.filter(t => t.trim().length > 0)));

    map[bookmarkId] = uniqueTags;
    await storage.setItem(TAGS_STORAGE_KEY, map);

    // 2. Update global tag index
    await addTagsToGlobalIndex(uniqueTags);
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

    let changed = false;
    newTags.forEach(tag => {
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
