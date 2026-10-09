import { z } from 'zod';
import { parseRelativeDirectory } from '../vault/path';

function configuredHttpUrlSchema(label: string) {
  return z.url({ protocol: /^https?$/ }).refine(
    (value) => {
      try {
        const url = new URL(value);
        return (
          url.username === '' &&
          url.password === '' &&
          url.search === '' &&
          url.hash === ''
        );
      } catch {
        return false;
      }
    },
    {
      message: `${label} must not contain URL credentials, a query, or a fragment; its path is preserved verbatim`,
    },
  );
}

/** Full PicGo upload endpoint; query-based authentication is not supported. */
export const picgoEndpointUrlSchema = configuredHttpUrlSchema(
  'PicGo endpoint URL',
);

/** Public object base URL joined with uploaded object keys. */
export const r2PublicBaseUrlSchema = configuredHttpUrlSchema(
  'R2 public base URL',
);

// 模型服务统一使用「AI 设置」中的配置，这里只保留剪藏专属开关。
// 字段名与旧版 `automaticFormatting`（曾默认开启且无界面入口）刻意不同：
// 旧数据里的值会被忽略，所有用户回到默认关闭，需要自行主动开启。
export const modelSettingsSchema = z.object({
  autoFormatWithAI: z.boolean().default(false),
});

export type ModelSettings = z.infer<typeof modelSettingsSchema>;

export const picGoSettingsSchema = z.object({
  kind: z.literal('picgo'),
  endpoint: picgoEndpointUrlSchema,
});

export type PicGoSettings = z.infer<typeof picGoSettingsSchema>;

export const r2SettingsSchema = z.object({
  kind: z.literal('r2'),
  accountId: z.string().trim().min(1),
  bucket: z.string().trim().min(1),
  // Empty values represent an explicitly cleared write-only credential.
  // Provider construction applies the stricter usable-credential contract.
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  publicBaseUrl: r2PublicBaseUrlSchema,
  keyPrefix: z.string(),
});

export type R2Settings = z.infer<typeof r2SettingsSchema>;

export const imageHostSettingsSchema = z.discriminatedUnion('kind', [
  picGoSettingsSchema,
  r2SettingsSchema,
]);

export type ImageHostSettings = z.infer<typeof imageHostSettingsSchema>;

export const vaultSettingsSchema = z.object({
  defaultSubdirectory: z.string().superRefine((value, context) => {
    try {
      parseRelativeDirectory(value);
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Directory must be a safe relative path.',
      });
    }
  }),
});

export type VaultSettings = z.infer<typeof vaultSettingsSchema>;

export const settingsSchema = z.object({
  version: z.literal(1),
  model: modelSettingsSchema,
  imageHost: imageHostSettingsSchema,
  vault: vaultSettingsSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({
  version: 1,
  model: {
    autoFormatWithAI: false,
  },
  imageHost: {
    kind: 'picgo',
    endpoint: 'http://127.0.0.1:36677/upload',
  },
  vault: {
    defaultSubdirectory: 'Inbox/Web Clippings',
  },
});
