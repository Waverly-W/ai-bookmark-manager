export interface SettingsMutationLock {
  run<T>(action: () => Promise<T>): Promise<T>;
}

export interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export class SettingsLockError extends Error {
  readonly code = 'SETTINGS_LOCK_FAILED';

  constructor(options?: ErrorOptions) {
    super('The cross-context settings lock could not be acquired.', options);
    this.name = 'SettingsLockError';
  }
}

class InContextMutex implements SettingsMutationLock {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }
}

function availableLockManager(): LockManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const candidate = navigator.locks as LockManagerLike | undefined;
  return candidate && typeof candidate.request === 'function' ? candidate : undefined;
}

export function createSettingsMutationLock(
  manager = availableLockManager(),
): SettingsMutationLock {
  if (!manager) return new InContextMutex();
  return {
    async run<T>(action: () => Promise<T>): Promise<T> {
      let actionStarted = false;
      try {
        return await manager.request('web-to-obsidian.settings.v1', async () => {
          actionStarted = true;
          return action();
        });
      } catch (error) {
        if (actionStarted) throw error;
        throw new SettingsLockError({ cause: error });
      }
    },
  };
}

/** Shared fallback serializes repository instances within this JS context. */
export const settingsMutationLock = createSettingsMutationLock();
