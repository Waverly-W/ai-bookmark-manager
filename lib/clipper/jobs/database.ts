import Dexie, { type Table, type Transaction } from 'dexie';

import {
  clippingJobSchema,
  jobIdSchema,
  type ClippingJob,
  type JobState,
  type SerializableError,
} from '../contracts/job';
import { parseRelativeDirectory } from '../vault/path';
import { assertJobTransition, redactJobError } from './state-machine';

export class JobDatabase extends Dexie {
  readonly jobs!: Table<ClippingJob, string>;
  readonly jobMetadata!: Table<{ id: 'sequence'; value: number }, string>;

  constructor(name = 'web-to-obsidian-jobs') {
    super(name);
    this.version(1).stores({ jobs: '&jobId, state, updatedAt' });
    this.version(2).stores({
      jobs: '&jobId, state, [updatedAt+sequence]',
      jobMetadata: 'id',
    }).upgrade(async (transaction) => {
      let sequence = 0;
      await transaction.table<ClippingJob, string>('jobs').toCollection().modify((job) => {
        if (!jobIdSchema.safeParse(job.jobId).success) {
          throw new Error('Version-1 clipping job has a non-canonical job ID.');
        }
        job.sequence = ++sequence;
        job.writeReceipt = null;
        validateJob(job);
      });
      await transaction.table('jobMetadata').put({ id: 'sequence', value: sequence });
    });
    this.version(3).stores({
      jobs: '&jobId, state, [updatedAt+sequence]',
      jobMetadata: 'id',
    }).upgrade(async (transaction) => {
      await transaction.table<ClippingJob, string>('jobs').toCollection().modify((stored) => {
        const job = validateJob(stored);
        if (job.state !== 'completed') return;
        const compact = compactCompletedJob(
          job,
          { writeReceipt: job.writeReceipt },
          job.sequence!,
          job.updatedAt,
        );
        for (const key of Object.keys(stored)) {
          delete (stored as Record<string, unknown>)[key];
        }
        Object.assign(stored, compact);
      });
    });
  }
}

export type JobDraft = Omit<
  ClippingJob,
  'createdAt' | 'updatedAt' | 'state' | 'sequence' | 'writeReceipt' | 'jobId'
> & {
  state: 'extracted';
  jobId?: string;
};

export interface JobPatch {
  markdown?: string;
  imageReferences?: ClippingJob['imageReferences'];
  targetSubdirectory?: string;
  uploadedImageUrls?: Record<string, string>;
  finalMarkdown?: string | null;
  modelWarning?: string | null;
  imageWarning?: string | null;
  error?: unknown | null;
  writeReceipt?: ClippingJob['writeReceipt'];
}

export interface EditableJobMutation {
  title?: string;
  targetSubdirectory?: string;
  markdown?: string;
}

export type JobRepositoryErrorCode =
  | 'NOT_FOUND'
  | 'STALE_STATE'
  | 'INVALID_JOB'
  | 'COMPLETED_JOB';

export class JobRepositoryError extends Error {
  constructor(
    readonly code: JobRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'JobRepositoryError';
  }
}

function assertCanonicalJobId(jobId: string): void {
  if (!jobIdSchema.safeParse(jobId).success) {
    throw new JobRepositoryError('INVALID_JOB', 'Job ID is not a lowercase canonical UUID.');
  }
}

function protectedTokens(markdown: string): string[] {
  return [...markdown.matchAll(/__W2O_IMAGE_[0-9a-f]{16,64}__/g)].map((match) => match[0]);
}

function validateReferenceContract(job: ClippingJob): void {
  const referenceTokens = job.imageReferences.map((reference) => reference.token);
  if (new Set(referenceTokens).size !== referenceTokens.length) {
    throw new Error('Protected image reference tokens must be unique.');
  }
  if (job.state === 'completed' && job.finalMarkdown === null) {
    if (referenceTokens.length > 0 || protectedTokens(job.markdown).length > 0) {
      throw new Error('Completed receipt contains unresolved image references.');
    }
    return;
  }
  if (job.state === 'ready_to_write' || job.state === 'completed') {
    if (!job.finalMarkdown?.trim()) throw new Error('Final Markdown is required before writing.');
    if (protectedTokens(job.finalMarkdown).length > 0) {
      throw new Error('Final Markdown contains unresolved internal image tokens.');
    }
    return;
  }
  if (job.finalMarkdown !== null) throw new Error('Final Markdown is not valid before upload.');
  const inMarkdown = new Set(protectedTokens(job.markdown));
  const inReferences = new Set(referenceTokens);
  if (inMarkdown.size !== inReferences.size) {
    throw new Error('Markdown image tokens and protected references differ.');
  }
  for (const token of inMarkdown) {
    if (!inReferences.has(token)) {
      throw new Error('Markdown image tokens and protected references differ.');
    }
  }
}

export const DEFAULT_COMPLETED_JOB_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const DEFAULT_COMPLETED_JOB_MAX_COUNT = 100;

export interface CompletedJobRetention {
  completedTtlMs?: number;
  completedMaxCount?: number;
}

function compactCompletedJob(
  current: ClippingJob,
  patch: JobPatch,
  sequence: number,
  updatedAt: string,
): ClippingJob {
  return validateJob({
    jobId: current.jobId,
    state: 'completed',
    article: {
      title: current.article.title,
      sourceUrl: current.article.sourceUrl,
      byline: current.article.byline,
      excerpt: current.article.excerpt,
      siteName: current.article.siteName,
      lang: current.article.lang,
      published: current.article.published,
      canonicalUrl: current.article.canonicalUrl,
      contentHtml: '',
      textLength: 0,
    },
    markdown: '',
    imageReferences: [],
    targetSubdirectory: '',
    uploadedImageUrls: {},
    finalMarkdown: null,
    modelWarning: patch.modelWarning === undefined
      ? current.modelWarning
      : patch.modelWarning,
    imageWarning: patch.imageWarning === undefined
      ? current.imageWarning ?? null
      : patch.imageWarning,
    error: null,
    writeReceipt: patch.writeReceipt === undefined
      ? current.writeReceipt
      : patch.writeReceipt,
    sequence,
    createdAt: current.createdAt,
    updatedAt,
  });
}

function validateJob(candidate: unknown): ClippingJob {
  try {
    const job = clippingJobSchema.parse(candidate);
    if (job.sequence === undefined || job.writeReceipt === undefined) {
      throw new Error('Version-2 clipping job fields are missing.');
    }
    validateReferenceContract(job);
    return job;
  } catch (error) {
    throw new JobRepositoryError('INVALID_JOB', 'Clipping job did not pass validation.', {
      cause: error,
    });
  }
}

async function nextSequence(transaction: Transaction): Promise<number> {
  const metadata = transaction.table<{ id: 'sequence'; value: number }, string>('jobMetadata');
  const current = (await metadata.get('sequence'))?.value ?? 0;
  const next = current + 1;
  await metadata.put({ id: 'sequence', value: next });
  return next;
}

function normalizedTimestamp(now: () => string, previous?: string): string {
  const candidate = new Date(now());
  if (Number.isNaN(candidate.valueOf())) {
    throw new JobRepositoryError('INVALID_JOB', 'Job clock returned an invalid timestamp.');
  }
  if (!previous) return candidate.toISOString();
  const previousTime = new Date(previous).valueOf();
  return new Date(Math.max(candidate.valueOf(), previousTime + 1)).toISOString();
}

function applyPatch(job: ClippingJob, patch: JobPatch): ClippingJob {
  const { error, ...values } = patch;
  const storedError: SerializableError | null | undefined = error === undefined
    ? undefined
    : error === null
      ? null
      : redactJobError(error, job.state);
  return {
    ...job,
    ...values,
    ...(storedError === undefined ? {} : { error: storedError }),
  };
}

export interface ClippingJobStore {
  create(draft: JobDraft): Promise<ClippingJob>;
  get(jobId: string): Promise<ClippingJob | undefined>;
  getMostRecentIncomplete(): Promise<ClippingJob | undefined>;
  transition(
    jobId: string,
    expectedState: JobState,
    nextState: JobState,
    patch?: JobPatch,
  ): Promise<ClippingJob>;
  patch(jobId: string, patch: JobPatch): Promise<ClippingJob>;
  discard(jobId: string): Promise<void>;
}

export class JobRepository implements ClippingJobStore {
  constructor(
    private readonly database = new JobDatabase(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly generateId: () => string = () => crypto.randomUUID(),
    private readonly retention: CompletedJobRetention = {},
  ) {}

  private async pruneCompleted(transaction: Transaction, timestamp: string): Promise<void> {
    const ttl = this.retention.completedTtlMs ?? DEFAULT_COMPLETED_JOB_TTL_MS;
    const maximum = this.retention.completedMaxCount ?? DEFAULT_COMPLETED_JOB_MAX_COUNT;
    const jobs = transaction.table<ClippingJob, string>('jobs');
    const cutoff = new Date(new Date(timestamp).valueOf() - Math.max(0, ttl)).valueOf();
    const completed = await jobs.where('state').equals('completed').toArray();
    const expiredIds = completed
      .filter((job) => new Date(job.updatedAt).valueOf() < cutoff)
      .map((job) => job.jobId);
    if (expiredIds.length > 0) await jobs.bulkDelete(expiredIds);
    const expired = new Set(expiredIds);
    const retained = completed
      .filter((job) => !expired.has(job.jobId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)
        || (right.sequence ?? 0) - (left.sequence ?? 0));
    const excessIds = retained.slice(Math.max(0, maximum)).map((job) => job.jobId);
    if (excessIds.length > 0) await jobs.bulkDelete(excessIds);
  }

  async create(draft: JobDraft): Promise<ClippingJob> {
    if (draft.state !== 'extracted') {
      throw new JobRepositoryError(
        'INVALID_JOB',
        'New clipping jobs must start in the extracted state.',
      );
    }
    return this.database.transaction(
      'rw',
      this.database.jobs,
      this.database.jobMetadata,
      async (transaction) => {
        const timestamp = normalizedTimestamp(this.now);
        const job = validateJob({
          ...draft,
          jobId: draft.jobId ?? this.generateId(),
          writeReceipt: null,
          sequence: await nextSequence(transaction),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        await this.database.jobs.add(job);
        await this.pruneCompleted(transaction, timestamp);
        return job;
      },
    );
  }

  async get(jobId: string): Promise<ClippingJob | undefined> {
    assertCanonicalJobId(jobId);
    const stored = await this.database.jobs.get(jobId);
    return stored === undefined ? undefined : validateJob(stored);
  }

  async getMostRecentIncomplete(): Promise<ClippingJob | undefined> {
    const stored = await this.database.jobs
      .orderBy('[updatedAt+sequence]')
      .reverse()
      .filter((job) => job.state !== 'completed')
      .first();
    return stored === undefined ? undefined : validateJob(stored);
  }

  async transition(
    jobId: string,
    expectedState: JobState,
    nextState: JobState,
    patch: JobPatch = {},
  ): Promise<ClippingJob> {
    assertCanonicalJobId(jobId);
    return this.database.transaction(
      'rw',
      this.database.jobs,
      this.database.jobMetadata,
      async (transaction) => {
      const current = await this.requireJob(jobId);
      if (current.state !== expectedState) {
        throw new JobRepositoryError(
          'STALE_STATE',
          `Expected ${expectedState}, found ${current.state}.`,
        );
      }
      assertJobTransition(current.state, nextState, current.error !== null);
      const sequence = await nextSequence(transaction);
      const updatedAt = normalizedTimestamp(this.now, current.updatedAt);
      const next = nextState === 'completed'
        ? compactCompletedJob(current, patch, sequence, updatedAt)
        : validateJob({
            ...applyPatch(current, patch),
            state: nextState,
            error: null,
            createdAt: current.createdAt,
            sequence,
            updatedAt,
          });
      await this.database.jobs.put(next);
      await this.pruneCompleted(transaction, updatedAt);
      return next;
      },
    );
  }

  async patch(jobId: string, patch: JobPatch): Promise<ClippingJob> {
    assertCanonicalJobId(jobId);
    return this.database.transaction(
      'rw',
      this.database.jobs,
      this.database.jobMetadata,
      async (transaction) => {
      const current = await this.requireJob(jobId);
      if (current.state === 'completed') {
        throw new JobRepositoryError('COMPLETED_JOB', 'Completed jobs are immutable.');
      }
      const next = validateJob({
        ...applyPatch(current, patch),
        createdAt: current.createdAt,
        sequence: await nextSequence(transaction),
        updatedAt: normalizedTimestamp(this.now, current.updatedAt),
      });
      await this.database.jobs.put(next);
      return next;
      },
    );
  }

  async patchEditable(
    jobId: string,
    expectedUpdatedAt: string,
    patch: EditableJobMutation,
  ): Promise<ClippingJob> {
    assertCanonicalJobId(jobId);
    return this.database.transaction(
      'rw',
      this.database.jobs,
      this.database.jobMetadata,
      async (transaction) => {
        const current = await this.requireJob(jobId);
        if (current.updatedAt !== expectedUpdatedAt) {
          throw new JobRepositoryError(
            'STALE_STATE',
            'The clipping job changed after the editor loaded it.',
          );
        }
        if (current.state !== 'extracted' && current.state !== 'formatted') {
          throw new JobRepositoryError(
            current.state === 'completed' ? 'COMPLETED_JOB' : 'INVALID_JOB',
            'Only extracted or formatted jobs are editable.',
          );
        }
        if (patch.targetSubdirectory !== undefined) {
          parseRelativeDirectory(patch.targetSubdirectory);
        }
        const markdown = patch.markdown ?? current.markdown;
        const next = validateJob({
          ...current,
          article: patch.title === undefined
            ? current.article
            : { ...current.article, title: patch.title },
          targetSubdirectory: patch.targetSubdirectory ?? current.targetSubdirectory,
          markdown,
          imageReferences: patch.markdown === undefined
            ? current.imageReferences
            : current.imageReferences.filter((reference) => markdown.includes(reference.token)),
          sequence: await nextSequence(transaction),
          updatedAt: normalizedTimestamp(this.now, current.updatedAt),
        });
        await this.database.jobs.put(next);
        return next;
      },
    );
  }

  async discard(jobId: string): Promise<void> {
    assertCanonicalJobId(jobId);
    await this.database.transaction('rw', this.database.jobs, async () => {
      const current = await this.database.jobs.get(jobId);
      if (!current) return;
      if (validateJob(current).state === 'completed') {
        throw new JobRepositoryError('COMPLETED_JOB', 'Completed jobs cannot be discarded.');
      }
      await this.database.jobs.delete(jobId);
    });
  }

  private async requireJob(jobId: string): Promise<ClippingJob> {
    const current = await this.database.jobs.get(jobId);
    if (!current) throw new JobRepositoryError('NOT_FOUND', `Clipping job ${jobId} was not found.`);
    return validateJob(current);
  }
}
