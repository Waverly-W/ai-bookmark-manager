import { browser } from "wxt/browser";

/**
 * 同步元数据接口
 */
export interface SyncMetadata {
  lastModified: number;      // 时间戳
  version: number;           // 版本号
  deviceId: string;          // 设备标识
}

/**
 * 同步状态接口
 */
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastError: string | null;
  pendingChanges: number;
}

/**
 * 同步变更接口
 */
export interface SyncChanges {
  [key: string]: {
    oldValue: any;
    newValue: any;
    source: 'local' | 'sync';
  };
}

/**
 * 配置同步管理器
 * 单例模式，管理配置的本地和跨设备同步
 */
class ConfigSyncManager {
  private static instance: ConfigSyncManager;
  private syncStatus: SyncStatus;
  private changeListeners: Set<(changes: SyncChanges) => void>;
  private deviceId: string = '';
  private initialized: boolean = false;

  // 需要同步的配置键
  private syncableKeys = [
    'aiConfig',
    'theme',
    'accentColor',
    'locale',
    'aiCustomPrompt',
    'aiUseCustomPrompt'
  ];

  private constructor() {
    this.syncStatus = {
      isSyncing: false,
      lastSyncTime: null,
      lastError: null,
      pendingChanges: 0
    };
    this.changeListeners = new Set();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ConfigSyncManager {
    if (!ConfigSyncManager.instance) {
      ConfigSyncManager.instance = new ConfigSyncManager();
    }
    return ConfigSyncManager.instance;
  }

  /**
   * 初始化同步管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 1. 获取或生成设备ID
      this.deviceId = await this.getOrCreateDeviceId();

      // 2. 检查是否首次同步
      const isFirstSync = await this.isFirstSync();

      if (isFirstSync) {
        // 将本地配置上传到 sync
        await this.uploadLocalConfigToSync();
      } else {
        // 从 sync 拉取配置
        await this.pullConfigFromSync();
      }

      // 3. 监听 storage 变更
      this.setupStorageListener();

      this.initialized = true;
      console.log('ConfigSyncManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ConfigSyncManager:', error);
      throw error;
    }
  }

  /**
   * 保存配置（自动同步）
   */
  async saveConfig(key: string, value: any): Promise<void> {
    if (!this.syncableKeys.includes(key)) {
      // 非同步配置，只保存到 local
      await browser.storage.local.set({ [key]: value });
      return;
    }

    try {
      // 1. 保存到 local
      await browser.storage.local.set({ [key]: value });

      // 2. 准备同步元数据
      const metadata: SyncMetadata = {
        lastModified: Date.now(),
        version: await this.getNextVersion(key),
        deviceId: this.deviceId
      };

      // 3. 上传到 sync
      const syncKey = key;
      const metadataKey = `${key}__metadata`;

      await browser.storage.sync.set({
        [syncKey]: value,
        [metadataKey]: metadata
      });

      // 4. 更新同步状态
      this.syncStatus.lastSyncTime = Date.now();
      this.syncStatus.lastError = null;

      console.log(`Config saved: ${key}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.syncStatus.lastError = errorMsg;
      console.error(`Failed to save config ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取配置
   */
  async getConfig(key: string): Promise<any> {
    try {
      // 优先从 local 读取
      const localResult = await browser.storage.local.get(key);
      return localResult[key];
    } catch (error) {
      console.error(`Failed to get config ${key}:`, error);
      return null;
    }
  }

  /**
   * 手动同步
   */
  async manualSync(): Promise<void> {
    if (this.syncStatus.isSyncing) {
      console.warn('Sync already in progress');
      return;
    }

    this.syncStatus.isSyncing = true;

    try {
      // 1. 从 sync 拉取所有配置
      const syncData = await browser.storage.sync.get(null);

      // 2. 比较并解决冲突
      const conflicts = await this.detectConflicts(syncData);
      const resolved = await this.resolveConflicts(conflicts);

      // 3. 应用更新
      await this.applyChanges(resolved);

      this.syncStatus.lastSyncTime = Date.now();
      this.syncStatus.lastError = null;

      console.log('Manual sync completed successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.syncStatus.lastError = errorMsg;
      console.error('Manual sync failed:', error);
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 监听同步变更
   */
  onSyncChange(callback: (changes: SyncChanges) => void): void {
    this.changeListeners.add(callback);
  }

  /**
   * 移除监听
   */
  offSyncChange(callback: (changes: SyncChanges) => void): void {
    this.changeListeners.delete(callback);
  }

  // ==================== 私有方法 ====================

  /**
   * 获取或创建设备ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    try {
      const result = await browser.storage.local.get('deviceId');
      if (result.deviceId) {
        return result.deviceId;
      }

      const deviceId = this.generateUUID();
      await browser.storage.local.set({ deviceId });
      return deviceId;
    } catch (error) {
      console.error('Failed to get or create device ID:', error);
      throw error;
    }
  }

  /**
   * 检查是否首次同步
   */
  private async isFirstSync(): Promise<boolean> {
    try {
      const result = await browser.storage.local.get('syncInitialized');
      return !result.syncInitialized;
    } catch (error) {
      console.error('Failed to check first sync:', error);
      return true;
    }
  }

  /**
   * 上传本地配置到 sync
   */
  private async uploadLocalConfigToSync(): Promise<void> {
    try {
      for (const key of this.syncableKeys) {
        const result = await browser.storage.local.get(key);
        if (result[key]) {
          const metadata: SyncMetadata = {
            lastModified: Date.now(),
            version: 1,
            deviceId: this.deviceId
          };

          await browser.storage.sync.set({
            [key]: result[key],
            [`${key}__metadata`]: metadata
          });
        }
      }

      await browser.storage.local.set({ syncInitialized: true });
      console.log('Local config uploaded to sync');
    } catch (error) {
      console.error('Failed to upload local config to sync:', error);
      throw error;
    }
  }

  /**
   * 从 sync 拉取配置
   */
  private async pullConfigFromSync(): Promise<void> {
    try {
      const syncData = await browser.storage.sync.get(null);

      for (const key of this.syncableKeys) {
        if (syncData[key]) {
          await browser.storage.local.set({ [key]: syncData[key] });
        }
      }

      console.log('Config pulled from sync');
    } catch (error) {
      console.error('Failed to pull config from sync:', error);
      throw error;
    }
  }

  /**
   * 设置 storage 监听器
   */
  private setupStorageListener(): void {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        this.handleSyncChanges(changes);
      }
    });
  }

  /**
   * 处理 sync 存储变更
   */
  private async handleSyncChanges(changes: any): Promise<void> {
    try {
      const syncChanges: SyncChanges = {};

      for (const [key, change] of Object.entries(changes)) {
        // 跳过元数据键
        if (key.endsWith('__metadata')) continue;

        syncChanges[key] = {
          oldValue: change.oldValue,
          newValue: change.newValue,
          source: 'sync'
        };

        // 应用到 local
        if (change.newValue !== undefined) {
          await browser.storage.local.set({ [key]: change.newValue });
        }
      }

      // 通知监听器
      this.changeListeners.forEach(listener => {
        try {
          listener(syncChanges);
        } catch (error) {
          console.error('Error in sync change listener:', error);
        }
      });

      console.log('Sync changes applied:', Object.keys(syncChanges));
    } catch (error) {
      console.error('Failed to handle sync changes:', error);
    }
  }

  /**
   * 检测冲突
   */
  private async detectConflicts(syncData: any): Promise<any[]> {
    try {
      const conflicts = [];

      for (const key of this.syncableKeys) {
        const localResult = await browser.storage.local.get(key);
        const localValue = localResult[key];
        const syncValue = syncData[key];

        if (localValue && syncValue && JSON.stringify(localValue) !== JSON.stringify(syncValue)) {
          conflicts.push({
            key,
            localValue,
            syncValue,
            localMetadata: syncData[`${key}__metadata`],
            syncMetadata: syncData[`${key}__metadata`]
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Failed to detect conflicts:', error);
      return [];
    }
  }

  /**
   * 解决冲突
   */
  private async resolveConflicts(conflicts: any[]): Promise<any> {
    try {
      const resolved = {};

      for (const conflict of conflicts) {
        const winner = this.compareMetadata(
          conflict.localMetadata,
          conflict.syncMetadata
        );

        resolved[conflict.key] = winner === 'local'
          ? conflict.localValue
          : conflict.syncValue;
      }

      return resolved;
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
      return {};
    }
  }

  /**
   * 比较元数据，确定优先级
   */
  private compareMetadata(local: SyncMetadata, sync: SyncMetadata): 'local' | 'sync' {
    // 比较时间戳
    if (local.lastModified > sync.lastModified) return 'local';
    if (sync.lastModified > local.lastModified) return 'sync';

    // 比较版本号
    if (local.version > sync.version) return 'local';
    if (sync.version > local.version) return 'sync';

    // 比较设备ID（字典序）
    return local.deviceId > sync.deviceId ? 'local' : 'sync';
  }

  /**
   * 应用变更
   */
  private async applyChanges(changes: any): Promise<void> {
    try {
      for (const [key, value] of Object.entries(changes)) {
        await browser.storage.local.set({ [key]: value });
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
      throw error;
    }
  }

  /**
   * 获取下一个版本号
   */
  private async getNextVersion(key: string): Promise<number> {
    try {
      const versionKey = `${key}__version`;
      const result = await browser.storage.local.get(versionKey);
      const currentVersion = result[versionKey] || 0;
      const nextVersion = currentVersion + 1;
      await browser.storage.local.set({ [versionKey]: nextVersion });
      return nextVersion;
    } catch (error) {
      console.error('Failed to get next version:', error);
      return 1;
    }
  }

  /**
   * 生成UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// 导出单例
export const configSyncManager = ConfigSyncManager.getInstance();

