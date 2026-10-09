import { browser } from 'wxt/browser';

import {
  defaultSettings,
  settingsSchema,
  type Settings,
} from '../contracts/settings';
import { r2RuntimeSettingsSchema } from '../image-host/r2-settings';
import {
  settingsMutationLock,
  type SettingsMutationLock,
} from './lock';

export const SETTINGS_STORAGE_KEY = 'web-to-obsidian.settings.v1';

export interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface BrowserStorageLike {
  local: StorageAreaLike;
}

export type SettingsRepositoryErrorCode =
  | 'INVALID_SETTINGS'
  | 'INVALID_STORED_SETTINGS';

export class SettingsRepositoryError extends Error {
  constructor(
    readonly code: SettingsRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SettingsRepositoryError';
  }
}

/**
 * Excludes dedicated credential fields. Configured URL paths are preserved
 * verbatim, so callers must not place secrets in URL paths.
 */
export type SafeSettings = {
  version: 1;
  model: Settings['model'];
  imageHost:
    | Extract<Settings['imageHost'], { kind: 'picgo' }>
    | Omit<Extract<Settings['imageHost'], { kind: 'r2' }>, 'accessKeyId' | 'secretAccessKey'>;
  vault: Settings['vault'];
};

export class SettingsRepository {
  constructor(
    private readonly storageArea: StorageAreaLike,
    private readonly mutationLock: SettingsMutationLock = settingsMutationLock,
  ) {}

  async load(): Promise<Settings> {
    const stored = await this.storageArea.get(SETTINGS_STORAGE_KEY);

    if (!Object.hasOwn(stored, SETTINGS_STORAGE_KEY)) {
      return settingsSchema.parse(defaultSettings);
    }

    try {
      return settingsSchema.parse(stored[SETTINGS_STORAGE_KEY]);
    } catch (error) {
      throw new SettingsRepositoryError(
        'INVALID_STORED_SETTINGS',
        'Stored settings are corrupt or use an unsupported version.',
        { cause: error },
      );
    }
  }

  async save(settings: unknown): Promise<void> {
    let validated: Settings;

    try {
      validated = settingsSchema.parse(settings);
    } catch (error) {
      throw new SettingsRepositoryError(
        'INVALID_SETTINGS',
        'Settings did not pass validation.',
        { cause: error },
      );
    }

    await this.storageArea.set({ [SETTINGS_STORAGE_KEY]: validated });
  }

  async ensureStoredDefaults(): Promise<Settings> {
    return this.mutationLock.run(async () => {
      const stored = await this.storageArea.get(SETTINGS_STORAGE_KEY);
      if (
        !Object.hasOwn(stored, SETTINGS_STORAGE_KEY)
        || stored[SETTINGS_STORAGE_KEY] === undefined
      ) {
        const defaults = settingsSchema.parse(defaultSettings);
        await this.storageArea.set({ [SETTINGS_STORAGE_KEY]: defaults });
        return defaults;
      }
      try {
        return settingsSchema.parse(stored[SETTINGS_STORAGE_KEY]);
      } catch (error) {
        throw new SettingsRepositoryError(
          'INVALID_STORED_SETTINGS',
          'Stored settings are corrupt or use an unsupported version.',
          { cause: error },
        );
      }
    });
  }

  private async mutate(
    update: (latest: Settings) => Settings,
  ): Promise<Settings> {
    return this.mutationLock.run(async () => {
      const latest = await this.load();
      let validated: Settings;
      try {
        validated = settingsSchema.parse(update(latest));
      } catch (error) {
        throw new SettingsRepositoryError(
          'INVALID_SETTINGS',
          'Settings did not pass validation.',
          { cause: error },
        );
      }
      await this.storageArea.set({ [SETTINGS_STORAGE_KEY]: validated });
      return validated;
    });
  }

  async saveImageHost(draft: Settings['imageHost']): Promise<Settings> {
    return this.mutate((latest) => {
      const candidate = draft.kind === 'r2'
        ? {
            ...draft,
            accessKeyId: draft.accessKeyId || (latest.imageHost.kind === 'r2'
              ? latest.imageHost.accessKeyId
              : ''),
            secretAccessKey: draft.secretAccessKey || (latest.imageHost.kind === 'r2'
              ? latest.imageHost.secretAccessKey
              : ''),
          }
        : draft;
      const imageHost = candidate.kind === 'r2'
        ? r2RuntimeSettingsSchema.parse(candidate)
        : candidate;
      return { ...latest, imageHost };
    });
  }

  async saveVault(vault: Settings['vault']): Promise<Settings> {
    return this.mutate((latest) => ({ ...latest, vault }));
  }

  async saveClipping(autoFormatWithAI: boolean): Promise<Settings> {
    return this.mutate((latest) => ({
      ...latest,
      model: { ...latest.model, autoFormatWithAI },
    }));
  }

  async clearR2Credential(
    field: 'accessKeyId' | 'secretAccessKey',
  ): Promise<Settings> {
    return this.mutate((latest) => {
      if (latest.imageHost.kind !== 'r2') return latest;
      return {
        ...latest,
        imageHost: { ...latest.imageHost, [field]: '' },
      };
    });
  }

  async exportSafe(): Promise<SafeSettings> {
    const settings = await this.load();
    const model: SafeSettings['model'] = {
      autoFormatWithAI: settings.model.autoFormatWithAI,
    };
    const imageHost: SafeSettings['imageHost'] =
      settings.imageHost.kind === 'picgo'
        ? {
            kind: 'picgo',
            endpoint: settings.imageHost.endpoint,
          }
        : {
            kind: 'r2',
            accountId: settings.imageHost.accountId,
            bucket: settings.imageHost.bucket,
            publicBaseUrl: settings.imageHost.publicBaseUrl,
            keyPrefix: settings.imageHost.keyPrefix,
          };

    return {
      version: 1,
      model,
      imageHost,
      vault: {
        defaultSubdirectory: settings.vault.defaultSubdirectory,
      },
    };
  }
}

export function createSettingsRepository(
  storage: BrowserStorageLike = browser.storage,
): SettingsRepository {
  return new SettingsRepository(storage.local);
}
