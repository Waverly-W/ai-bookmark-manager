import { browser } from 'wxt/browser';

import type { ExtractedArticle, ImageReference } from '../contracts/article';
import { extractedArticleSchema, imageReferenceSchema } from '../contracts/article';
import type { Settings } from '../contracts/settings';
import { snapshotTab, selectRegionInTab, cancelRegionSelectionInTab } from '../extraction/tab-client';
import type { PageSnapshot } from '../extraction/injected';
import { uploadArticleImages } from '../image-host/pipeline';
import type { ImageHost } from '../image-host/types';
import { createPicGoImageHost } from '../image-host/picgo';
import { createR2ImageHost } from '../image-host/r2';
import { createChatCompletionsClient } from '../llm/chat-completions';
import { createResponsesClient } from '../llm/responses';
import { formatMarkdown } from '../llm/formatter';
import { originPattern } from '../permissions/hosts';
import {
  createSettingsRepository,
  type BrowserStorageLike,
} from '../settings/repository';
import { VaultDatabase, VaultHandleRepository } from '../vault/database';
import { writeNote } from '../vault/writer';
import { runtimeOverrides } from '../runtime/overrides-none';
import { JobDatabase, JobRepository } from './database';
import {
  ClippingJobOrchestrator,
  type ImagePipelineAdapter,
  type MarkdownFormatterAdapter,
  type VaultWriterAdapter,
} from './orchestrator';

export class ConfigurationRequiredError extends Error {
  readonly code = 'CONFIGURATION_REQUIRED';

  constructor(message = 'Complete the required provider configuration before continuing.') {
    super(message);
    this.name = 'ConfigurationRequiredError';
  }
}

interface PermissionApi {
  contains(details: { origins: string[] }): Promise<boolean>;
}

interface FactoryBrowser {
  storage: BrowserStorageLike;
  scripting: Pick<typeof browser.scripting, 'executeScript'>;
  permissions?: PermissionApi;
}

export interface OperationContext {
  readonly settings: Settings;
  readonly formatter: MarkdownFormatterAdapter;
  readonly imageHost: ImageHost;
  readonly images: ImagePipelineAdapter;
  readonly jobs: JobRepository;
  readonly writer: VaultWriterAdapter;
  readonly orchestrator: ClippingJobOrchestrator;
  snapshotArticle(tabId: number): Promise<PageSnapshot>;
  selectRegion(tabId: number, selectionId: string): Promise<PageSnapshot>;
  cancelRegionSelection(tabId: number, selectionId: string): Promise<void>;
  createJob(input: {
    article: ExtractedArticle;
    markdown: string;
    imageReferences: ImageReference[];
  }): ReturnType<JobRepository['create']>;
  retryJob(jobId: string): ReturnType<ClippingJobOrchestrator['confirmAndSave']>;
  close(): void;
}

export interface OperationFactoryOptions {
  browser?: FactoryBrowser;
  jobDatabaseName?: string;
  vaultDatabaseName?: string;
}

function configuration(message: string): never {
  throw new ConfigurationRequiredError(message);
}

async function requireHostPermission(url: string, browserLike: FactoryBrowser): Promise<void> {
  const permissions = browserLike.permissions;
  if (!permissions) configuration('Runtime host permissions are unavailable.');
  let granted = false;
  try {
    granted = await permissions.contains({ origins: [originPattern(url)] });
  } catch {
    configuration('The configured provider host permission could not be verified.');
  }
  if (!granted) configuration('Grant the configured provider host permission before continuing.');
}

function createFormatter(settings: Settings, browserLike: FactoryBrowser): MarkdownFormatterAdapter {
  return {
    async format(markdown, signal) {
      if (!settings.model.apiKey) configuration('Configure the model API key before formatting.');
      await requireHostPermission(settings.model.baseUrl, browserLike);
      signal?.throwIfAborted();
      const client = settings.model.protocol === 'responses'
        ? createResponsesClient(settings.model)
        : createChatCompletionsClient(settings.model);
      const result = await formatMarkdown(markdown, client, { signal });
      return result.ok
        ? { markdown: result.markdown, warning: null }
        : { markdown: result.markdown, warning: result.warning };
    },
  };
}

function createImageHost(settings: Settings, browserLike: FactoryBrowser): ImageHost {
  const host: ImageHost = {
    async upload(image, signal) {
      if (settings.imageHost.kind === 'picgo') {
        await requireHostPermission(settings.imageHost.endpoint, browserLike);
        signal?.throwIfAborted();
        return createPicGoImageHost(settings.imageHost).upload(image, signal);
      }

      if (!settings.imageHost.accessKeyId || !settings.imageHost.secretAccessKey) {
        configuration('Configure the R2 credentials before uploading images.');
      }
      const endpoint = `https://${settings.imageHost.accountId}.r2.cloudflarestorage.com`;
      await requireHostPermission(endpoint, browserLike);
      signal?.throwIfAborted();
      return createR2ImageHost(
        settings.imageHost,
        runtimeOverrides
          ? { requestHandler: runtimeOverrides.createRequestHandler() }
          : undefined,
      ).upload(image, signal);
    },
  };
  const overrides = runtimeOverrides;
  if (!overrides) return host;
  return {
    async upload(image, signal) {
      try {
        return await host.upload(image, signal);
      } catch (error) {
        await overrides.recordDiagnostic(error);
        throw error;
      }
    },
  };
}

function createImagePipeline(imageHost: ImageHost): ImagePipelineAdapter {
  return {
    async upload(markdown, imageReferences, options) {
      const result = await uploadArticleImages(markdown, imageReferences, imageHost, options);
      return { markdown: result.markdown, urlMap: result.urlMap, failed: result.failed };
    },
  };
}

export async function createOperationContext(
  options: OperationFactoryOptions = {},
): Promise<OperationContext> {
  const browserLike = options.browser ?? (browser as unknown as FactoryBrowser);
  const settings = await createSettingsRepository(browserLike.storage).load();
  const formatter = createFormatter(settings, browserLike);
  const imageHost = createImageHost(settings, browserLike);
  const images = createImagePipeline(imageHost);
  const database = new JobDatabase(options.jobDatabaseName);
  const jobs = new JobRepository(database);
  const vaultDatabase = new VaultDatabase(options.vaultDatabaseName);
  const vaults = new VaultHandleRepository(vaultDatabase);
  const writer: VaultWriterAdapter = {
    async write(input) {
      try {
        const handle = runtimeOverrides
          ? await runtimeOverrides.loadVaultHandle()
          : await vaults.load();
        if (!handle) configuration('Choose an Obsidian vault before saving.');
        const receipt = await writeNote({
          vaultHandle: handle,
          relativeDirectory: input.targetSubdirectory,
          title: input.title,
          markdown: input.markdown,
          idempotencyKey: input.idempotencyKey,
        });
        if (runtimeOverrides && await runtimeOverrides.consumeWriteInterruption()) {
          throw new Error('Synthetic interruption after the vault write checkpoint.');
        }
        return receipt;
      } catch (error) {
        if (runtimeOverrides) {
          await runtimeOverrides.recordDiagnostic(error);
        }
        throw error;
      }
    },
  };
  const orchestrator = new ClippingJobOrchestrator(jobs, formatter, images, writer, {
    automaticModelFormatting: settings.model.automaticFormatting,
  });

  return {
    settings,
    formatter,
    imageHost,
    images,
    jobs,
    writer,
    orchestrator,
    snapshotArticle: (tabId) => snapshotTab(tabId, browserLike),
    async selectRegion(tabId, selectionId) {
      const { pageUrl, html } = await selectRegionInTab(tabId, selectionId, browserLike);
      return { pageUrl, html };
    },
    cancelRegionSelection(tabId, selectionId) {
      return cancelRegionSelectionInTab(tabId, selectionId, browserLike);
    },
    async createJob(input) {
      const validated = extractedArticleSchema.parse(input.article);
      const markdown = input.markdown;
      if (!markdown.trim()) configuration('Prepared Markdown is empty.');
      const imageReferences = input.imageReferences.map((reference) => imageReferenceSchema.parse(reference));
      return jobs.create({
        state: 'extracted',
        article: validated,
        markdown,
        imageReferences,
        targetSubdirectory: settings.vault.defaultSubdirectory,
        uploadedImageUrls: {},
        finalMarkdown: null,
        modelWarning: null,
        imageWarning: null,
        error: null,
      });
    },
    async retryJob(jobId) {
      const current = await jobs.get(jobId);
      if (!current) return orchestrator.confirmAndSave(jobId);
      return current.state === 'extracted'
        ? orchestrator.preparePreview(jobId)
        : orchestrator.confirmAndSave(jobId);
    },
    close() {
      database.close();
      vaultDatabase.close();
    },
  };
}

export async function initializeDefaultSettings(storage: BrowserStorageLike): Promise<void> {
  await createSettingsRepository(storage).ensureStoredDefaults();
}
