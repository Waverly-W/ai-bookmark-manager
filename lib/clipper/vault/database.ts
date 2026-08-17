import Dexie, { type Table } from 'dexie';

const SELECTED_VAULT_ID = 'selected';

interface VaultHandleRecord {
  id: typeof SELECTED_VAULT_ID;
  handle: FileSystemDirectoryHandle;
  updatedAt: number;
}

export class VaultDatabase extends Dexie {
  readonly vaultHandles!: Table<VaultHandleRecord, string>;

  constructor(name = 'web-to-obsidian-vault') {
    super(name);
    this.version(1).stores({ vaultHandles: 'id' });
  }
}

export interface VaultHandleStore {
  save(handle: FileSystemDirectoryHandle): Promise<void>;
}

export class VaultHandleRepository implements VaultHandleStore {
  constructor(private readonly database = new VaultDatabase()) {}

  async save(handle: FileSystemDirectoryHandle): Promise<void> {
    await this.database.vaultHandles.put({
      id: SELECTED_VAULT_ID,
      handle,
      updatedAt: Date.now(),
    });
  }

  async load(): Promise<FileSystemDirectoryHandle | undefined> {
    return (await this.database.vaultHandles.get(SELECTED_VAULT_ID))?.handle;
  }

  async clear(): Promise<void> {
    await this.database.vaultHandles.delete(SELECTED_VAULT_ID);
  }
}
