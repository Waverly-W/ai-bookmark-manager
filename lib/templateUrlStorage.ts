import { storage } from 'wxt/storage';
import { extractTemplatePlaceholders } from '@/lib/templateUrlUtils';

export type TemplateUrlOpenMode = 'new-tab' | 'current-tab';

export interface TemplateUrlItem {
    id: string;
    name: string;
    description?: string;
    urlTemplate: string;
    placeholders: string[];
    openMode: TemplateUrlOpenMode;
    createdAt: number;
    updatedAt: number;
}

export interface SaveTemplateUrlInput {
    id?: string;
    name: string;
    description?: string;
    urlTemplate: string;
    openMode: TemplateUrlOpenMode;
}

export const TEMPLATE_URL_STORAGE_KEY = 'local:templateUrls';

const sortTemplateUrls = (items: TemplateUrlItem[]): TemplateUrlItem[] =>
    [...items].sort((a, b) => b.updatedAt - a.updatedAt);

export const getTemplateUrls = async (): Promise<TemplateUrlItem[]> => {
    const items = await storage.getItem<TemplateUrlItem[]>(TEMPLATE_URL_STORAGE_KEY);
    return sortTemplateUrls(items || []);
};

export const getTemplateUrlById = async (id: string): Promise<TemplateUrlItem | null> => {
    const items = await getTemplateUrls();
    return items.find((item) => item.id === id) || null;
};

export const saveTemplateUrl = async (input: SaveTemplateUrlInput): Promise<TemplateUrlItem> => {
    const items = await getTemplateUrls();
    const existing = input.id ? items.find((item) => item.id === input.id) : undefined;
    const now = Date.now();

    const nextItem: TemplateUrlItem = {
        id: existing?.id || crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description?.trim() || '',
        urlTemplate: input.urlTemplate.trim(),
        placeholders: extractTemplatePlaceholders(input.urlTemplate),
        openMode: input.openMode,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    const nextItems = existing
        ? items.map((item) => item.id === existing.id ? nextItem : item)
        : [nextItem, ...items];

    await storage.setItem(TEMPLATE_URL_STORAGE_KEY, sortTemplateUrls(nextItems));

    return nextItem;
};

export const deleteTemplateUrl = async (id: string): Promise<void> => {
    const items = await getTemplateUrls();

    await storage.setItem(
        TEMPLATE_URL_STORAGE_KEY,
        items.filter((item) => item.id !== id)
    );
};
