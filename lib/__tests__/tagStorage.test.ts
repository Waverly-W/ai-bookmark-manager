import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = new Map<string, any>();

vi.mock('wxt/storage', () => ({
    storage: {
        getItem: vi.fn(async (key: string) => storageState.get(key)),
        setItem: vi.fn(async (key: string, value: unknown) => {
            storageState.set(key, value);
        })
    }
}));

import {
    getAllTags,
    getTagsMapForBookmarks,
    mergeTags,
    removeTagsForBookmarks,
    saveTagsForBookmark,
    saveTagsForBookmarks
} from '../tagStorage';

describe('tagStorage', () => {
    beforeEach(() => {
        storageState.clear();
    });

    it('saves bookmark tags with normalization and updates the global index', async () => {
        await saveTagsForBookmark('1', [' ai ', 'tools', 'ai', '']);

        const map = await getTagsMapForBookmarks(['1']);
        const allTags = await getAllTags();

        expect(map['1']).toEqual(['ai', 'tools']);
        expect(allTags).toEqual(['ai', 'tools']);
    });

    it('saves multiple bookmark tag sets and removes them in batch', async () => {
        await saveTagsForBookmarks({
            '1': ['react', 'frontend'],
            '2': ['ai', 'frontend']
        });

        expect(await getTagsMapForBookmarks(['1', '2'])).toEqual({
            '1': ['react', 'frontend'],
            '2': ['ai', 'frontend']
        });

        await removeTagsForBookmarks(['1']);

        expect(await getTagsMapForBookmarks(['1', '2'])).toEqual({
            '1': [],
            '2': ['ai', 'frontend']
        });
    });

    it('merges tags without duplicates while preserving order', () => {
        expect(mergeTags(['frontend', 'react'], ['react', 'ai'])).toEqual([
            'frontend',
            'react',
            'ai'
        ]);
    });
});
