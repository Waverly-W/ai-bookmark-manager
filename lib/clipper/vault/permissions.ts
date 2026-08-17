import {
  VaultHandleRepository,
  type VaultHandleStore,
} from './database';

interface PermissionDescriptor {
  mode: 'readwrite';
}

export interface PermissionDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (
    descriptor: PermissionDescriptor,
  ) => Promise<PermissionState>;
}

export type VaultCapabilityErrorCode =
  | 'UNSUPPORTED_VAULT_PERMISSION_QUERY'
  | 'UNSUPPORTED_VAULT_PERMISSION_REQUEST'
  | 'UNSUPPORTED_DIRECTORY_PICKER';

export class VaultCapabilityError extends Error {
  constructor(readonly code: VaultCapabilityErrorCode, message: string) {
    super(message);
    this.name = 'VaultCapabilityError';
  }
}

export class VaultPermissionError extends Error {
  readonly code = 'NEEDS_VAULT_PERMISSION';

  constructor(options?: ErrorOptions) {
    super('Vault read-write permission must be granted from a user gesture.', options);
    this.name = 'VaultPermissionError';
  }
}

function permissionHandle(
  handle: FileSystemDirectoryHandle,
): PermissionDirectoryHandle {
  return handle as PermissionDirectoryHandle;
}

/** Passive check safe for background/orchestration code. Never requests. */
export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const query = permissionHandle(handle).queryPermission;
  if (typeof query !== 'function') {
    throw new VaultCapabilityError(
      'UNSUPPORTED_VAULT_PERMISSION_QUERY',
      'This context cannot query File System Access permissions.',
    );
  }

  let state: PermissionState;
  try {
    state = await query.call(handle, { mode: 'readwrite' });
  } catch (error) {
    throw new VaultPermissionError({ cause: error });
  }
  if (state !== 'granted') {
    throw new VaultPermissionError();
  }
}

/** Call directly from a settings/side-panel click; request happens synchronously. */
export function requestVaultPermissionFromUserGesture(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const request = permissionHandle(handle).requestPermission;
  if (typeof request !== 'function') {
    throw new VaultCapabilityError(
      'UNSUPPORTED_VAULT_PERMISSION_REQUEST',
      'This context cannot request File System Access permissions.',
    );
  }

  let requested: Promise<PermissionState>;
  try {
    requested = request.call(handle, { mode: 'readwrite' });
  } catch (error) {
    throw new VaultPermissionError({ cause: error });
  }
  return requested.then(
    (state) => {
      if (state !== 'granted') throw new VaultPermissionError();
    },
    (error: unknown) => {
      throw new VaultPermissionError({ cause: error });
    },
  );
}

export type DirectoryPicker = (options: {
  mode: 'readwrite';
}) => Promise<FileSystemDirectoryHandle>;

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: DirectoryPicker;
}

export interface ChooseVaultOptions {
  picker?: DirectoryPicker;
  repository?: VaultHandleStore;
}

function defaultDirectoryPicker(): DirectoryPicker {
  if (typeof window === 'undefined') {
    throw new VaultCapabilityError(
      'UNSUPPORTED_DIRECTORY_PICKER',
      'Directory selection is unavailable in this browser context.',
    );
  }
  const picker = (window as unknown as DirectoryPickerWindow)
    .showDirectoryPicker;
  if (typeof picker !== 'function') {
    throw new VaultCapabilityError(
      'UNSUPPORTED_DIRECTORY_PICKER',
      'Directory selection is unavailable in this browser context.',
    );
  }
  return picker.bind(window);
}

/** Picker invocation remains the first asynchronous browser operation. */
export function chooseVault(options: ChooseVaultOptions = {}): Promise<FileSystemDirectoryHandle> {
  const picker = options.picker ?? defaultDirectoryPicker();
  const repository = options.repository ?? new VaultHandleRepository();
  const picked = picker({ mode: 'readwrite' });

  return picked.then(async (handle) => {
    await repository.save(handle);
    return handle;
  });
}
