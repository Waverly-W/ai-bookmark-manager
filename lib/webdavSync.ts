import { browser } from 'wxt/browser';
import { storage } from 'wxt/storage';

import type { AIRenameConfig } from '@/lib/aiRenameConfig';
import type { FolderRecommendationConfig } from '@/lib/folderRecommendationConfig';
import { STORAGE_KEYS as AI_PROMPT_STORAGE_KEYS } from '@/lib/aiPromptUtils';

export interface WebDAVBackupConfig {
    baseUrl: string;
    username: string;
    password: string;
    maxVersions: number;
}

export interface BackupPromptEntry {
    useCustom: boolean;
    customPrompt: string | null;
}

export interface BackupPromptsFile {
    basicRename: BackupPromptEntry;
    contextualRename: BackupPromptEntry;
    folderRecommendation: BackupPromptEntry;
    autoTagging: BackupPromptEntry;
    conflictResolution: BackupPromptEntry;
}

export interface BackupSettingsFile {
    aiConfig: Record<string, unknown> | null;
    aiRenameConfig: AIRenameConfig | null;
    folderRecommendationConfig: FolderRecommendationConfig | null;
}

export interface BackupBookmarkNodeBase {
    type: 'folder' | 'bookmark';
    title: string;
}

export interface BackupFolderNode extends BackupBookmarkNodeBase {
    type: 'folder';
    children: BackupBookmarkNode[];
}

export interface BackupBookmarkLeafNode extends BackupBookmarkNodeBase {
    type: 'bookmark';
    url: string;
    tags: string[];
}

export type BackupBookmarkNode = BackupFolderNode | BackupBookmarkLeafNode;

export interface BackupBookmarkRoot {
    rootIndex: number;
    title: string;
    children: BackupBookmarkNode[];
}

export interface BackupBookmarksFile {
    roots: BackupBookmarkRoot[];
}

export interface BackupSnapshot {
    schemaVersion: number;
    createdAt: string;
    bookmarks: BackupBookmarksFile;
    settings: BackupSettingsFile;
    prompts: BackupPromptsFile;
}

export interface BackupManifest {
    schemaVersion: number;
    backupId: string;
    folderName: string;
    createdAt: string;
    counts: {
        roots: number;
        folders: number;
        bookmarks: number;
        tags: number;
    };
    files: {
        bookmarks: string;
        settings: string;
        prompts: string;
    };
}

export interface BackupBundle {
    manifest: BackupManifest;
    snapshot: BackupSnapshot;
}

export interface BackupVersionSummary {
    backupId: string;
    folderName: string;
    createdAt: string;
    counts: BackupManifest['counts'];
}

export interface MergeConflict {
    id: string;
    section: 'bookmarks' | 'settings' | 'prompts';
    entityKey: string;
    field: string;
    localValue: unknown;
    remoteValue: unknown;
}

export interface MergeSummary {
    autoMergedFields: number;
    conflictFields: number;
}

export interface MergeResult {
    mergedSnapshot: BackupSnapshot;
    conflicts: MergeConflict[];
    summary: MergeSummary;
}

export interface AIConflictResolution {
    conflictId: string;
    chosenSource: 'local' | 'remote' | 'hybrid';
    mergedValue: unknown;
    reason: string;
}

export const BACKUP_SCHEMA_VERSION = 1;

const WEBDAV_CONFIG_STORAGE_KEY = 'webdavBackupConfig';
const TAGS_STORAGE_KEY = 'local:bookmarkTags';
const ALL_TAGS_STORAGE_KEY = 'local:allTags';
const BACKUP_MANIFEST_FILE = 'manifest.json';
const BACKUP_BOOKMARKS_FILE = 'bookmarks.json';
const BACKUP_SETTINGS_FILE = 'settings.json';
const BACKUP_PROMPTS_FILE = 'prompts.json';

const AI_SETTINGS_STORAGE_KEYS = [
    'aiConfig',
    'ai_rename_config',
    'folderRecommendationConfig'
] as const;

const PROMPT_STORAGE_MAP = {
    basicRename: {
        customKey: AI_PROMPT_STORAGE_KEYS.CUSTOM_PROMPT,
        useCustomKey: AI_PROMPT_STORAGE_KEYS.USE_CUSTOM_PROMPT
    },
    contextualRename: {
        customKey: AI_PROMPT_STORAGE_KEYS.CUSTOM_CONTEXTUAL_RENAME_PROMPT,
        useCustomKey: AI_PROMPT_STORAGE_KEYS.USE_CUSTOM_CONTEXTUAL_RENAME_PROMPT
    },
    folderRecommendation: {
        customKey: AI_PROMPT_STORAGE_KEYS.CUSTOM_FOLDER_RECOMMENDATION_PROMPT,
        useCustomKey: AI_PROMPT_STORAGE_KEYS.USE_CUSTOM_FOLDER_RECOMMENDATION_PROMPT
    },
    autoTagging: {
        customKey: AI_PROMPT_STORAGE_KEYS.CUSTOM_AUTO_TAG_PROMPT,
        useCustomKey: AI_PROMPT_STORAGE_KEYS.USE_CUSTOM_AUTO_TAG_PROMPT
    },
    conflictResolution: {
        customKey: AI_PROMPT_STORAGE_KEYS.CUSTOM_BACKUP_CONFLICT_PROMPT,
        useCustomKey: AI_PROMPT_STORAGE_KEYS.USE_CUSTOM_BACKUP_CONFLICT_PROMPT
    }
} as const;

type PromptSectionKey = keyof typeof PROMPT_STORAGE_MAP;

interface BookmarkTagsMap {
    [bookmarkId: string]: string[];
}

interface BrowserBookmarkTreeNode {
    id: string;
    title: string;
    url?: string;
    children?: BrowserBookmarkTreeNode[];
}

interface FlatBookmarkFolderEntity {
    type: 'folder';
    rootIndex: number;
    folderPath: string[];
}

interface FlatBookmarkLeafEntity {
    type: 'bookmark';
    rootIndex: number;
    folderPath: string[];
    url: string;
    title: string;
    tags: string[];
}

type FlatBookmarkEntity = FlatBookmarkFolderEntity | FlatBookmarkLeafEntity;

const DEFAULT_PROMPTS_FILE: BackupPromptsFile = {
    basicRename: {
        useCustom: false,
        customPrompt: null
    },
    contextualRename: {
        useCustom: false,
        customPrompt: null
    },
    folderRecommendation: {
        useCustom: false,
        customPrompt: null
    },
    autoTagging: {
        useCustom: false,
        customPrompt: null
    },
    conflictResolution: {
        useCustom: false,
        customPrompt: null
    }
};

export const DEFAULT_WEBDAV_BACKUP_CONFIG: WebDAVBackupConfig = {
    baseUrl: '',
    username: '',
    password: '',
    maxVersions: 10
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const stableStringify = (value: unknown): string => JSON.stringify(value);

const isEqual = (left: unknown, right: unknown): boolean => stableStringify(left) === stableStringify(right);

const normalizeTags = (tags: string[]): string[] =>
    Array.from(
        new Set(
            tags
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0)
        )
    );

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const ensureTrailingSlash = (value: string): string => `${trimTrailingSlash(value)}/`;

const normalizeWebDAVBaseUrl = (value: string): string => ensureTrailingSlash(value.trim());

const getBasicAuthHeader = (config: WebDAVBackupConfig): string | null => {
    if (!config.username && !config.password) {
        return null;
    }

    return `Basic ${btoa(`${config.username}:${config.password}`)}`;
};

const getWebDAVHeaders = (config: WebDAVBackupConfig, extras: Record<string, string> = {}): HeadersInit => {
    const authHeader = getBasicAuthHeader(config);

    return {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...extras
    };
};

const buildWebDAVUrl = (baseUrl: string, path: string): string => new URL(path, ensureTrailingSlash(baseUrl)).toString();

const flattenObject = (
    value: unknown,
    prefix: string,
    output: Record<string, unknown>
): void => {
    if (Array.isArray(value) || !isPlainObject(value)) {
        output[prefix] = value;
        return;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
        output[prefix] = {};
        return;
    }

    entries.forEach(([key, child]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        flattenObject(child, nextPrefix, output);
    });
};

const deepSet = (target: Record<string, unknown>, path: string, value: unknown): void => {
    const segments = path.split('.');
    let cursor: Record<string, unknown> = target;

    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            cursor[segment] = value;
            return;
        }

        const current = cursor[segment];
        if (!isPlainObject(current)) {
            cursor[segment] = {};
        }
        cursor = cursor[segment] as Record<string, unknown>;
    });
};

const getPromptStorageKeys = (): string[] => {
    const keys = new Set<string>();

    Object.values(PROMPT_STORAGE_MAP).forEach(({ customKey, useCustomKey }) => {
        keys.add(customKey);
        keys.add(useCustomKey);
    });

    return Array.from(keys);
};

const createBackupFolderName = (date = new Date()): string => {
    const pad = (value: number) => value.toString().padStart(2, '0');

    return [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate())
    ].join('') +
        'T' +
        [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join('') +
        'Z';
};

const createManifest = (snapshot: BackupSnapshot, folderName: string): BackupManifest => {
    let folders = 0;
    let bookmarks = 0;
    let tags = 0;

    const walk = (nodes: BackupBookmarkNode[]) => {
        nodes.forEach((node) => {
            if (node.type === 'folder') {
                folders += 1;
                walk(node.children);
                return;
            }

            bookmarks += 1;
            tags += node.tags.length;
        });
    };

    snapshot.bookmarks.roots.forEach((root) => walk(root.children));

    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        backupId: folderName,
        folderName,
        createdAt: snapshot.createdAt,
        counts: {
            roots: snapshot.bookmarks.roots.length,
            folders,
            bookmarks,
            tags
        },
        files: {
            bookmarks: BACKUP_BOOKMARKS_FILE,
            settings: BACKUP_SETTINGS_FILE,
            prompts: BACKUP_PROMPTS_FILE
        }
    };
};

const webdavRequest = async (
    config: WebDAVBackupConfig,
    path: string,
    init: RequestInit = {}
): Promise<Response> => {
    const url = buildWebDAVUrl(config.baseUrl, path);
    const response = await fetch(url, {
        ...init,
        headers: {
            ...getWebDAVHeaders(config),
            ...(init.headers || {})
        }
    });

    return response;
};

const readWebDAVJson = async <T>(config: WebDAVBackupConfig, path: string): Promise<T> => {
    const response = await webdavRequest(config, path, { method: 'GET' });
    if (!response.ok) {
        throw new Error(`Failed to download ${path}: ${response.status} ${response.statusText}`);
    }
    return await response.json() as T;
};

const putWebDAVJson = async (config: WebDAVBackupConfig, path: string, value: unknown): Promise<void> => {
    const response = await webdavRequest(config, path, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(value, null, 2)
    });

    if (!response.ok) {
        throw new Error(`Failed to upload ${path}: ${response.status} ${response.statusText}`);
    }
};

const ensureVersionDirectory = async (config: WebDAVBackupConfig, folderName: string): Promise<void> => {
    const response = await webdavRequest(config, `${folderName}/`, {
        method: 'MKCOL'
    });

    if (response.status === 201 || response.status === 405) {
        return;
    }

    if (!response.ok) {
        throw new Error(`Failed to create remote directory ${folderName}: ${response.status} ${response.statusText}`);
    }
};

const deleteWebDAVDirectory = async (config: WebDAVBackupConfig, folderName: string): Promise<void> => {
    const response = await webdavRequest(config, `${folderName}/`, {
        method: 'DELETE'
    });

    if (response.status === 204 || response.status === 404) {
        return;
    }

    if (!response.ok) {
        throw new Error(`Failed to delete remote directory ${folderName}: ${response.status} ${response.statusText}`);
    }
};

const extractResourceText = (element: Element, localName: string): string => {
    const match = element.getElementsByTagNameNS('*', localName)[0];
    return match?.textContent?.trim() || '';
};

const isCollectionResource = (element: Element): boolean => {
    const resourceType = element.getElementsByTagNameNS('*', 'resourcetype')[0];
    if (!resourceType) {
        return false;
    }

    return Array.from(resourceType.children).some((child) => child.localName === 'collection');
};

const listWebDAVCollections = async (config: WebDAVBackupConfig): Promise<string[]> => {
    const response = await webdavRequest(config, '', {
        method: 'PROPFIND',
        headers: {
            Depth: '1'
        },
        body: `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop>
    <displayname />
    <resourcetype />
  </prop>
</propfind>`
    });

    if (response.status !== 207 && !response.ok) {
        throw new Error(`Failed to list WebDAV directory: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(xml, 'application/xml');
    const responseNodes = Array.from(documentNode.getElementsByTagNameNS('*', 'response'));
    const basePath = new URL(normalizeWebDAVBaseUrl(config.baseUrl)).pathname;

    return responseNodes
        .map((node) => {
            const href = extractResourceText(node, 'href');
            if (!href || !isCollectionResource(node)) {
                return null;
            }

            const fullUrl = new URL(href, config.baseUrl);
            if (fullUrl.pathname === basePath) {
                return null;
            }

            const relativePath = fullUrl.pathname.startsWith(basePath)
                ? fullUrl.pathname.slice(basePath.length)
                : fullUrl.pathname;
            const folderName = trimTrailingSlash(relativePath).split('/').filter(Boolean).pop() || '';
            return folderName || null;
        })
        .filter((value): value is string => Boolean(value));
};

const getPromptEntry = (
    storageValues: Record<string, unknown>,
    section: PromptSectionKey
): BackupPromptEntry => {
    const keys = PROMPT_STORAGE_MAP[section];
    const customPrompt = storageValues[keys.customKey];

    return {
        useCustom: Boolean(storageValues[keys.useCustomKey]),
        customPrompt: typeof customPrompt === 'string' ? customPrompt : null
    };
};

const buildPromptStorageValues = (prompts: BackupPromptsFile): Record<string, unknown> => {
    const values: Record<string, unknown> = {};

    (Object.keys(PROMPT_STORAGE_MAP) as PromptSectionKey[]).forEach((section) => {
        const entry = prompts[section];
        const storageKeys = PROMPT_STORAGE_MAP[section];

        values[storageKeys.useCustomKey] = Boolean(entry.useCustom);
        if (typeof entry.customPrompt === 'string' && entry.customPrompt.trim().length > 0) {
            values[storageKeys.customKey] = entry.customPrompt;
        }
    });

    return values;
};

const serializeBookmarkTree = (
    nodes: BrowserBookmarkTreeNode[],
    tagsMap: BookmarkTagsMap
): BackupBookmarkNode[] => {
    return nodes.map((node) => {
        if (node.url) {
            return {
                type: 'bookmark',
                title: node.title,
                url: node.url,
                tags: normalizeTags(tagsMap[node.id] || [])
            } satisfies BackupBookmarkLeafNode;
        }

        return {
            type: 'folder',
            title: node.title,
            children: serializeBookmarkTree(node.children || [], tagsMap)
        } satisfies BackupFolderNode;
    });
};

const encodePathSegments = (segments: string[]): string => segments.map((segment) => encodeURIComponent(segment)).join('/');

const flattenBookmarks = (roots: BackupBookmarkRoot[]): Record<string, FlatBookmarkEntity> => {
    const output: Record<string, FlatBookmarkEntity> = {};

    const visit = (rootIndex: number, folderPath: string[], node: BackupBookmarkNode) => {
        if (node.type === 'folder') {
            const nextPath = [...folderPath, node.title];
            const entityKey = `folder::${rootIndex}/${encodePathSegments(nextPath)}`;
            output[entityKey] = {
                type: 'folder',
                rootIndex,
                folderPath: nextPath
            };

            node.children.forEach((child) => visit(rootIndex, nextPath, child));
            return;
        }

        const entityKey = `bookmark::${rootIndex}/${encodePathSegments(folderPath)}::${encodeURIComponent(node.url)}`;
        output[entityKey] = {
            type: 'bookmark',
            rootIndex,
            folderPath,
            url: node.url,
            title: node.title,
            tags: normalizeTags(node.tags)
        };
    };

    roots.forEach((root) => {
        root.children.forEach((child) => visit(root.rootIndex, [], child));
    });

    return output;
};

const rebuildBookmarksFromFlatEntities = (
    entities: Record<string, FlatBookmarkEntity>,
    roots: BackupBookmarkRoot[]
): BackupBookmarksFile => {
    const rootMap = new Map<number, BackupBookmarkRoot>(
        roots.map((root) => [
            root.rootIndex,
            {
                rootIndex: root.rootIndex,
                title: root.title,
                children: []
            }
        ])
    );

    const folderMap = new Map<string, BackupFolderNode>();

    const ensureFolder = (rootIndex: number, folderPath: string[]): BackupFolderNode | BackupBookmarkRoot => {
        const root = rootMap.get(rootIndex) || {
            rootIndex,
            title: `Root ${rootIndex + 1}`,
            children: []
        };
        rootMap.set(rootIndex, root);

        if (folderPath.length === 0) {
            return root;
        }

        const folderKey = `${rootIndex}:${folderPath.join('/')}`;
        const existing = folderMap.get(folderKey);
        if (existing) {
            return existing;
        }

        const parent = ensureFolder(rootIndex, folderPath.slice(0, -1));
        const folderNode: BackupFolderNode = {
            type: 'folder',
            title: folderPath[folderPath.length - 1],
            children: []
        };
        parent.children.push(folderNode);
        folderMap.set(folderKey, folderNode);
        return folderNode;
    };

    Object.values(entities)
        .sort((left, right) => {
            if (left.rootIndex !== right.rootIndex) {
                return left.rootIndex - right.rootIndex;
            }

            const leftPath = left.folderPath.join('/');
            const rightPath = right.folderPath.join('/');
            return leftPath.localeCompare(rightPath);
        })
        .forEach((entity) => {
            if (entity.type === 'folder') {
                ensureFolder(entity.rootIndex, entity.folderPath);
                return;
            }

            const parent = ensureFolder(entity.rootIndex, entity.folderPath);
            parent.children.push({
                type: 'bookmark',
                title: entity.title,
                url: entity.url,
                tags: normalizeTags(entity.tags)
            });
        });

    const sortNodes = (nodes: BackupBookmarkNode[]) => {
        nodes.sort((left, right) => {
            if (left.type !== right.type) {
                return left.type === 'folder' ? -1 : 1;
            }

            if (left.type === 'bookmark' && right.type === 'bookmark') {
                return `${left.title}|${left.url}`.localeCompare(`${right.title}|${right.url}`);
            }

            return left.title.localeCompare(right.title);
        });

        nodes.forEach((node) => {
            if (node.type === 'folder') {
                sortNodes(node.children);
            }
        });
    };

    const normalizedRoots = Array.from(rootMap.values()).sort((left, right) => left.rootIndex - right.rootIndex);
    normalizedRoots.forEach((root) => sortNodes(root.children));

    return {
        roots: normalizedRoots
    };
};

const mergeRootMetadata = (localRoots: BackupBookmarkRoot[], remoteRoots: BackupBookmarkRoot[]): BackupBookmarkRoot[] => {
    const maxRoots = Math.max(localRoots.length, remoteRoots.length);
    const mergedRoots: BackupBookmarkRoot[] = [];

    for (let rootIndex = 0; rootIndex < maxRoots; rootIndex += 1) {
        const localRoot = localRoots[rootIndex];
        const remoteRoot = remoteRoots[rootIndex];

        if (!localRoot && !remoteRoot) {
            continue;
        }

        mergedRoots.push({
            rootIndex,
            title: localRoot?.title || remoteRoot?.title || `Root ${rootIndex + 1}`,
            children: []
        });
    }

    return mergedRoots;
};

const mergePrimitiveSection = (
    section: 'settings' | 'prompts',
    localValue: Record<string, unknown>,
    remoteValue: Record<string, unknown>,
    conflictPrefix: string
): {
    merged: Record<string, unknown>;
    conflicts: MergeConflict[];
    autoMergedFields: number;
} => {
    const merged: Record<string, unknown> = {};
    const conflicts: MergeConflict[] = [];
    let autoMergedFields = 0;

    const keys = new Set<string>([
        ...Object.keys(localValue),
        ...Object.keys(remoteValue)
    ]);

    Array.from(keys).sort().forEach((key) => {
        const localFieldValue = localValue[key];
        const remoteFieldValue = remoteValue[key];

        if (localFieldValue === undefined) {
            merged[key] = deepClone(remoteFieldValue);
            autoMergedFields += 1;
            return;
        }

        if (remoteFieldValue === undefined) {
            merged[key] = deepClone(localFieldValue);
            autoMergedFields += 1;
            return;
        }

        if (isEqual(localFieldValue, remoteFieldValue)) {
            merged[key] = deepClone(localFieldValue);
            autoMergedFields += 1;
            return;
        }

        merged[key] = deepClone(localFieldValue);
        conflicts.push({
            id: `${section}:${conflictPrefix}${key}`,
            section,
            entityKey: key,
            field: 'value',
            localValue: deepClone(localFieldValue),
            remoteValue: deepClone(remoteFieldValue)
        });
    });

    return {
        merged,
        conflicts,
        autoMergedFields
    };
};

const applyConflictValue = (
    target: BackupSnapshot,
    conflict: MergeConflict,
    value: unknown
): void => {
    if (conflict.section === 'settings') {
        const next = {} as Record<string, unknown>;
        flattenObject(target.settings, '', next);
        next[conflict.entityKey] = value;
        const rebuilt: Record<string, unknown> = {};
        Object.entries(next).forEach(([path, pathValue]) => deepSet(rebuilt, path, pathValue));
        target.settings = rebuilt as unknown as BackupSettingsFile;
        return;
    }

    if (conflict.section === 'prompts') {
        const next = {} as Record<string, unknown>;
        flattenObject(target.prompts, '', next);
        next[conflict.entityKey] = value;
        const rebuilt: Record<string, unknown> = {};
        Object.entries(next).forEach(([path, pathValue]) => deepSet(rebuilt, path, pathValue));
        target.prompts = {
            ...DEFAULT_PROMPTS_FILE,
            ...(rebuilt as unknown as BackupPromptsFile)
        };
        return;
    }

    const flatBookmarks = flattenBookmarks(target.bookmarks.roots);
    const entity = flatBookmarks[conflict.entityKey];
    if (!entity || entity.type !== 'bookmark') {
        return;
    }

    if (conflict.field === 'title' && typeof value === 'string') {
        entity.title = value;
    } else if (conflict.field === 'tags' && Array.isArray(value)) {
        entity.tags = normalizeTags(value.filter((item): item is string => typeof item === 'string'));
    }

    target.bookmarks = rebuildBookmarksFromFlatEntities(flatBookmarks, target.bookmarks.roots);
};

export const applyAIConflictResolutions = (
    baseSnapshot: BackupSnapshot,
    conflicts: MergeConflict[],
    resolutions: AIConflictResolution[]
): BackupSnapshot => {
    const nextSnapshot = deepClone(baseSnapshot);
    const conflictMap = new Map(conflicts.map((conflict) => [conflict.id, conflict]));

    resolutions.forEach((resolution) => {
        const conflict = conflictMap.get(resolution.conflictId);
        if (!conflict) {
            return;
        }
        applyConflictValue(nextSnapshot, conflict, resolution.mergedValue);
    });

    return nextSnapshot;
};

export const validateWebDAVBackupConfig = (config: WebDAVBackupConfig): {
    valid: boolean;
    errors: string[];
} => {
    const errors: string[] = [];

    if (!config.baseUrl.trim()) {
        errors.push('webdavUrlRequired');
    } else {
        try {
            new URL(config.baseUrl);
        } catch {
            errors.push('webdavUrlInvalid');
        }
    }

    if (config.maxVersions < 1 || config.maxVersions > 100) {
        errors.push('webdavMaxVersionsInvalid');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

export const getWebDAVBackupConfig = async (): Promise<WebDAVBackupConfig> => {
    try {
        const result = await browser.storage.local.get(WEBDAV_CONFIG_STORAGE_KEY);
        const config = result[WEBDAV_CONFIG_STORAGE_KEY] as Partial<WebDAVBackupConfig> | undefined;

        return {
            ...DEFAULT_WEBDAV_BACKUP_CONFIG,
            ...config
        };
    } catch (error) {
        console.error('Failed to get WebDAV backup config:', error);
        return DEFAULT_WEBDAV_BACKUP_CONFIG;
    }
};

export const saveWebDAVBackupConfig = async (config: WebDAVBackupConfig): Promise<void> => {
    const normalizedConfig: WebDAVBackupConfig = {
        ...config,
        baseUrl: normalizeWebDAVBaseUrl(config.baseUrl),
        username: config.username.trim(),
        maxVersions: Math.max(1, Math.min(100, Math.floor(config.maxVersions)))
    };

    await browser.storage.local.set({
        [WEBDAV_CONFIG_STORAGE_KEY]: normalizedConfig
    });
};

export const testWebDAVConnection = async (config: WebDAVBackupConfig): Promise<{
    success: boolean;
    message: string;
}> => {
    try {
        const response = await webdavRequest(
            {
                ...config,
                baseUrl: normalizeWebDAVBaseUrl(config.baseUrl)
            },
            '',
            {
                method: 'PROPFIND',
                headers: {
                    Depth: '0'
                },
                body: `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop>
    <displayname />
  </prop>
</propfind>`
            }
        );

        if (response.status === 207 || response.ok) {
            return {
                success: true,
                message: 'WebDAV connection is available.'
            };
        }

        const text = await response.text();
        return {
            success: false,
            message: `WebDAV connection failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`
        };
    } catch (error) {
        console.error('Failed to test WebDAV connection:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown WebDAV error'
        };
    }
};

export const collectLocalBackupSnapshot = async (): Promise<BackupSnapshot> => {
    const [bookmarkTree, localSettings, promptSettings, tagsMap] = await Promise.all([
        browser.bookmarks.getTree(),
        browser.storage.local.get(AI_SETTINGS_STORAGE_KEYS as unknown as string[]),
        browser.storage.local.get(getPromptStorageKeys()),
        storage.getItem<BookmarkTagsMap>(TAGS_STORAGE_KEY)
    ]);

    const roots = (bookmarkTree[0]?.children || []).map((node, rootIndex) => ({
        rootIndex,
        title: node.title,
        children: serializeBookmarkTree(node.children || [], tagsMap || {})
    }));

    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        bookmarks: {
            roots
        },
        settings: {
            aiConfig: (localSettings.aiConfig as Record<string, unknown> | undefined) || null,
            aiRenameConfig: (localSettings.ai_rename_config as AIRenameConfig | undefined) || null,
            folderRecommendationConfig: (localSettings.folderRecommendationConfig as FolderRecommendationConfig | undefined) || null
        },
        prompts: {
            basicRename: getPromptEntry(promptSettings, 'basicRename'),
            contextualRename: getPromptEntry(promptSettings, 'contextualRename'),
            folderRecommendation: getPromptEntry(promptSettings, 'folderRecommendation'),
            autoTagging: getPromptEntry(promptSettings, 'autoTagging'),
            conflictResolution: getPromptEntry(promptSettings, 'conflictResolution')
        }
    };
};

export const mergeBackupSnapshots = (
    localSnapshot: BackupSnapshot,
    remoteSnapshot: BackupSnapshot
): MergeResult => {
    const localBookmarks = flattenBookmarks(localSnapshot.bookmarks.roots);
    const remoteBookmarks = flattenBookmarks(remoteSnapshot.bookmarks.roots);
    const mergedBookmarks: Record<string, FlatBookmarkEntity> = {};
    const conflicts: MergeConflict[] = [];
    let autoMergedFields = 0;

    const bookmarkKeys = new Set<string>([
        ...Object.keys(localBookmarks),
        ...Object.keys(remoteBookmarks)
    ]);

    Array.from(bookmarkKeys).sort().forEach((key) => {
        const localEntity = localBookmarks[key];
        const remoteEntity = remoteBookmarks[key];

        if (!localEntity) {
            mergedBookmarks[key] = deepClone(remoteEntity);
            autoMergedFields += 1;
            return;
        }

        if (!remoteEntity) {
            mergedBookmarks[key] = deepClone(localEntity);
            autoMergedFields += 1;
            return;
        }

        if (localEntity.type === 'folder' && remoteEntity.type === 'folder') {
            mergedBookmarks[key] = deepClone(localEntity);
            autoMergedFields += 1;
            return;
        }

        if (localEntity.type !== 'bookmark' || remoteEntity.type !== 'bookmark') {
            mergedBookmarks[key] = deepClone(localEntity);
            conflicts.push({
                id: `bookmarks:${key}:type`,
                section: 'bookmarks',
                entityKey: key,
                field: 'type',
                localValue: deepClone(localEntity),
                remoteValue: deepClone(remoteEntity)
            });
            return;
        }

        const mergedEntity: FlatBookmarkLeafEntity = deepClone(localEntity);

        if (localEntity.title === remoteEntity.title) {
            mergedEntity.title = localEntity.title;
            autoMergedFields += 1;
        } else {
            conflicts.push({
                id: `bookmarks:${key}:title`,
                section: 'bookmarks',
                entityKey: key,
                field: 'title',
                localValue: localEntity.title,
                remoteValue: remoteEntity.title
            });
        }

        mergedEntity.tags = normalizeTags([...localEntity.tags, ...remoteEntity.tags]);
        autoMergedFields += 1;

        mergedBookmarks[key] = mergedEntity;
    });

    const localSettingsFlat: Record<string, unknown> = {};
    const remoteSettingsFlat: Record<string, unknown> = {};
    flattenObject(localSnapshot.settings, '', localSettingsFlat);
    flattenObject(remoteSnapshot.settings, '', remoteSettingsFlat);

    const settingsMerge = mergePrimitiveSection('settings', localSettingsFlat, remoteSettingsFlat, '');

    const localPromptsFlat: Record<string, unknown> = {};
    const remotePromptsFlat: Record<string, unknown> = {};
    flattenObject(localSnapshot.prompts, '', localPromptsFlat);
    flattenObject(remoteSnapshot.prompts, '', remotePromptsFlat);

    const promptsMerge = mergePrimitiveSection('prompts', localPromptsFlat, remotePromptsFlat, '');

    const rebuiltSettings: Record<string, unknown> = {};
    Object.entries(settingsMerge.merged).forEach(([path, value]) => deepSet(rebuiltSettings, path, value));

    const rebuiltPrompts: Record<string, unknown> = {};
    Object.entries(promptsMerge.merged).forEach(([path, value]) => deepSet(rebuiltPrompts, path, value));

    const mergedSnapshot: BackupSnapshot = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        bookmarks: rebuildBookmarksFromFlatEntities(
            mergedBookmarks,
            mergeRootMetadata(localSnapshot.bookmarks.roots, remoteSnapshot.bookmarks.roots)
        ),
        settings: rebuiltSettings as unknown as BackupSettingsFile,
        prompts: {
            ...DEFAULT_PROMPTS_FILE,
            ...(rebuiltPrompts as unknown as BackupPromptsFile)
        }
    };

    return {
        mergedSnapshot,
        conflicts: [
            ...conflicts,
            ...settingsMerge.conflicts,
            ...promptsMerge.conflicts
        ],
        summary: {
            autoMergedFields: autoMergedFields + settingsMerge.autoMergedFields + promptsMerge.autoMergedFields,
            conflictFields: conflicts.length + settingsMerge.conflicts.length + promptsMerge.conflicts.length
        }
    };
};

export const createWebDAVBackup = async (config: WebDAVBackupConfig): Promise<BackupVersionSummary> => {
    const normalizedConfig = {
        ...config,
        baseUrl: normalizeWebDAVBaseUrl(config.baseUrl)
    };
    const snapshot = await collectLocalBackupSnapshot();
    const folderName = createBackupFolderName();
    const manifest = createManifest(snapshot, folderName);

    await ensureVersionDirectory(normalizedConfig, folderName);
    await Promise.all([
        putWebDAVJson(normalizedConfig, `${folderName}/${BACKUP_MANIFEST_FILE}`, manifest),
        putWebDAVJson(normalizedConfig, `${folderName}/${BACKUP_BOOKMARKS_FILE}`, snapshot.bookmarks),
        putWebDAVJson(normalizedConfig, `${folderName}/${BACKUP_SETTINGS_FILE}`, snapshot.settings),
        putWebDAVJson(normalizedConfig, `${folderName}/${BACKUP_PROMPTS_FILE}`, snapshot.prompts)
    ]);

    const versions = await listWebDAVBackups(normalizedConfig);
    const overflow = versions.slice(normalizedConfig.maxVersions);

    for (const version of overflow) {
        await deleteWebDAVDirectory(normalizedConfig, version.folderName);
    }

    return {
        backupId: manifest.backupId,
        folderName: manifest.folderName,
        createdAt: manifest.createdAt,
        counts: manifest.counts
    };
};

export const listWebDAVBackups = async (config: WebDAVBackupConfig): Promise<BackupVersionSummary[]> => {
    const normalizedConfig = {
        ...config,
        baseUrl: normalizeWebDAVBaseUrl(config.baseUrl)
    };
    const folders = await listWebDAVCollections(normalizedConfig);

    const summaries = await Promise.all(
        folders.map(async (folderName) => {
            try {
                const manifest = await readWebDAVJson<BackupManifest>(normalizedConfig, `${folderName}/${BACKUP_MANIFEST_FILE}`);
                return {
                    backupId: manifest.backupId,
                    folderName: manifest.folderName,
                    createdAt: manifest.createdAt,
                    counts: manifest.counts
                } satisfies BackupVersionSummary;
            } catch (error) {
                console.warn(`Failed to read manifest for ${folderName}:`, error);
                return {
                    backupId: folderName,
                    folderName,
                    createdAt: folderName,
                    counts: {
                        roots: 0,
                        folders: 0,
                        bookmarks: 0,
                        tags: 0
                    }
                } satisfies BackupVersionSummary;
            }
        })
    );

    return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const loadWebDAVBackup = async (
    config: WebDAVBackupConfig,
    folderName: string
): Promise<BackupBundle> => {
    const normalizedConfig = {
        ...config,
        baseUrl: normalizeWebDAVBaseUrl(config.baseUrl)
    };

    const manifest = await readWebDAVJson<BackupManifest>(normalizedConfig, `${folderName}/${BACKUP_MANIFEST_FILE}`);
    const [bookmarks, settings, prompts] = await Promise.all([
        readWebDAVJson<BackupBookmarksFile>(normalizedConfig, `${folderName}/${manifest.files.bookmarks}`),
        readWebDAVJson<BackupSettingsFile>(normalizedConfig, `${folderName}/${manifest.files.settings}`),
        readWebDAVJson<BackupPromptsFile>(normalizedConfig, `${folderName}/${manifest.files.prompts}`)
    ]);

    return {
        manifest,
        snapshot: {
            schemaVersion: manifest.schemaVersion,
            createdAt: manifest.createdAt,
            bookmarks,
            settings,
            prompts: {
                ...DEFAULT_PROMPTS_FILE,
                ...prompts
            }
        }
    };
};

const removeBookmarkTreeNode = async (node: BrowserBookmarkTreeNode): Promise<void> => {
    if (node.url) {
        await browser.bookmarks.remove(node.id);
        return;
    }

    await browser.bookmarks.removeTree(node.id);
};

const restoreBookmarkNodes = async (
    parentId: string,
    nodes: BackupBookmarkNode[],
    restoredTagsMap: BookmarkTagsMap,
    allTags: Set<string>
): Promise<void> => {
    for (const node of nodes) {
        if (node.type === 'folder') {
            const createdFolder = await browser.bookmarks.create({
                parentId,
                title: node.title
            });
            await restoreBookmarkNodes(createdFolder.id, node.children, restoredTagsMap, allTags);
            continue;
        }

        const createdBookmark = await browser.bookmarks.create({
            parentId,
            title: node.title,
            url: node.url
        });

        if (node.tags.length > 0) {
            restoredTagsMap[createdBookmark.id] = normalizeTags(node.tags);
            node.tags.forEach((tag) => allTags.add(tag));
        }
    }
};

export const restoreBackupSnapshot = async (
    snapshot: BackupSnapshot,
    mode: 'overwrite' | 'incremental' = 'overwrite'
): Promise<void> => {
    void mode;
    const currentTree = await browser.bookmarks.getTree();
    const currentRoots = currentTree[0]?.children || [];

    for (const root of currentRoots) {
        for (const child of [...(root.children || [])].reverse()) {
            await removeBookmarkTreeNode(child);
        }
    }

    const settingsStorageKeys = [...AI_SETTINGS_STORAGE_KEYS, ...getPromptStorageKeys()];
    await browser.storage.local.remove(settingsStorageKeys as unknown as string[]);

    const nextStorageValues: Record<string, unknown> = {};

    if (snapshot.settings.aiConfig) {
        nextStorageValues.aiConfig = snapshot.settings.aiConfig;
    }
    if (snapshot.settings.aiRenameConfig) {
        nextStorageValues.ai_rename_config = snapshot.settings.aiRenameConfig;
    }
    if (snapshot.settings.folderRecommendationConfig) {
        nextStorageValues.folderRecommendationConfig = snapshot.settings.folderRecommendationConfig;
    }

    Object.assign(nextStorageValues, buildPromptStorageValues(snapshot.prompts));

    if (Object.keys(nextStorageValues).length > 0) {
        await browser.storage.local.set(nextStorageValues);
    }

    const restoredTagsMap: BookmarkTagsMap = {};
    const allTags = new Set<string>();

    for (const root of snapshot.bookmarks.roots) {
        const targetRoot = currentRoots[root.rootIndex];
        if (!targetRoot) {
            console.warn(`Skip restoring root index ${root.rootIndex}, target root is missing.`);
            continue;
        }
        await restoreBookmarkNodes(targetRoot.id, root.children, restoredTagsMap, allTags);
    }

    await storage.setItem(TAGS_STORAGE_KEY, restoredTagsMap);
    await storage.setItem(ALL_TAGS_STORAGE_KEY, Array.from(allTags));
};
