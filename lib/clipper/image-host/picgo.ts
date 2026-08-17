import { z } from 'zod';

import {
  picGoSettingsSchema,
  type PicGoSettings,
} from '../contracts/settings';
import { sanitizeImageFilename } from './fetch-image';
import { ImageHostUploadError, type ImageHost, type ImageHostFetch } from './types';

const publicImageUrlSchema = z.url({ protocol: /^https?$/ });
const picGoSuccessSchema = z.object({
  success: z.literal(true),
  result: z.array(publicImageUrlSchema).min(1),
});

export interface PicGoDependencies {
  fetch?: ImageHostFetch;
}

export function createPicGoImageHost(
  untrustedSettings: PicGoSettings,
  dependencies: PicGoDependencies = {},
): ImageHost {
  const settings = picGoSettingsSchema.parse(untrustedSettings);
  const request = dependencies.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    async upload(image, signal) {
      const form = new FormData();
      form.append(
        'image',
        image.blob,
        sanitizeImageFilename(image.filename, image.contentType),
      );

      let response: Response;
      try {
        response = await request(settings.endpoint, {
          method: 'POST',
          body: form,
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        throw new ImageHostUploadError(
          'PicGo upload failed',
          error instanceof TypeError,
        );
      }
      if (!response.ok) {
        throw new ImageHostUploadError(
          `PicGo upload failed with status ${response.status}`,
          response.status >= 500,
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ImageHostUploadError('PicGo returned an invalid response', false);
      }
      const parsed = picGoSuccessSchema.safeParse(body);
      if (!parsed.success) {
        throw new ImageHostUploadError('PicGo returned an invalid upload result', false);
      }
      return parsed.data.result[0];
    },
  };
}
