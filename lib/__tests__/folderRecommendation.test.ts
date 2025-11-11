import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendFolder, batchRecommendFolders } from '../folderRecommendation';
import { BookmarkFolder } from '../bookmarkUtils';
import { AIConfig } from '../aiConfigUtils';

// Mock dependencies
vi.mock('../aiConfigUtils', () => ({
    isAIConfigured: vi.fn(),
    getAIConfig: vi.fn()
}));

vi.mock('../aiPromptUtils', () => ({
    getCurrentFolderRecommendationPrompt: vi.fn(),
    formatFolderListForPrompt: vi.fn(),
    formatFolderRecommendationPrompt: vi.fn()
}));

describe('folderRecommendation', () => {
    const mockFolders: BookmarkFolder[] = [
        {
            id: '1',
            title: '书签栏',
            path: '书签栏',
            level: 0
        },
        {
            id: '2',
            title: '工作',
            path: '工作',
            level: 0,
            children: [
                {
                    id: '3',
                    title: '项目',
                    path: '工作 > 项目',
                    level: 1
                }
            ]
        },
        {
            id: '4',
            title: '学习',
            path: '学习',
            level: 0
        }
    ];

    const mockAIConfig: AIConfig = {
        apiUrl: 'https://api.example.com',
        apiKey: 'test-key',
        modelId: 'gpt-3.5-turbo'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('recommendFolder', () => {
        it('should return error when page context is invalid', async () => {
            const result = await recommendFolder(
                { url: '', title: '' },
                mockFolders,
                mockAIConfig
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('URL and title are required');
        });

        it('should return error when folders list is empty', async () => {
            const result = await recommendFolder(
                { url: 'https://example.com', title: 'Example' },
                [],
                mockAIConfig
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('No folders available');
        });

        it('should fallback to default folder when AI is not configured', async () => {
            const { isAIConfigured } = await import('../aiConfigUtils');
            vi.mocked(isAIConfigured).mockResolvedValue(false);

            const result = await recommendFolder(
                { url: 'https://example.com', title: 'Example' },
                mockFolders,
                mockAIConfig,
                { fallbackToDefault: true }
            );

            expect(result.success).toBe(true);
            expect(result.fallback).toBe(true);
            expect(result.recommendations).toBeDefined();
            expect(result.recommendations?.length).toBe(1);
            expect(result.recommendations?.[0].folderId).toBe('1');
        });

        it('should return error when AI is not configured and fallback is disabled', async () => {
            const { isAIConfigured } = await import('../aiConfigUtils');
            vi.mocked(isAIConfigured).mockResolvedValue(false);

            const result = await recommendFolder(
                { url: 'https://example.com', title: 'Example' },
                mockFolders,
                mockAIConfig,
                { fallbackToDefault: false }
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('AI not configured');
        });

        it('should handle timeout gracefully', async () => {
            const { isAIConfigured } = await import('../aiConfigUtils');
            vi.mocked(isAIConfigured).mockResolvedValue(true);

            const { getCurrentFolderRecommendationPrompt, formatFolderListForPrompt, formatFolderRecommendationPrompt } = await import('../aiPromptUtils');
            vi.mocked(getCurrentFolderRecommendationPrompt).mockResolvedValue('test prompt');
            vi.mocked(formatFolderListForPrompt).mockReturnValue('1. 书签栏\n2. 工作');
            vi.mocked(formatFolderRecommendationPrompt).mockReturnValue('formatted prompt');

            // Mock fetch to timeout
            global.fetch = vi.fn(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 100)
                )
            ) as any;

            const result = await recommendFolder(
                { url: 'https://example.com', title: 'Example' },
                mockFolders,
                mockAIConfig,
                { timeoutMs: 50, fallbackToDefault: true }
            );

            expect(result.success).toBe(true);
            expect(result.fallback).toBe(true);
        });
    });

    describe('batchRecommendFolders', () => {
        it('should process multiple bookmarks', async () => {
            const { isAIConfigured } = await import('../aiConfigUtils');
            vi.mocked(isAIConfigured).mockResolvedValue(false);

            const bookmarks = [
                { id: '1', url: 'https://example1.com', title: 'Example 1' },
                { id: '2', url: 'https://example2.com', title: 'Example 2' }
            ];

            const results = await batchRecommendFolders(
                bookmarks,
                mockFolders,
                mockAIConfig,
                undefined,
                { fallbackToDefault: true }
            );

            expect(results).toHaveLength(2);
            expect(results[0].bookmarkId).toBe('1');
            expect(results[1].bookmarkId).toBe('2');
        });

        it('should call progress callback', async () => {
            const { isAIConfigured } = await import('../aiConfigUtils');
            vi.mocked(isAIConfigured).mockResolvedValue(false);

            const bookmarks = [
                { id: '1', url: 'https://example1.com', title: 'Example 1' },
                { id: '2', url: 'https://example2.com', title: 'Example 2' }
            ];

            const onProgress = vi.fn();

            await batchRecommendFolders(
                bookmarks,
                mockFolders,
                mockAIConfig,
                onProgress,
                { fallbackToDefault: true }
            );

            expect(onProgress).toHaveBeenCalledTimes(2);
            expect(onProgress).toHaveBeenCalledWith(1, 2);
            expect(onProgress).toHaveBeenCalledWith(2, 2);
        });

        it('should handle cancellation', async () => {
            const { isAIConfigured } = await import('../aiConfigUtils');
            vi.mocked(isAIConfigured).mockResolvedValue(false);

            const bookmarks = [
                { id: '1', url: 'https://example1.com', title: 'Example 1' },
                { id: '2', url: 'https://example2.com', title: 'Example 2' },
                { id: '3', url: 'https://example3.com', title: 'Example 3' }
            ];

            const controller = new AbortController();

            // Abort after first bookmark
            setTimeout(() => controller.abort(), 100);

            const results = await batchRecommendFolders(
                bookmarks,
                mockFolders,
                mockAIConfig,
                undefined,
                { signal: controller.signal, fallbackToDefault: true }
            );

            // Should have processed at least one bookmark before cancellation
            expect(results.length).toBeGreaterThan(0);

            // Check if any bookmarks were cancelled
            const cancelledResults = results.filter(r => r.error === 'Batch recommendation cancelled');
            expect(cancelledResults.length).toBeGreaterThan(0);
        });
    });
});

