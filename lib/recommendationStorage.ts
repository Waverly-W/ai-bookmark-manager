import { browser } from 'wxt/browser';

const RECENT_FOLDERS_KEY = 'mustard_recent_folders';
const DOMAIN_MAPPINGS_KEY = 'mustard_domain_mappings';

const MAX_Recent_FOLDERS = 10;
const MAX_DOMAIN_MAPPINGS = 500; // Limit to prevent unlimited growth

export interface RecentFolder {
    folderId: string;
    lastUsed: number;
    count: number;
}

export interface DomainMapping {
    [domain: string]: string; // domain -> folderId
}

/**
 * Update recent folders list (LRU)
 */
export async function addRecentFolder(folderId: string): Promise<void> {
    try {
        const result = await browser.storage.local.get(RECENT_FOLDERS_KEY);
        let recents: RecentFolder[] = result[RECENT_FOLDERS_KEY] || [];

        const existingIndex = recents.findIndex(f => f.folderId === folderId);

        if (existingIndex !== -1) {
            // Update existing
            recents[existingIndex].lastUsed = Date.now();
            recents[existingIndex].count += 1;
        } else {
            // Add new
            recents.push({
                folderId,
                lastUsed: Date.now(),
                count: 1
            });
        }

        // Sort by lastUsed desc
        recents.sort((a, b) => b.lastUsed - a.lastUsed);

        // Limit size
        if (recents.length > MAX_Recent_FOLDERS) {
            recents = recents.slice(0, MAX_Recent_FOLDERS);
        }

        await browser.storage.local.set({ [RECENT_FOLDERS_KEY]: recents });
    } catch (e) {
        console.error('Failed to update recent folders:', e);
    }
}

/**
 * Get recent folders sorted by usage/time
 */
export async function getRecentFolders(limit: number = 5): Promise<string[]> {
    try {
        const result = await browser.storage.local.get(RECENT_FOLDERS_KEY);
        const recents: RecentFolder[] = result[RECENT_FOLDERS_KEY] || [];
        return recents.slice(0, limit).map(r => r.folderId);
    } catch (e) {
        console.error('Failed to get recent folders:', e);
        return [];
    }
}

/**
 * Save domain to folder mapping
 */
export async function saveDomainMapping(url: string, folderId: string): Promise<void> {
    try {
        const domain = new URL(url).hostname;
        if (!domain) return;

        const result = await browser.storage.local.get(DOMAIN_MAPPINGS_KEY);
        const mappings: DomainMapping = result[DOMAIN_MAPPINGS_KEY] || {};

        mappings[domain] = folderId;

        // Simple cleanup if too large (remove random/old keys could be better but this is MVP)
        const keys = Object.keys(mappings);
        if (keys.length > MAX_DOMAIN_MAPPINGS) {
            // Remove a chunk of old entries? 
            // Since it's a simple object, we just delete the first few keys we find if we exceed limits significantly
            // A better approach would be to store time, but let's keep it simple for MVP
            const keysToRemove = keys.slice(0, keys.length - MAX_DOMAIN_MAPPINGS);
            keysToRemove.forEach(k => delete mappings[k]);
        }

        await browser.storage.local.set({ [DOMAIN_MAPPINGS_KEY]: mappings });
    } catch (e) {
        console.error('Failed to save domain mapping:', e);
    }
}

/**
 * Get recommended folder for domain
 */
export async function getFolderForDomain(url: string): Promise<string | null> {
    try {
        const domain = new URL(url).hostname;
        if (!domain) return null;

        const result = await browser.storage.local.get(DOMAIN_MAPPINGS_KEY);
        const mappings: DomainMapping = result[DOMAIN_MAPPINGS_KEY] || {};

        return mappings[domain] || null;
    } catch (e) {
        // console.error('Failed to get folder for domain:', e);
        // Silent fail is fine here
        return null;
    }
}
