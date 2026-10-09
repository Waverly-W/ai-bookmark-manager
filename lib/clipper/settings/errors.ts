export type ImageHostField =
  | 'picgoEndpoint'
  | 'r2AccountId'
  | 'r2Bucket'
  | 'r2AccessKeyId'
  | 'r2SecretAccessKey'
  | 'r2PublicBaseUrl';

const FIELD_BY_PATH_KEY: Record<string, ImageHostField> = {
  endpoint: 'picgoEndpoint',
  accountId: 'r2AccountId',
  bucket: 'r2Bucket',
  accessKeyId: 'r2AccessKeyId',
  secretAccessKey: 'r2SecretAccessKey',
  publicBaseUrl: 'r2PublicBaseUrl',
};

/**
 * Finds which image-host form field a settings validation error refers to, so the
 * UI can point at the field instead of showing a raw schema message.
 */
export function imageHostErrorField(error: unknown): ImageHostField | undefined {
  const cause = typeof error === 'object' && error !== null ? Reflect.get(error, 'cause') : undefined;
  const issues: unknown = typeof cause === 'object' && cause !== null ? Reflect.get(cause, 'issues') : undefined;
  if (!Array.isArray(issues)) return undefined;

  for (const issue of issues) {
    const path: unknown = typeof issue === 'object' && issue !== null ? Reflect.get(issue, 'path') : undefined;
    if (!Array.isArray(path)) continue;
    const key = path[path.length - 1];
    if (typeof key === 'string' && Object.hasOwn(FIELD_BY_PATH_KEY, key)) return FIELD_BY_PATH_KEY[key];
  }
  return undefined;
}
