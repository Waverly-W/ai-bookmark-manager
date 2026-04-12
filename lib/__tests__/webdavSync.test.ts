import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
    browser: {
        storage: {
            local: {
                get: vi.fn(),
                set: vi.fn(),
                remove: vi.fn()
            }
        },
        bookmarks: {
            getTree: vi.fn(),
            remove: vi.fn(),
            removeTree: vi.fn(),
            create: vi.fn()
        }
    }
}));

vi.mock('wxt/storage', () => ({
    storage: {
        getItem: vi.fn(),
        setItem: vi.fn()
    }
}));

import type { BackupSnapshot, MergeConflict } from '../webdavSync';
import {
    applyAIConflictResolutions,
    mergeBackupSnapshots
} from '../webdavSync';

const createSnapshot = (
    overrides: Partial<BackupSnapshot> = {}
): BackupSnapshot => ({
    schemaVersion: 1,
    createdAt: '2026-04-12T00:00:00.000Z',
    bookmarks: {
        roots: [
            {
                rootIndex: 0,
                title: 'Bookmarks Bar',
                children: [
                    {
                        type: 'folder',
                        title: 'Dev',
                        children: [
                            {
                                type: 'bookmark',
                                title: 'React Local',
                                url: 'https://react.dev',
                                tags: ['react']
                            }
                        ]
                    }
                ]
            }
        ]
    },
    settings: {
        aiConfig: {
            apiUrl: 'https://api.example.com/v1',
            modelId: 'gpt-local'
        },
        aiRenameConfig: {
            useReferenceNaming: true
        },
        folderRecommendationConfig: {
            enabled: true,
            showReason: true,
            autoApply: true,
            fallbackToDefault: true,
            timeoutMs: 10000,
            maxRecommendations: 3
        }
    },
    prompts: {
        basicRename: {
            useCustom: true,
            customPrompt: 'Local rename prompt'
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
    },
    ...overrides
});

describe('webdavSync merge helpers', () => {
    it('auto merges additions and tags while surfacing field-level conflicts', () => {
        const local = createSnapshot();
        const remote = createSnapshot({
            bookmarks: {
                roots: [
                    {
                        rootIndex: 0,
                        title: 'Bookmarks Bar',
                        children: [
                            {
                                type: 'folder',
                                title: 'Dev',
                                children: [
                                    {
                                        type: 'bookmark',
                                        title: 'React Remote',
                                        url: 'https://react.dev',
                                        tags: ['frontend', 'react']
                                    },
                                    {
                                        type: 'bookmark',
                                        title: 'TypeScript',
                                        url: 'https://www.typescriptlang.org',
                                        tags: ['typescript']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            settings: {
                aiConfig: {
                    apiUrl: 'https://api.example.com/v1',
                    modelId: 'gpt-remote'
                },
                aiRenameConfig: {
                    useReferenceNaming: true
                },
                folderRecommendationConfig: {
                    enabled: true,
                    showReason: true,
                    autoApply: true,
                    fallbackToDefault: true,
                    timeoutMs: 10000,
                    maxRecommendations: 3
                }
            },
            prompts: {
                basicRename: {
                    useCustom: true,
                    customPrompt: 'Local rename prompt'
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
                    useCustom: true,
                    customPrompt: 'Remote conflict prompt'
                }
            }
        });

        const result = mergeBackupSnapshots(local, remote);
        const mergedFolder = result.mergedSnapshot.bookmarks.roots[0].children[0];

        expect(result.conflicts.map((conflict) => conflict.id)).toEqual([
            'bookmarks:bookmark::0/Dev::https%3A%2F%2Freact.dev:title',
            'settings:aiConfig.modelId',
            'prompts:conflictResolution.customPrompt',
            'prompts:conflictResolution.useCustom'
        ]);

        expect(mergedFolder.type).toBe('folder');
        if (mergedFolder.type !== 'folder') {
            throw new Error('Expected merged folder');
        }

        const reactBookmark = mergedFolder.children.find(
            (node) => node.type === 'bookmark' && node.url === 'https://react.dev'
        );
        expect(reactBookmark).toMatchObject({
            type: 'bookmark',
            title: 'React Local',
            tags: ['react', 'frontend']
        });

        const typescriptBookmark = mergedFolder.children.find(
            (node) => node.type === 'bookmark' && node.url === 'https://www.typescriptlang.org'
        );
        expect(typescriptBookmark).toMatchObject({
            type: 'bookmark',
            title: 'TypeScript',
            tags: ['typescript']
        });
    });

    it('applies AI resolutions back onto the merged snapshot', () => {
        const local = createSnapshot();
        const remote = createSnapshot({
            bookmarks: {
                roots: [
                    {
                        rootIndex: 0,
                        title: 'Bookmarks Bar',
                        children: [
                            {
                                type: 'folder',
                                title: 'Dev',
                                children: [
                                    {
                                        type: 'bookmark',
                                        title: 'React Remote',
                                        url: 'https://react.dev',
                                        tags: ['frontend', 'react']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            settings: {
                aiConfig: {
                    apiUrl: 'https://api.example.com/v1',
                    modelId: 'gpt-remote'
                },
                aiRenameConfig: {
                    useReferenceNaming: true
                },
                folderRecommendationConfig: {
                    enabled: true,
                    showReason: true,
                    autoApply: true,
                    fallbackToDefault: true,
                    timeoutMs: 10000,
                    maxRecommendations: 3
                }
            },
            prompts: {
                basicRename: {
                    useCustom: true,
                    customPrompt: 'Local rename prompt'
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
                    useCustom: true,
                    customPrompt: 'Remote conflict prompt'
                }
            }
        });

        const mergeResult = mergeBackupSnapshots(local, remote);
        const resolutions = mergeResult.conflicts.map((conflict): {
            conflictId: string;
            chosenSource: 'local' | 'remote' | 'hybrid';
            mergedValue: unknown;
            reason: string;
        } => {
            const overrides: Record<string, unknown> = {
                'bookmarks:bookmark::0/Dev::https%3A%2F%2Freact.dev:title': 'React Docs',
                'settings:aiConfig.modelId': 'gpt-4.1',
                'prompts:conflictResolution.useCustom': true,
                'prompts:conflictResolution.customPrompt': 'Merged conflict prompt'
            };

            return {
                conflictId: conflict.id,
                chosenSource: conflict.id.startsWith('bookmarks:') ? 'hybrid' : 'remote',
                mergedValue: overrides[conflict.id],
                reason: 'Resolved for test'
            };
        });

        const resolved = applyAIConflictResolutions(
            mergeResult.mergedSnapshot,
            mergeResult.conflicts as MergeConflict[],
            resolutions
        );

        const mergedFolder = resolved.bookmarks.roots[0].children[0];
        expect(mergedFolder.type).toBe('folder');
        if (mergedFolder.type !== 'folder') {
            throw new Error('Expected merged folder');
        }

        expect(mergedFolder.children[0]).toMatchObject({
            type: 'bookmark',
            title: 'React Docs',
            tags: ['react', 'frontend']
        });
        expect(resolved.settings.aiConfig).toMatchObject({
            modelId: 'gpt-4.1'
        });
        expect(resolved.prompts.conflictResolution).toEqual({
            useCustom: true,
            customPrompt: 'Merged conflict prompt'
        });
    });
});
