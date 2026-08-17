import type { ImageReference } from '../contracts/article';
import type { ClippingJob } from '../contracts/job';
import {
  MAX_JOB_WARNING_UTF8_BYTES,
  MAX_MARKDOWN_UTF8_BYTES,
  withinJsonStringWireLimit,
} from '../contracts/limits';
import type { ClippingJobStore } from './database';
import { JobRepositoryError } from './database';
import { isAbort } from './state-machine';
import { zhCN } from '../ui/zh-cn';

export interface MarkdownFormatterAdapter {
  format(
    markdown: string,
    signal?: AbortSignal,
  ): Promise<{ markdown: string; warning?: string | null }>;
}

export interface ImagePipelineInput {
  /** Must be awaited immediately after each successful remote upload. */
  onUploaded(
    sourceUrl: string,
    publicUrl: string,
    currentMap: Readonly<Record<string, string>>,
  ): Promise<void>;
  signal?: AbortSignal;
}

export interface ImagePipelineAdapter {
  upload(
    markdown: string,
    imageReferences: readonly ImageReference[],
    options: ImagePipelineInput,
  ): Promise<{
    markdown: string;
    urlMap: Record<string, string>;
    failed?: number;
  }>;
}

export interface VaultWriteInput {
  title: string;
  markdown: string;
  targetSubdirectory: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}

export interface VaultWriterAdapter {
  write(input: VaultWriteInput): Promise<{
    filename: string;
    relativePath: string;
    vaultName: string;
  }>;
}

const jobOperations = new Map<string, Promise<unknown>>();

async function withJobLock<T>(jobId: string, operation: () => Promise<T>): Promise<T> {
  const previous = jobOperations.get(jobId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  jobOperations.set(jobId, current);
  try {
    return await current;
  } finally {
    if (jobOperations.get(jobId) === current) jobOperations.delete(jobId);
  }
}

function requireJob(job: ClippingJob | undefined, jobId: string): ClippingJob {
  if (job) return job;
  throw new JobRepositoryError('NOT_FOUND', `Clipping job ${jobId} was not found.`);
}

function safeFormatterWarning(warning: string | null | undefined): string | null {
  if (!warning) return null;
  if (withinJsonStringWireLimit(warning, MAX_JOB_WARNING_UTF8_BYTES)) return warning;
  return zhCN.model.warningTooLarge;
}

function replacePreviouslyUploaded(
  markdown: string,
  references: readonly ImageReference[],
  urlMap: Readonly<Record<string, string>>,
): { markdown: string; remaining: ImageReference[] } {
  let nextMarkdown = markdown;
  const remaining: ImageReference[] = [];
  for (const reference of references) {
    const uploaded = urlMap[reference.sourceUrl];
    if (uploaded) {
      nextMarkdown = nextMarkdown.split(reference.token).join(`<${uploaded}>`);
    } else {
      remaining.push(reference);
    }
  }
  return { markdown: nextMarkdown, remaining };
}

function excludeDeniedImageOrigins(
  markdown: string,
  references: readonly ImageReference[],
  deniedImageOrigins: readonly string[],
): { markdown: string; references: ImageReference[]; deniedCount: number } {
  const denied = new Set(deniedImageOrigins);
  let permissionSafeMarkdown = markdown;
  const permittedReferences: ImageReference[] = [];
  let deniedCount = 0;
  for (const reference of references) {
    let pattern: string | undefined;
    let permissionNotRequired = false;
    try {
      const url = new URL(reference.sourceUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') pattern = `${url.origin}/*`;
      else if (url.protocol === 'data:' || url.protocol === 'blob:') permissionNotRequired = true;
    } catch {
      // Invalid/non-network sources are left as original URLs below.
    }
    if (permissionNotRequired) {
      permittedReferences.push(reference);
    } else if (!pattern || denied.has(pattern)) {
      permissionSafeMarkdown = permissionSafeMarkdown
        .split(reference.token)
        .join(`<${reference.sourceUrl}>`);
      deniedCount += 1;
    } else {
      permittedReferences.push(reference);
    }
  }
  return { markdown: permissionSafeMarkdown, references: permittedReferences, deniedCount };
}

function deniedImageWarning(count: number): string {
  return zhCN.image.denied(count);
}

function failedImageWarning(count: number): string {
  return zhCN.image.failed(count);
}

function combinedImageWarning(...warnings: Array<string | null | undefined>): string | null {
  const fragments = [...new Set(warnings.filter((warning): warning is string => Boolean(warning)))];
  return fragments.length > 0 ? fragments.join(' ') : null;
}

export class ClippingJobOrchestrator {
  constructor(
    private readonly jobs: ClippingJobStore,
    private readonly formatter: MarkdownFormatterAdapter,
    private readonly images: ImagePipelineAdapter,
    private readonly writer: VaultWriterAdapter,
    private readonly options: { automaticModelFormatting?: boolean } = {},
  ) {}

  private async formattedMarkdown(
    markdown: string,
    signal?: AbortSignal,
  ): Promise<{ markdown: string; warning: string | null }> {
    let formattedMarkdown = markdown;
    let warning: string | null = null;
    try {
      const formatted = await this.formatter.format(markdown, signal);
      signal?.throwIfAborted();
      if (withinJsonStringWireLimit(formatted.markdown, MAX_MARKDOWN_UTF8_BYTES)) {
        formattedMarkdown = formatted.markdown;
        warning = safeFormatterWarning(formatted.warning);
      } else {
        warning = zhCN.model.outputTooLarge;
      }
    } catch (error) {
      if (isAbort(error, signal)) throw error;
      warning = zhCN.model.unavailableWithOriginal;
    }
    return { markdown: formattedMarkdown, warning };
  }

  async reopenMostRecent(): Promise<ClippingJob | undefined> {
    return this.jobs.getMostRecentIncomplete();
  }

  async preparePreview(jobId: string, signal?: AbortSignal): Promise<ClippingJob> {
    return withJobLock(jobId, async () => {
      let job = requireJob(await this.jobs.get(jobId), jobId);
      if (job.state !== 'extracted') return job;
      signal?.throwIfAborted();

      const formatted = this.options.automaticModelFormatting === false
        ? { markdown: job.markdown, warning: null }
        : await this.formattedMarkdown(job.markdown, signal);

      job = await this.jobs.transition(jobId, 'extracted', 'formatted', {
        markdown: formatted.markdown,
        modelWarning: formatted.warning,
      });
      return job;
    });
  }

  async formatWithAI(jobId: string, signal?: AbortSignal): Promise<ClippingJob> {
    return withJobLock(jobId, async () => {
      const job = requireJob(await this.jobs.get(jobId), jobId);
      if (job.state !== 'formatted') {
        throw new JobRepositoryError('INVALID_JOB', 'Only a reviewed job can be formatted with AI.');
      }
      signal?.throwIfAborted();
      const formatted = await this.formattedMarkdown(job.markdown, signal);
      return this.jobs.patch(jobId, {
        markdown: formatted.markdown,
        modelWarning: formatted.warning,
      });
    });
  }

  async confirmAndSave(
    jobId: string,
    signal?: AbortSignal,
    deniedImageOrigins: readonly string[] = [],
  ): Promise<ClippingJob> {
    return withJobLock(jobId, async () => {
      let job = requireJob(await this.jobs.get(jobId), jobId);
      if (job.state === 'completed') return job;
      if (job.state === 'extracted') {
        throw new JobRepositoryError(
          'INVALID_JOB',
          'The clipping job must be prepared and reviewed before confirmation.',
        );
      }
      signal?.throwIfAborted();

      try {
        if (job.state === 'formatted') {
          if (job.error) {
            job = await this.jobs.transition(jobId, 'formatted', 'formatted');
          }
          const permissionSafe = excludeDeniedImageOrigins(
            job.markdown,
            job.imageReferences,
            deniedImageOrigins,
          );
          job = await this.jobs.transition(jobId, 'formatted', 'uploading_images', {
            markdown: permissionSafe.markdown,
            imageReferences: permissionSafe.references,
            imageWarning: permissionSafe.deniedCount > 0
              ? deniedImageWarning(permissionSafe.deniedCount)
              : job.imageWarning ?? null,
          });
        } else if (job.state === 'uploading_images' && job.error) {
          job = await this.jobs.transition(jobId, 'uploading_images', 'uploading_images');
        }

        if (job.state === 'uploading_images') {
          signal?.throwIfAborted();
          const resumed = replacePreviouslyUploaded(
            job.markdown,
            job.imageReferences,
            job.uploadedImageUrls,
          );
          const permissionSafe = excludeDeniedImageOrigins(
            resumed.markdown,
            resumed.remaining,
            deniedImageOrigins,
          );
          const permissionSafeMarkdown = permissionSafe.markdown;
          const permittedReferences = permissionSafe.references;
          const deniedCount = permissionSafe.deniedCount;
          if (deniedCount > 0) {
            job = await this.jobs.patch(jobId, {
              markdown: permissionSafeMarkdown,
              imageReferences: permittedReferences,
              imageWarning: deniedImageWarning(deniedCount),
            });
          }
          const checkpointedUrls = { ...job.uploadedImageUrls };
          let checkpointQueue: Promise<void> = Promise.resolve();
          const uploaded = await this.images.upload(
            permissionSafeMarkdown,
            permittedReferences,
            {
              onUploaded: (sourceUrl, publicUrl, currentMap) => {
                checkpointQueue = checkpointQueue.then(async () => {
                  Object.assign(
                    checkpointedUrls,
                    currentMap ?? { [sourceUrl]: publicUrl },
                  );
                  await this.jobs.patch(jobId, {
                    uploadedImageUrls: { ...checkpointedUrls },
                  });
                });
                return checkpointQueue;
              },
              signal,
            },
          );
          await checkpointQueue;
          signal?.throwIfAborted();

          // Persist immediately after the aggregate upload operation. Browser
          // storage cannot make a remote upload and IndexedDB commit atomic:
          // termination in this narrow interval may repeat an upload. Durable
          // mappings eliminate repeats after this commit and on write retries.
          job = await this.jobs.transition(jobId, 'uploading_images', 'ready_to_write', {
            uploadedImageUrls: {
              ...checkpointedUrls,
              ...uploaded.urlMap,
            },
            finalMarkdown: uploaded.markdown,
            imageWarning: combinedImageWarning(
              job.imageWarning,
              deniedCount > 0 ? deniedImageWarning(deniedCount) : null,
              uploaded.failed && uploaded.failed > 0
                ? failedImageWarning(uploaded.failed)
                : null,
            ),
          });
        }

        if (job.state === 'ready_to_write' && job.error) {
          job = await this.jobs.transition(jobId, 'ready_to_write', 'ready_to_write');
        }
        if (job.state === 'ready_to_write') {
          signal?.throwIfAborted();
          const writtenMarkdown = job.finalMarkdown ?? job.markdown;
          const receipt = await this.writer.write({
            title: job.article.title,
            markdown: writtenMarkdown,
            targetSubdirectory: job.targetSubdirectory,
            idempotencyKey: job.jobId,
            signal,
          });
          // The File System Access API and IndexedDB likewise cannot share a
          // transaction. The vault writer's collision-safe behavior narrows
          // the write gap; the CAS transition prevents backward stale writes.
          job = await this.jobs.transition(jobId, 'ready_to_write', 'completed', {
            writeReceipt: receipt,
          });
          job = { ...job, finalMarkdown: writtenMarkdown };
          // A writer that resolves has completed its external side effect.
          // Checkpoint that fact before propagating a concurrently delivered
          // abort, otherwise retry would create a second note.
          signal?.throwIfAborted();
        }
        return job;
      } catch (error) {
        if (isAbort(error, signal)) throw error;
        const current = await this.jobs.get(jobId);
        if (current && current.state !== 'completed') {
          await this.jobs.patch(jobId, { error });
        }
        throw error;
      }
    });
  }
}
