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
  private readonly APP_SETTINGS_KEY = 'app_settings';

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

      // 2. 尝试迁移旧数据
      await this.migrateOldSyncData();

      // 3. 检查是否需要从 Sync 恢复 (本地无数据或强制恢复)
      const isFirstSync = await this.isFirstSync();

      if (isFirstSync) {
        console.log('First sync detected, attempting to restore from sync...');
        await this.restoreFromSync();
      } else {
        console.log('Sync already initialized');
      }

      // 4. 监听 storage 变更
      this.setupStorageListener();

      this.initialized = true;
      console.log('ConfigSyncManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ConfigSyncManager:', error);
      // 初始化失败不应阻断应用启动，但记录错误
    }
  }

  /**
   * 保存配置（自动同步）
   */
  async set(key: string, value: any): Promise<void> {
    try {
      // 1. 保存到 local (快速响应)
      await browser.storage.local.set({ [key]: value });

      // 2. 更新到 Sync 的 app_settings
      await this.updateSyncSettings(key, value);

      // 3. 更新同步状态
      this.syncStatus.lastSyncTime = Date.now();
      this.syncStatus.lastError = null;

      console.log(`Config saved and synced: ${key}`);
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
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // 优先从 local 读取
      const localResult = await browser.storage.local.get(key);
      return localResult[key] as T;
    } catch (error) {
      console.error(`Failed to get config ${key}:`, error);
      return null;
    }
  }

  /**
   * 获取原始同步数据 (用于调试/查看)
   */
  async getRawSyncData(): Promise<any> {
    try {
      const syncResult = await browser.storage.sync.get(this.APP_SETTINGS_KEY);
      return syncResult[this.APP_SETTINGS_KEY] || {};
    } catch (error) {
      console.error('Failed to get raw sync data:', error);
      return {};
    }
  }

  /**
   * 手动同步 (强制从 Sync 拉取并覆盖本地)
   */
  async manualSync(): Promise<void> {
    if (this.syncStatus.isSyncing) {
      console.warn('Sync already in progress');
      return;
    }

    this.syncStatus.isSyncing = true;

    try {
      await this.restoreFromSync();
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
      // 如果失败，返回一个临时 ID，不阻断流程
      return this.generateUUID();
    }
  }

  /**
   * 检查是否首次同步 (本地是否已初始化)
   */
  private async isFirstSync(): Promise<boolean> {
    try {
      const result = await browser.storage.local.get('syncInitialized');
      return !result.syncInitialized;
    } catch (error) {
      return true;
    }
  }

  /**
   * 迁移旧的同步数据到新的 app_settings 结构
   */
  private async migrateOldSyncData(): Promise<void> {
    try {
      // 检查是否已经存在 app_settings
      const syncResult = await browser.storage.sync.get(this.APP_SETTINGS_KEY);
      if (syncResult[this.APP_SETTINGS_KEY]) {
        return; // 已存在新结构，无需迁移
      }

      console.log('Checking for old sync data to migrate...');

      // 旧的 key 列表
      const oldKeys = [
        'aiConfig',
        'theme',
        'accentColor',
        'locale',
        'aiCustomPrompt',
        'aiUseCustomPrompt'
      ];

      const oldData = await browser.storage.sync.get(oldKeys);
      const migratedSettings: Record<string, any> = {};
      let hasData = false;

      for (const key of oldKeys) {
        if (oldData[key] !== undefined) {
          migratedSettings[key] = oldData[key];
          hasData = true;
        }
      }

      if (hasData) {
        console.log('Migrating old sync data:', Object.keys(migratedSettings));

        // 添加元数据
        migratedSettings._metadata = {
          lastModified: Date.now(),
          deviceId: this.deviceId,
          version: 1,
          migrated: true
        };

        // 保存到新结构
        await browser.storage.sync.set({ [this.APP_SETTINGS_KEY]: migratedSettings });

        // 可选：清理旧数据 (为了安全起见，暂不清理，或者稍后清理)
        // await browser.storage.sync.remove(oldKeys);
        console.log('Migration completed successfully');
      }
    } catch (error) {
      console.error('Failed to migrate old sync data:', error);
    }
  }

  /**
   * 从 Sync 恢复配置到本地
   */
  private async restoreFromSync(): Promise<void> {
    try {
      const syncResult = await browser.storage.sync.get(this.APP_SETTINGS_KEY);
      const appSettings = syncResult[this.APP_SETTINGS_KEY];

      if (appSettings && typeof appSettings === 'object') {
        const updates: Record<string, any> = {};

        // 遍历 app_settings 中的所有键值对
        for (const [key, value] of Object.entries(appSettings)) {
          // 跳过元数据
          if (key === '_metadata') continue;
          updates[key] = value;
        }

        if (Object.keys(updates).length > 0) {
          await browser.storage.local.set(updates);
          console.log('Restored settings from sync:', Object.keys(updates));
        }
      }

      // 标记为已初始化
      await browser.storage.local.set({ syncInitialized: true });

      // 更新同步状态时间
      this.syncStatus.lastSyncTime = Date.now();
      this.syncStatus.lastError = null;
    } catch (error) {
      console.error('Failed to restore from sync:', error);
      throw error;
    }
  }

  /**
   * 更新 Sync 中的设置
   */
  private async updateSyncSettings(key: string, value: any): Promise<void> {
    try {
      // 1. 获取当前的 app_settings
      const syncResult = await browser.storage.sync.get(this.APP_SETTINGS_KEY);
      const currentSettings = syncResult[this.APP_SETTINGS_KEY] || {};

      // 2. 更新值和元数据
      const newSettings = {
        ...currentSettings,
        [key]: value,
        _metadata: {
          lastModified: Date.now(),
          deviceId: this.deviceId,
          version: (currentSettings._metadata?.version || 0) + 1
        }
      };

      // 3. 保存回 Sync
      await browser.storage.sync.set({ [this.APP_SETTINGS_KEY]: newSettings });
    } catch (error) {
      console.error('Failed to update sync settings:', error);
      // 不抛出错误，以免影响本地保存
    }
  }

  /**
   * 设置 storage 监听器
   */
  private setupStorageListener(): void {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes[this.APP_SETTINGS_KEY]) {
        this.handleSyncChanges(changes[this.APP_SETTINGS_KEY]);
      }
    });
  }

  /**
   * 处理 Sync 变更
   */
  private async handleSyncChanges(change: any): Promise<void> {
    try {
      const newValue = change.newValue;
      const oldValue = change.oldValue;

      if (!newValue) return; // 被删除了？暂不处理删除

      // 检查是否是本设备产生的变更 (避免循环更新)
      if (newValue._metadata?.deviceId === this.deviceId) {
        return;
      }

      const syncChanges: SyncChanges = {};
      const updates: Record<string, any> = {};

      // 比较新旧值，找出变更的字段
      // 如果是首次同步下来（oldValue 为空），则所有字段都视为变更
      const keysToCheck = new Set([
        ...Object.keys(newValue),
        ...(oldValue ? Object.keys(oldValue) : [])
      ]);

      for (const key of keysToCheck) {
        if (key === '_metadata') continue;

        const newVal = newValue[key];
        const oldVal = oldValue ? oldValue[key] : undefined;

        // 简单的值比较 (JSON stringify)
        if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
          syncChanges[key] = {
            oldValue: oldVal,
            newValue: newVal,
            source: 'sync'
          };

          if (newVal !== undefined) {
            updates[key] = newVal;
          }
        }
      }

      // 应用变更到本地
      if (Object.keys(updates).length > 0) {
        await browser.storage.local.set(updates);
        console.log('Applied sync updates:', Object.keys(updates));

        // 通知监听器
        this.changeListeners.forEach(listener => {
          try {
            listener(syncChanges);
          } catch (error) {
            console.error('Error in sync change listener:', error);
          }
        });

        // 更新同步时间
        this.syncStatus.lastSyncTime = Date.now();
      }
    } catch (error) {
      console.error('Failed to handle sync changes:', error);
    }
  }

  /**
   * 生成UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// 导出单例
export const configSyncManager = ConfigSyncManager.getInstance();

