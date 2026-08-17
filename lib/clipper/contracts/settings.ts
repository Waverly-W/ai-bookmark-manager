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

/** Pure API base used for provider endpoint composition. */
export const modelBaseUrlSchema = configuredHttpUrlSchema('Model base URL');

/** Full PicGo upload endpoint; query-based authentication is not supported. */
export const picgoEndpointUrlSchema = configuredHttpUrlSchema(
  'PicGo endpoint URL',
);

/** Public object base URL joined with uploaded object keys. */
export const r2PublicBaseUrlSchema = configuredHttpUrlSchema(
  'R2 public base URL',
);

const modelProviderFields = {
  baseUrl: modelBaseUrlSchema,
  apiKey: z.string(),
  model: z.string().trim().min(1),
  timeoutMs: z.int().min(1_000).max(300_000),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.int().min(1).max(1_000_000).optional(),
};

export const modelProviderDraftSchema = z.discriminatedUnion('protocol', [
  z.object({
    protocol: z.literal('chat-completions'),
    ...modelProviderFields,
  }),
  z.object({
    protocol: z.literal('responses'),
    ...modelProviderFields,
  }),
]);

export const modelSettingsSchema = z.discriminatedUnion('protocol', [
  z.object({
    protocol: z.literal('chat-completions'),
    ...modelProviderFields,
    automaticFormatting: z.boolean(),
  }),
  z.object({
    protocol: z.literal('responses'),
    ...modelProviderFields,
    automaticFormatting: z.boolean(),
  }),
]);

export type ModelSettings = z.infer<typeof modelSettingsSchema>;
export type ModelProviderDraft = Omit<ModelSettings, 'automaticFormatting'>;

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
    protocol: 'chat-completions',
    baseUrl: 'https://api.openai.com',
    apiKey: '',
    model: 'gpt-5-mini',
    timeoutMs: 60_000,
    automaticFormatting: true,
  },
  imageHost: {
    kind: 'picgo',
    endpoint: 'http://127.0.0.1:36677/upload',
  },
  vault: {
    defaultSubdirectory: 'Inbox/Web Clippings',
  },
});
