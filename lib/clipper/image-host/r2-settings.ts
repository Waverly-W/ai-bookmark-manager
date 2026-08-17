import { z } from 'zod';

import { r2SettingsSchema } from '../contracts/settings';

/** Complete, usable R2 configuration shared by UI and provider boundaries. */
export const r2RuntimeSettingsSchema = r2SettingsSchema.extend({
  accountId: z.string().trim().regex(
    /^[a-z0-9-]+$/,
    'R2 account ID contains invalid characters',
  ),
  bucket: z.string().trim().regex(
    /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/,
    'R2 bucket name contains invalid characters',
  ),
  accessKeyId: z.string().min(1, 'R2 access key ID is required'),
  secretAccessKey: z.string().min(1, 'R2 secret access key is required'),
});

export type R2RuntimeSettings = z.infer<typeof r2RuntimeSettingsSchema>;
