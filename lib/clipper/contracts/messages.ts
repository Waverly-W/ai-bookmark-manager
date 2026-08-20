import { z } from 'zod';

import { extractedArticleSchema, imageReferencesSchema } from './article';
import { clippingJobSchema, jobIdSchema, serializableErrorSchema } from './job';
import {
  MAX_PAGE_SNAPSHOT_UTF8_BYTES,
  MAX_MARKDOWN_UTF8_BYTES,
  withinJsonStringWireLimit,
} from './limits';

const tabPayloadSchema = z.object({ tabId: z.int().nonnegative() }).strict();
const selectionPayloadSchema = z.object({
  tabId: z.int().nonnegative(),
  selectionId: jobIdSchema,
}).strict();
const preparedMarkdownSchema = z.string().refine(
  (value) => withinJsonStringWireLimit(value, MAX_MARKDOWN_UTF8_BYTES),
  'Prepared Markdown exceeds the size limit',
);
const jobPayloadSchema = z.object({ jobId: jobIdSchema }).strict();
const imageOriginPatternSchema = z.string().refine((value) => {
  try {
    const url = new URL(value.slice(0, -1));
    return value.endsWith('/*') && (url.protocol === 'http:' || url.protocol === 'https:')
      && value === `${url.origin}/*`;
  } catch {
    return false;
  }
}, 'Image permission must be one exact HTTP(S) origin pattern.');
const confirmJobPayloadSchema = z.object({
  jobId: jobIdSchema,
  deniedImageOrigins: z.array(imageOriginPatternSchema).max(512).default([]),
}).strict();
const editableJobPatchSchema = z
  .object({
    title: z.string().optional(),
    targetSubdirectory: z.string().optional(),
    markdown: preparedMarkdownSchema.optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one editable field is required.');
const patchJobPayloadSchema = z.object({
  jobId: jobIdSchema,
  expectedUpdatedAt: z.iso.datetime(),
  patch: editableJobPatchSchema,
}).strict();
const createJobPayloadSchema = z
  .object({
    article: extractedArticleSchema,
    markdown: preparedMarkdownSchema.pipe(z.string().min(1)),
    imageReferences: imageReferencesSchema,
  })
  .strict();

export const runtimeRequestSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('EXTRACT_ARTICLE'), payload: tabPayloadSchema })
    .strict(),
  z
    .object({
      type: z.literal('START_REGION_SELECTION'),
      payload: selectionPayloadSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('CANCEL_REGION_SELECTION'),
      payload: selectionPayloadSchema,
    })
    .strict(),
  z
    .object({ type: z.literal('CREATE_JOB'), payload: createJobPayloadSchema })
    .strict(),
  z.object({ type: z.literal('GET_JOB'), payload: jobPayloadSchema }).strict(),
  z
    .object({ type: z.literal('GET_MOST_RECENT_INCOMPLETE'), payload: z.object({}).strict() })
    .strict(),
  z.object({ type: z.literal('PATCH_JOB'), payload: patchJobPayloadSchema }).strict(),
  z
    .object({ type: z.literal('PREPARE_PREVIEW'), payload: jobPayloadSchema })
    .strict(),
  z
    .object({ type: z.literal('FORMAT_WITH_AI'), payload: jobPayloadSchema })
    .strict(),
  z
    .object({ type: z.literal('UPLOAD_IMAGES'), payload: confirmJobPayloadSchema })
    .strict(),
  z
    .object({ type: z.literal('CONFIRM_AND_SAVE'), payload: confirmJobPayloadSchema })
    .strict(),
  z.object({ type: z.literal('RETRY_JOB'), payload: jobPayloadSchema }).strict(),
  z
    .object({ type: z.literal('DISCARD_JOB'), payload: jobPayloadSchema })
    .strict(),
]);

export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>;
export type RuntimeRequestType = RuntimeRequest['type'];
export type RuntimeRequestByType<TType extends RuntimeRequestType> = Extract<
  RuntimeRequest,
  { type: TType }
>;
export type EditableJobPatch = z.infer<typeof editableJobPatchSchema>;

export const pageSnapshotResponseSchema = z.object({
  type: z.literal('PAGE_SNAPSHOT'),
  payload: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('article'),
      snapshot: z.object({
        pageUrl: z.url({ protocol: /^https?$/ }),
        html: z.string().refine(
          (value) => withinJsonStringWireLimit(value, MAX_PAGE_SNAPSHOT_UTF8_BYTES),
          'Page snapshot exceeds the size limit',
        ),
      }).strict(),
    }).strict(),
    z.object({
      kind: z.literal('region'),
      selectionId: jobIdSchema,
      snapshot: z.object({
        pageUrl: z.url({ protocol: /^https?$/ }),
        html: z.string().refine(
          (value) => withinJsonStringWireLimit(value, MAX_PAGE_SNAPSHOT_UTF8_BYTES),
          'Page snapshot exceeds the size limit',
        ),
      }).strict(),
    }).strict(),
  ]),
}).strict();
export type PageSnapshotResponse = z.infer<typeof pageSnapshotResponseSchema>;

export const regionSelectionCancelledResponseSchema = z
  .object({
    type: z.literal('REGION_SELECTION_CANCELLED'),
    payload: selectionPayloadSchema,
  })
  .strict();

export type RegionSelectionCancelledResponse = z.infer<
  typeof regionSelectionCancelledResponseSchema
>;

export const jobUpdatedResponseSchema = z
  .object({
    type: z.literal('JOB_UPDATED'),
    payload: z.object({ job: clippingJobSchema }).strict(),
  })
  .strict();

export type JobUpdatedResponse = z.infer<typeof jobUpdatedResponseSchema>;

export const jobDiscardedResponseSchema = z
  .object({
    type: z.literal('JOB_DISCARDED'),
    payload: jobPayloadSchema,
  })
  .strict();

export type JobDiscardedResponse = z.infer<
  typeof jobDiscardedResponseSchema
>;

export const incompleteJobResponseSchema = z.object({
  type: z.literal('INCOMPLETE_JOB'),
  payload: z.object({ job: clippingJobSchema.nullable() }).strict(),
}).strict();
export type IncompleteJobResponse = z.infer<typeof incompleteJobResponseSchema>;

export const runtimeErrorResponseSchema = z
  .object({ type: z.literal('ERROR'), error: serializableErrorSchema })
  .strict();

export type RuntimeErrorResponse = z.infer<typeof runtimeErrorResponseSchema>;

export const runtimeResponseSchema = z.discriminatedUnion('type', [
  pageSnapshotResponseSchema,
  regionSelectionCancelledResponseSchema,
  jobUpdatedResponseSchema,
  jobDiscardedResponseSchema,
  incompleteJobResponseSchema,
  runtimeErrorResponseSchema,
]);

export type RuntimeResponse = z.infer<typeof runtimeResponseSchema>;

export type RuntimeSuccessResponseByRequest = {
  EXTRACT_ARTICLE: PageSnapshotResponse;
  START_REGION_SELECTION: PageSnapshotResponse;
  CANCEL_REGION_SELECTION: RegionSelectionCancelledResponse;
  CREATE_JOB: JobUpdatedResponse;
  GET_JOB: JobUpdatedResponse;
  GET_MOST_RECENT_INCOMPLETE: IncompleteJobResponse;
  PATCH_JOB: JobUpdatedResponse;
  PREPARE_PREVIEW: JobUpdatedResponse;
  FORMAT_WITH_AI: JobUpdatedResponse;
  UPLOAD_IMAGES: JobUpdatedResponse;
  CONFIRM_AND_SAVE: JobUpdatedResponse;
  RETRY_JOB: JobUpdatedResponse;
  DISCARD_JOB: JobDiscardedResponse;
};

export type RuntimeSuccessResponseFor<
  TType extends RuntimeRequestType,
> = RuntimeSuccessResponseByRequest[TType];

export type RuntimeResponseFor<TType extends RuntimeRequestType> =
  | RuntimeSuccessResponseFor<TType>
  | RuntimeErrorResponse;
