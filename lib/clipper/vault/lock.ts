export interface VaultWriteLock {
  run<T>(key: string, action: () => Promise<T>): Promise<T>;
}

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export class VaultLockError extends Error {
  readonly code = 'VAULT_LOCK_FAILED';

  constructor(options?: ErrorOptions) {
    super('The cross-context vault write lock could not be acquired.', options);
    this.name = 'VaultLockError';
  }
}

class InContextMutex implements VaultWriteLock {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(key, current);

    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.tails.get(key) === current) this.tails.delete(key);
    }
  }
}

function availableLockManager(): LockManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const candidate = navigator.locks as LockManagerLike | undefined;
  return candidate && typeof candidate.request === 'function'
    ? candidate
    : undefined;
}

export function createVaultWriteLock(
  manager = availableLockManager(),
): VaultWriteLock {
  if (!manager) return new InContextMutex();

  return {
    async run<T>(key: string, action: () => Promise<T>): Promise<T> {
      let actionStarted = false;
      try {
        return await manager.request(key, async () => {
          actionStarted = true;
          return action();
        });
      } catch (error) {
        if (actionStarted) throw error;
        throw new VaultLockError({ cause: error });
      }
    },
  };
}

export const vaultWriteLock = createVaultWriteLock();
