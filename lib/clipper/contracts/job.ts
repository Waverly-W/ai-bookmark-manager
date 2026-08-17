import { z } from 'zod';

import {
  extractedArticleSchema,
  imageReferencesSchema,
} from './article';
import {
  MAX_DURABLE_JOB_UTF8_BYTES,
  MAX_JOB_ERROR_UTF8_BYTES,
  MAX_JOB_PATH_UTF8_BYTES,
  MAX_JOB_WARNING_UTF8_BYTES,
  MAX_MARKDOWN_UTF8_BYTES,
  withinJsonStringWireLimit,
  withinJsonValueWireLimit,
} from './limits';

function boundedString(maximum: number, message: string) {
  return z.string().refine((value) => withinJsonStringWireLimit(value, maximum), message);
}

export const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const jobIdSchema = z.string().regex(
  JOB_ID_PATTERN,
  'Job ID must be a lowercase canonical RFC 4122 UUID.',
);

export const jobStateSchema = z.enum([
  'extracted',
  'formatted',
  'uploading_images',
  'ready_to_write',
  'completed',
]);

export type JobState = z.infer<typeof jobStateSchema>;

export const serializableErrorSchema = z.object({
  name: boundedString(MAX_JOB_ERROR_UTF8_BYTES, 'Error name exceeds the size limit'),
  message: boundedString(MAX_JOB_ERROR_UTF8_BYTES, 'Error message exceeds the size limit'),
  code: boundedString(MAX_JOB_ERROR_UTF8_BYTES, 'Error code exceeds the size limit').optional(),
  stage: jobStateSchema.optional(),
});

export type SerializableError = z.infer<typeof serializableErrorSchema>;

export const jobWriteReceiptSchema = z.object({
  filename: boundedString(
    MAX_JOB_PATH_UTF8_BYTES,
    'Receipt filename exceeds the size limit',
  ).pipe(z.string().min(1)),
  relativePath: boundedString(
    MAX_JOB_PATH_UTF8_BYTES,
    'Receipt path exceeds the size limit',
  ).pipe(z.string().min(1)),
  vaultName: boundedString(
    MAX_JOB_PATH_UTF8_BYTES,
    'Receipt vault name exceeds the size limit',
  ).pipe(z.string().min(1)),
});

export type JobWriteReceipt = z.infer<typeof jobWriteReceiptSchema>;

const clippingJobObjectSchema = z.object({
  jobId: jobIdSchema,
  state: jobStateSchema,
  article: extractedArticleSchema,
  markdown: boundedString(MAX_MARKDOWN_UTF8_BYTES, 'Markdown exceeds the size limit'),
  imageReferences: imageReferencesSchema,
  targetSubdirectory: boundedString(MAX_JOB_PATH_UTF8_BYTES, 'Target path exceeds the size limit'),
  uploadedImageUrls: z.record(
    z.string(),
    z.url({ protocol: /^https?$/ }),
  ),
  finalMarkdown: boundedString(
    MAX_MARKDOWN_UTF8_BYTES,
    'Final Markdown exceeds the size limit',
  ).nullable(),
  modelWarning: boundedString(
    MAX_JOB_WARNING_UTF8_BYTES,
    'Model warning exceeds the size limit',
  ).nullable(),
  imageWarning: boundedString(
    MAX_JOB_WARNING_UTF8_BYTES,
    'Image warning exceeds the size limit',
  ).nullable().optional(),
  error: serializableErrorSchema.nullable(),
  writeReceipt: jobWriteReceiptSchema.nullable().optional(),
  sequence: z.int().nonnegative().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const clippingJobSchema = clippingJobObjectSchema.superRefine((job, context) => {
  if (!withinJsonValueWireLimit(job, MAX_DURABLE_JOB_UTF8_BYTES)) {
    context.addIssue({ code: 'custom', message: 'Durable clipping job exceeds the size limit' });
  }
});

export type ClippingJob = z.infer<typeof clippingJobSchema>;
