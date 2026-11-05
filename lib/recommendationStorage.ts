import { browser } from 'wxt/browser';

const DOMAIN_MAPPINGS_KEY = 'mustard_domain_mappings';

const MAX_DOMAIN_MAPPINGS = 500; // Limit to prevent unlimited growth

export interface DomainMapping {
    [domain: string]: string; // domain -> folderId
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
