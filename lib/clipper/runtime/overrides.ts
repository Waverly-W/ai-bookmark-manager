import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { HostPermissionsApi } from '../permissions/hosts';

export interface RuntimeOverrides {
  isActive(): boolean;
  installControlSurface(): Promise<void>;
  resolveTargetTabId(): Promise<number | undefined>;
  loadVaultHandle(): Promise<FileSystemDirectoryHandle>;
  loadSelectedVaultHandle(): Promise<FileSystemDirectoryHandle | undefined>;
  chooseVaultHandle(): Promise<FileSystemDirectoryHandle>;
  createRequestHandler(): NonNullable<S3ClientConfig['requestHandler']>;
  createPermissionsApi(): HostPermissionsApi;
  consumeWriteInterruption(): Promise<boolean>;
  recordDiagnostic(error: unknown): Promise<void>;
  recordProviderProbe(): Promise<void>;
}
