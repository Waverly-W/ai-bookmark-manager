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
    deleteTemplateUrl,
    getTemplateUrlById,
    getTemplateUrls,
    saveTemplateUrl
} from '../templateUrlStorage';

describe('templateUrlStorage', () => {
    beforeEach(() => {
        storageState.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
    });

    it('returns an empty list by default', async () => {
        expect(await getTemplateUrls()).toEqual([]);
    });

    it('creates and reads a template', async () => {
        const template = await saveTemplateUrl({
            name: 'Google Search',
            description: 'Search the web',
            urlTemplate: 'https://google.com/search?q={keyword}',
            openMode: 'new-tab'
        });

        expect(template.placeholders).toEqual(['keyword']);
        expect((await getTemplateUrls())[0].name).toBe('Google Search');
    });

    it('updates an existing template while preserving createdAt', async () => {
        const created = await saveTemplateUrl({
            name: 'Docs',
            description: '',
            urlTemplate: 'https://example.com/docs?q={keyword}',
            openMode: 'new-tab'
        });

        vi.setSystemTime(new Date('2026-04-22T11:00:00Z'));

        const updated = await saveTemplateUrl({
            id: created.id,
            name: 'Docs Search',
            description: 'Updated',
            urlTemplate: 'https://example.com/docs?q={keyword}&lang={lang}',
            openMode: 'current-tab'
        });

        expect(updated.createdAt).toBe(created.createdAt);
        expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
        expect(updated.placeholders).toEqual(['keyword', 'lang']);
    });

    it('deletes templates by id', async () => {
        const created = await saveTemplateUrl({
            name: 'Docs',
            description: '',
            urlTemplate: 'https://example.com/docs',
            openMode: 'new-tab'
        });

        await deleteTemplateUrl(created.id);

        expect(await getTemplateUrlById(created.id)).toBeNull();
        expect(await getTemplateUrls()).toEqual([]);
    });
});
