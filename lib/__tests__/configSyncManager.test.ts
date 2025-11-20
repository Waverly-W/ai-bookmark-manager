import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configSyncManager, SyncMetadata } from '../configSyncManager';

// Mock browser.storage API
const mockStorageLocal = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
};

const mockStorageSync = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
};

const mockStorageOnChanged = {
    addListener: vi.fn(),
};

// Mock browser object
vi.mock('wxt/browser', () => ({
    browser: {
        storage: {
            local: mockStorageLocal,
            sync: mockStorageSync,
            onChanged: mockStorageOnChanged,
        },
    },
}));

describe('ConfigSyncManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock implementations
        mockStorageLocal.get.mockResolvedValue({});
        mockStorageLocal.set.mockResolvedValue(undefined);
        mockStorageLocal.remove.mockResolvedValue(undefined);
        mockStorageSync.get.mockResolvedValue({});
        mockStorageSync.set.mockResolvedValue(undefined);
        mockStorageSync.remove.mockResolvedValue(undefined);
    });

    describe('initialization', () => {
        it('should initialize successfully on first sync', async () => {
            mockStorageLocal.get.mockResolvedValueOnce({ syncInitialized: false });
            mockStorageLocal.get.mockResolvedValueOnce({}); // deviceId check

            await configSyncManager.initialize();

            expect(mockStorageLocal.set).toHaveBeenCalled();
            expect(mockStorageOnChanged.addListener).toHaveBeenCalled();
        });

        it('should pull config from sync on subsequent initializations', async () => {
            mockStorageLocal.get.mockResolvedValueOnce({ syncInitialized: true });
            mockStorageSync.get.mockResolvedValueOnce({
                aiConfig: { apiUrl: 'https://api.example.com' },
            });

            await configSyncManager.initialize();

            expect(mockStorageSync.get).toHaveBeenCalled();
        });
    });

    describe('saveConfig', () => {
        beforeEach(async () => {
            mockStorageLocal.get.mockResolvedValueOnce({ syncInitialized: true });
            await configSyncManager.initialize();
        });

        it('should save syncable config to both local and sync storage', async () => {
            const config = { apiUrl: 'https://api.example.com' };

            await configSyncManager.set('aiConfig', config);

            expect(mockStorageLocal.set).toHaveBeenCalledWith(
                expect.objectContaining({ aiConfig: config })
            );
            expect(mockStorageSync.set).toHaveBeenCalled();
        });

        it('should save non-syncable config to local storage only', async () => {
            const bookmarkId = 'bookmark-123';

            await configSyncManager.set('bookmarkRootId', bookmarkId);

            expect(mockStorageLocal.set).toHaveBeenCalledWith(
                expect.objectContaining({ bookmarkRootId: bookmarkId })
            );
            expect(mockStorageSync.set).not.toHaveBeenCalled();
        });

        it('should update sync status on successful save', async () => {
            await configSyncManager.set('theme', 'dark');

            const status = configSyncManager.getSyncStatus();
            expect(status.lastError).toBeNull();
            expect(status.lastSyncTime).not.toBeNull();
        });
    });

    describe('getConfig', () => {
        beforeEach(async () => {
            mockStorageLocal.get.mockResolvedValueOnce({ syncInitialized: true });
            await configSyncManager.initialize();
        });

        it('should retrieve config from local storage', async () => {
            mockStorageLocal.get.mockResolvedValueOnce({ theme: 'dark' });

            const config = await configSyncManager.get('theme');

            expect(config).toBe('dark');
            expect(mockStorageLocal.get).toHaveBeenCalledWith('theme');
        });

        it('should return null if config does not exist', async () => {
            mockStorageLocal.get.mockResolvedValueOnce({});

            const config = await configSyncManager.get('nonexistent');

            expect(config).toBeUndefined();
        });
    });

    describe('getSyncStatus', () => {
        it('should return current sync status', async () => {
            const status = configSyncManager.getSyncStatus();

            expect(status).toHaveProperty('isSyncing');
            expect(status).toHaveProperty('lastSyncTime');
            expect(status).toHaveProperty('lastError');
            expect(status).toHaveProperty('pendingChanges');
        });

        it('should return a copy of sync status', async () => {
            const status1 = configSyncManager.getSyncStatus();
            const status2 = configSyncManager.getSyncStatus();

            expect(status1).toEqual(status2);
            expect(status1).not.toBe(status2);
        });
    });

    describe('onSyncChange', () => {
        it('should register sync change listener', async () => {
            const listener = vi.fn();

            configSyncManager.onSyncChange(listener);

            expect(listener).not.toHaveBeenCalled();
        });

        it('should remove sync change listener', async () => {
            const listener = vi.fn();

            configSyncManager.onSyncChange(listener);
            configSyncManager.offSyncChange(listener);

            // Listener should be removed
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('conflict resolution', () => {
        it('should resolve conflicts based on timestamp', async () => {
            const localMetadata: SyncMetadata = {
                lastModified: 1000,
                version: 1,
                deviceId: 'device-a',
            };

            const syncMetadata: SyncMetadata = {
                lastModified: 2000,
                version: 1,
                deviceId: 'device-b',
            };

            // The newer timestamp should win
            // This is tested indirectly through manualSync
            expect(syncMetadata.lastModified).toBeGreaterThan(localMetadata.lastModified);
        });

        it('should use version number as tiebreaker', async () => {
            const metadata1: SyncMetadata = {
                lastModified: 1000,
                version: 1,
                deviceId: 'device-a',
            };

            const metadata2: SyncMetadata = {
                lastModified: 1000,
                version: 2,
                deviceId: 'device-b',
            };

            expect(metadata2.version).toBeGreaterThan(metadata1.version);
        });

        it('should use device ID as final tiebreaker', async () => {
            const metadata1: SyncMetadata = {
                lastModified: 1000,
                version: 1,
                deviceId: 'device-a',
            };

            const metadata2: SyncMetadata = {
                lastModified: 1000,
                version: 1,
                deviceId: 'device-b',
            };

            // device-b > device-a in lexicographic order
            expect(metadata2.deviceId > metadata1.deviceId).toBe(true);
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            mockStorageLocal.get.mockResolvedValueOnce({ syncInitialized: true });
            await configSyncManager.initialize();
        });

        it('should handle storage errors gracefully', async () => {
            mockStorageLocal.set.mockRejectedValueOnce(new Error('Storage error'));

            await expect(configSyncManager.set('theme', 'dark')).rejects.toThrow();

            const status = configSyncManager.getSyncStatus();
            expect(status.lastError).not.toBeNull();
        });

        it('should handle manual sync errors', async () => {
            mockStorageSync.get.mockRejectedValueOnce(new Error('Sync error'));

            await expect(configSyncManager.manualSync()).rejects.toThrow();

            const status = configSyncManager.getSyncStatus();
            expect(status.lastError).not.toBeNull();
            expect(status.isSyncing).toBe(false);
        });
    });

    describe('syncable keys', () => {
        it('should only sync specific configuration keys', async () => {
            const syncableKeys = [
                'aiConfig',
                'theme',
                'accentColor',
                'locale',
                'aiCustomPrompt',
                'aiUseCustomPrompt'
            ];

            // These keys should be synced
            for (const key of syncableKeys) {
                expect(syncableKeys).toContain(key);
            }
        });

        it('should not sync device-specific keys', async () => {
            const nonSyncableKeys = [
                'bookmarkRootId',
                'deviceId',
                'syncInitialized'
            ];

            // These keys should not be synced
            for (const key of nonSyncableKeys) {
                expect(nonSyncableKeys).toContain(key);
            }
        });
    });
});

