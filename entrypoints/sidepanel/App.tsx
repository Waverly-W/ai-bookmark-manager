import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { getI18n, useTranslation } from 'react-i18next';

import type { ClippingJob } from '@/lib/clipper/contracts/job';
import { extractedArticleSchema, type ExtractedArticle } from '@/lib/clipper/contracts/article';
import {
  MAX_PAGE_SNAPSHOT_UTF8_BYTES,
  withinJsonStringWireLimit,
} from '@/lib/clipper/contracts/limits';
import {
  runtimeResponseSchema,
  type EditableJobPatch,
  type RuntimeRequest,
  type RuntimeResponse,
} from '@/lib/clipper/contracts/messages';
import { extractArticle } from '@/lib/clipper/extraction/readability';
import { normalizeDocument } from '@/lib/clipper/extraction/normalize-document';
import { convertArticleToMarkdown } from '@/lib/clipper/markdown/converter';
import { createSettingsRepository } from '@/lib/clipper/settings/repository';
import { shouldResumeJob, summarizePendingJob } from '@/lib/clipper/jobs/resume';
import { hostLabel, hostPatternFor, requestHostAccess } from '@/lib/hostAccess';
import { VaultHandleRepository } from '@/lib/clipper/vault/database';
import { parseRelativeDirectory } from '@/lib/clipper/vault/path';
import {
  chooseVault as chooseVaultDirectory,
  requestVaultPermissionFromUserGesture,
} from '@/lib/clipper/vault/permissions';
import {
  collectImageOriginPatterns,
  findMissingImageOrigins,
  requestFrozenImageOrigins,
} from '@/lib/clipper/permissions/image-origins';
import { Editor, type EditorTab } from './components/Editor';
import { Progress, type PanelProgress } from './components/Progress';
import { localizeImageWarning, localizeModelWarning } from '@/lib/clipper/ui/warnings';

// UI Primitives
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import {
  Sparkles,
  Save,
  FolderTree,
  Copy,
  ExternalLink,
  RotateCcw,
  History,
  X,
  Loader2,
  MousePointerClick,
  AlertTriangle,
  FolderSearch,
  UploadCloud,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type SaveProgress =
  | { stage: 'uploading'; completed: number; total: number }
  | { stage: 'writing' };

export interface VaultAccess {
  name: string;
  permission: PermissionState;
  requestPermission(): Promise<void>;
}

export interface ExtractOptions {
  signal?: AbortSignal;
  /** Called right before the (slow) automatic AI formatting starts; never called when it is disabled. */
  onFormatting?(): void;
}

export interface RuntimeClient {
  getMostRecentIncomplete(signal?: AbortSignal): Promise<ClippingJob | undefined>;
  getActiveTabUrl(): Promise<string | undefined>;
  /** 申请读取某个站点的权限；必须直接由点击触发 */
  requestSiteAccess(pattern: string): Promise<boolean>;
  getJob(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
  extractActive(options?: ExtractOptions): Promise<ClippingJob>;
  preparePreview(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
  formatWithAI(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
  uploadImages(
    jobId: string,
    options?: {
      signal?: AbortSignal;
      deniedImageOrigins?: readonly string[];
    },
  ): Promise<ClippingJob>;
  prepareImagePermissions(job: ClippingJob, markdown: string): Promise<{
    missingOrigins: string[];
    rejectedSourceUrls: string[];
  }>;
  requestImagePermissions(origins: readonly string[]): Promise<{
    granted: string[];
    denied: string[];
  }>;
  patchJob(
    jobId: string,
    expectedUpdatedAt: string,
    patch: EditableJobPatch,
    signal?: AbortSignal,
  ): Promise<ClippingJob>;
  selectRegion(options?: ExtractOptions): Promise<ClippingJob>;
  cancelRegionSelection(): Promise<void>;
  confirmAndSave(
    jobId: string,
    options?: {
      signal?: AbortSignal;
      deniedImageOrigins?: readonly string[];
      onProgress?(progress: SaveProgress): void;
    },
  ): Promise<ClippingJob>;
  retryJob(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
  discardJob(jobId: string): Promise<void>;
  loadVault(): Promise<VaultAccess | undefined>;
  chooseVault(): Promise<VaultAccess>;
  copyMarkdown(markdown: string): Promise<void>;
  openExternal(url: string): Promise<void>;
}

class RegionSelectionCancelledError extends Error {
  readonly code = 'REGION_SELECTION_CANCELLED';
  constructor() {
    super('Region selection was cancelled.');
    this.name = 'RegionSelectionCancelledError';
  }
}

function isRegionSelectionCancelled(error: unknown): boolean {
  if (error instanceof RegionSelectionCancelledError) return true;
  try {
    return typeof error === 'object' && error !== null
      && (Reflect.get(error, 'code') === 'REGION_SELECTION_CANCELLED'
        || Reflect.get(error, 'code') === 'SELECTION_CANCELLED');
  } catch {
    return false;
  }
}

interface EditableDraft {
  title: string;
  targetSubdirectory: string;
  markdown: string;
}

type EditableField = keyof EditableDraft;

function changedEditableFields(
  base: ClippingJob,
  draft: EditableDraft,
  fields: readonly EditableField[] = ['title', 'targetSubdirectory', 'markdown'],
): EditableJobPatch | undefined {
  const patch: EditableJobPatch = {};
  if (fields.includes('title') && draft.title !== base.article.title) patch.title = draft.title;
  if (fields.includes('targetSubdirectory')
    && draft.targetSubdirectory !== base.targetSubdirectory) {
    patch.targetSubdirectory = draft.targetSubdirectory;
  }
  if (fields.includes('markdown') && draft.markdown !== base.markdown) patch.markdown = draft.markdown;
  return Object.keys(patch).length > 0 ? patch : undefined;
}

function editableDraft(job: ClippingJob): EditableDraft {
  return {
    title: job.article.title,
    targetSubdirectory: job.targetSubdirectory,
    markdown: job.markdown,
  };
}

function isEditableJob(job: ClippingJob): boolean {
  return job.state === 'extracted' || job.state === 'formatted';
}

function publicError(response: Extract<RuntimeResponse, { type: 'ERROR' }>): Error {
  const error = new Error(response.error.message);
  error.name = response.error.name;
  if (response.error.code) Object.assign(error, { code: response.error.code });
  return error;
}

async function send(request: RuntimeRequest): Promise<RuntimeResponse> {
  const response = runtimeResponseSchema.parse(await browser.runtime.sendMessage(request));
  if (response.type === 'ERROR') throw publicError(response);
  return response;
}

async function activeTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error(getI18n().t('clipNoActiveTab'));
  return tab.id;
}

async function autoFormatEnabled(): Promise<boolean> {
  try {
    return (await createSettingsRepository(browser.storage).load()).model.autoFormatWithAI;
  } catch {
    return false;
  }
}

function selectedRegionArticle(html: string, pageUrl: string): ExtractedArticle {
  const url = new URL(pageUrl);
  const document = new DOMParser().parseFromString(html, 'text/html');
  const normalized = normalizeDocument(document, pageUrl);
  const contentHtml = normalized.body.innerHTML || html;
  const text = (normalized.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  const heading = normalized.querySelector('h1, h2, h3')?.textContent?.trim();
  return extractedArticleSchema.parse({
    title: heading || url.hostname,
    sourceUrl: url.href,
    byline: null,
    excerpt: null,
    siteName: url.hostname,
    lang: document.documentElement.lang || null,
    published: null,
    contentHtml,
    textContent: text,
  });
}

export function createRuntimeClient(): RuntimeClient {
  const vaultRepo = new VaultHandleRepository();

  return {
    async getMostRecentIncomplete() {
      const response = await send({ type: 'GET_MOST_RECENT_INCOMPLETE', payload: {} });
      if (response.type !== 'INCOMPLETE_JOB') throw new Error('Recovery returned an invalid response.');
      return response.payload.job ?? undefined;
    },
    async getJob(jobId) {
      const response = await send({ type: 'GET_JOB', payload: { jobId } });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async getActiveTabUrl() {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      return tab?.url;
    },
    requestSiteAccess(pattern) {
      return requestHostAccess([pattern]);
    },
    async extractActive(options) {
      const signal = options?.signal;
      const tabId = await activeTabId();
      signal?.throwIfAborted();
      const response = await send({ type: 'EXTRACT_ARTICLE', payload: { tabId } });
      if (response.type !== 'PAGE_SNAPSHOT' || response.payload.kind !== 'article') {
        throw new Error('Expected article snapshot response.');
      }
      const { html, pageUrl } = response.payload.snapshot;
      if (!withinJsonStringWireLimit(html, MAX_PAGE_SNAPSHOT_UTF8_BYTES)) {
        throw new Error('Page snapshot exceeds size limit.');
      }
      const document = new DOMParser().parseFromString(html, 'text/html');
      const article = extractArticle(document, pageUrl);
      const converted = await convertArticleToMarkdown(article, { clipped: new Date().toISOString() });
      const created = await send({
        type: 'CREATE_JOB',
        payload: {
          article,
          markdown: converted.markdown,
          imageReferences: converted.imageReferences,
        },
      });
      if (created.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      if (await autoFormatEnabled()) options?.onFormatting?.();
      const readyJob = await this.preparePreview(created.payload.job.jobId);
      return readyJob;
    },
    async preparePreview(jobId) {
      const response = await send({ type: 'PREPARE_PREVIEW', payload: { jobId } });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async formatWithAI(jobId) {
      const response = await send({ type: 'FORMAT_WITH_AI', payload: { jobId } });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async uploadImages(jobId, options) {
      const response = await send({
        type: 'UPLOAD_IMAGES',
        payload: { jobId, deniedImageOrigins: [...(options?.deniedImageOrigins ?? [])] },
      });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async prepareImagePermissions(job, markdown) {
      const plan = collectImageOriginPatterns(job.imageReferences, markdown);
      const missingOrigins = await findMissingImageOrigins(plan.origins, browser.permissions);
      return {
        missingOrigins,
        rejectedSourceUrls: plan.rejectedSourceUrls,
      };
    },
    async requestImagePermissions(origins) {
      return requestFrozenImageOrigins(origins, browser.permissions);
    },
    async patchJob(jobId, expectedUpdatedAt, patch) {
      const response = await send({
        type: 'PATCH_JOB',
        payload: { jobId, expectedUpdatedAt, patch },
      });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async selectRegion(options) {
      const signal = options?.signal;
      const tabId = await activeTabId();
      const selectionId = crypto.randomUUID();
      signal?.throwIfAborted();
      const response = await send({
        type: 'START_REGION_SELECTION',
        payload: { tabId, selectionId },
      });
      if (response.type === 'REGION_SELECTION_CANCELLED') {
        throw new RegionSelectionCancelledError();
      }
      if (response.type !== 'PAGE_SNAPSHOT' || response.payload.kind !== 'region') {
        throw new Error('Expected region snapshot response.');
      }
      const { html, pageUrl } = response.payload.snapshot;
      const article = selectedRegionArticle(html, pageUrl);
      const converted = await convertArticleToMarkdown(article, { clipped: new Date().toISOString() });
      const created = await send({
        type: 'CREATE_JOB',
        payload: {
          article,
          markdown: converted.markdown,
          imageReferences: converted.imageReferences,
        },
      });
      if (created.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      if (await autoFormatEnabled()) options?.onFormatting?.();
      const readyJob = await this.preparePreview(created.payload.job.jobId);
      return readyJob;
    },
    async cancelRegionSelection() {
      const tabId = await activeTabId();
      await send({
        type: 'CANCEL_REGION_SELECTION',
        payload: { tabId, selectionId: crypto.randomUUID() },
      });
    },
    async confirmAndSave(jobId, options) {
      const response = await send({
        type: 'CONFIRM_AND_SAVE',
        payload: { jobId, deniedImageOrigins: [...(options?.deniedImageOrigins ?? [])] },
      });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async retryJob(jobId) {
      const response = await send({ type: 'RETRY_JOB', payload: { jobId } });
      if (response.type !== 'JOB_UPDATED') throw new Error('Expected JOB_UPDATED response.');
      return response.payload.job;
    },
    async discardJob(jobId) {
      await send({ type: 'DISCARD_JOB', payload: { jobId } });
    },
    async loadVault() {
      const handle = await vaultRepo.load();
      if (!handle) return undefined;
      let permission: PermissionState = 'prompt';
      try {
        const queryable = handle as unknown as { queryPermission?: (desc: { mode: string }) => Promise<PermissionState> };
        if (typeof queryable.queryPermission === 'function') {
          permission = await queryable.queryPermission({ mode: 'readwrite' });
        }
      } catch {
        permission = 'prompt';
      }
      return {
        name: handle.name,
        permission,
        async requestPermission() {
          await requestVaultPermissionFromUserGesture(handle);
        },
      };
    },
    async chooseVault() {
      const handle = await chooseVaultDirectory();
      return {
        name: handle.name,
        permission: 'granted',
        async requestPermission() {},
      };
    },
    async copyMarkdown(markdown) {
      await navigator.clipboard.writeText(markdown);
    },
    async openExternal(url) {
      await browser.tabs.create({ url });
    },
  };
}

export default function App({ client }: { client?: RuntimeClient }) {
  const runtimeClient = React.useMemo(() => client || createRuntimeClient(), [client]);
  const { t } = useTranslation();
  const { toast } = useToast();
  const [job, setJob] = useState<ClippingJob | null>(null);
  const [draft, setDraft] = useState<EditableDraft>({
    title: '',
    targetSubdirectory: '',
    markdown: '',
  });
  const [progress, setProgress] = useState<PanelProgress>({ stage: 'ready' });
  const [vault, setVault] = useState<VaultAccess | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<EditorTab>('source');
  const [isAiFormatting, setIsAiFormatting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // An unfinished clip of another page, offered instead of being restored silently.
  const [pendingJob, setPendingJob] = useState<ClippingJob | null>(null);
  const showFormatting = () => setProgress({ stage: 'formatting' });
  // 当前页面因缺少站点权限而无法读取时，保存需要申请的站点（如 https://example.com/*）
  const [siteAccess, setSiteAccess] = useState<string | null>(null);

  // 读取页面失败且是权限问题时给出「授权访问」入口；chrome:// 等页面无法授权，仍只显示错误
  const offerSiteAccess = async (err: any) => {
    setSiteAccess(null);
    if (err?.code !== 'INJECTION_FAILED') return;
    try {
      const pattern = hostPatternFor((await runtimeClient.getActiveTabUrl()) ?? '');
      if (pattern && !(await browser.permissions.contains({ origins: [pattern] }))) setSiteAccess(pattern);
    } catch {
      // 读取标签页信息失败时保持普通错误提示
    }
  };

  useEffect(() => {
    document.title = t('clipTitle');
  }, [t]);

  // Initialize
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existingVault = await runtimeClient.loadVault();
        if (mounted) setVault(existingVault);

        const [incomplete, activeUrl] = await Promise.all([
          runtimeClient.getMostRecentIncomplete(),
          runtimeClient.getActiveTabUrl(),
        ]);

        // Only resume work that belongs to the page being viewed; a clip of another
        // page is offered through the banner so the current page is never hidden.
        if (shouldResumeJob(incomplete, activeUrl)) {
          if (mounted) {
            setJob(incomplete);
            setDraft(editableDraft(incomplete));
            setProgress({ stage: 'ready' });
          }
          return;
        }

        if (incomplete && mounted) setPendingJob(incomplete);
        setProgress({ stage: 'extracting' });
        const initialJob = await runtimeClient.extractActive({ onFormatting: showFormatting });
        if (mounted) {
          setJob(initialJob);
          setDraft(editableDraft(initialJob));
          setProgress({ stage: 'ready' });
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Init failed:', err);
          setProgress({ stage: 'failed' });
          setErrorMessage(err.message || t('clipExtractFailed'));
          void offerSiteAccess(err);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [runtimeClient]);

  // Handle Draft sync on Blur
  const syncDraft = async (field?: EditableField) => {
    if (!job || !isEditableJob(job)) return;
    const patch = changedEditableFields(job, draft, field ? [field] : undefined);
    if (!patch) return;
    try {
      const updated = await runtimeClient.patchJob(job.jobId, job.updatedAt, patch);
      setJob(updated);
    } catch (err) {
      console.warn('Auto patch failed:', err);
    }
  };

  // Switch to the unfinished clip of another page; an untouched fresh extraction is dropped.
  const handleResumePending = async () => {
    if (!pendingJob) return;
    try {
      const abandoned = job && isEditableJob(job) && !changedEditableFields(job, draft) ? job : undefined;
      setJob(pendingJob);
      setDraft(editableDraft(pendingJob));
      setPendingJob(null);
      setErrorMessage(null);
      setProgress({ stage: 'ready' });
      if (abandoned) await runtimeClient.discardJob(abandoned.jobId);
    } catch (err) {
      console.warn('Discarding the replaced extraction failed:', err);
    }
  };

  const handleDiscardPending = async () => {
    if (!pendingJob) return;
    try {
      await runtimeClient.discardJob(pendingJob.jobId);
      setPendingJob(null);
      toast({ title: t('clipDiscarded') });
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('clipDiscardFailed'), description: err.message });
    }
  };

  // Re-extract
  const handleReExtract = async () => {
    try {
      setErrorMessage(null);
      setProgress({ stage: 'extracting' });
      const newJob = await runtimeClient.extractActive({ onFormatting: showFormatting });
      setJob(newJob);
      setDraft(editableDraft(newJob));
      setProgress({ stage: 'ready' });
      toast({ title: t('clipReExtracted') });
    } catch (err: any) {
      setProgress({ stage: 'failed' });
      setErrorMessage(err.message || t('clipExtractFailed'));
      void offerSiteAccess(err);
    }
  };

  // 点击「授权访问」：权限请求必须是点击处理函数里的第一个异步调用
  const handleGrantSiteAccess = async () => {
    if (!siteAccess) return;
    const granted = await runtimeClient.requestSiteAccess(siteAccess);
    if (granted) {
      setSiteAccess(null);
      await handleReExtract();
    } else {
      setErrorMessage(t('hostAccessDeniedDesc', { host: hostLabel(siteAccess.replace('/*', '')) }));
    }
  };

  // Region Selection
  const handleSelectRegion = async () => {
    try {
      setErrorMessage(null);
      setIsSelectingRegion(true);
      const newJob = await runtimeClient.selectRegion({ onFormatting: showFormatting });
      setJob(newJob);
      setDraft(editableDraft(newJob));
      setProgress({ stage: 'ready' });
      toast({ title: t('clipRegionExtracted') });
    } catch (err: any) {
      if (isRegionSelectionCancelled(err)) {
        setProgress({ stage: 'cancelled' });
      } else {
        setProgress({ stage: 'failed' });
        setErrorMessage(err.message || t('clipRegionFailed'));
        void offerSiteAccess(err);
      }
    } finally {
      setIsSelectingRegion(false);
    }
  };

  // AI Format：失败原因统一显示在页面上的横幅里（持久、可复制），toast 只给出结果标题
  const handleAIFormat = async () => {
    if (!job) return;
    try {
      setErrorMessage(null);
      await syncDraft();
      setIsAiFormatting(true);
      setProgress({ stage: 'formatting' });
      const formatted = await runtimeClient.formatWithAI(job.jobId);
      setJob(formatted);
      setDraft(editableDraft(formatted));
      setProgress({ stage: 'ready' });
      toast(formatted.modelWarning
        ? { variant: 'destructive', title: t('clipAiFormatIneffective') }
        : { title: t('clipAiFormatDone') });
    } catch (err: any) {
      setProgress({ stage: 'ready' });
      setErrorMessage(err.message || t('clipAiFormatCallFailed'));
    } finally {
      setIsAiFormatting(false);
    }
  };

  // Upload Images Only
  const handleUploadImages = async () => {
    if (!job) return;
    try {
      setErrorMessage(null);
      await syncDraft();

      setIsUploadingImages(true);
      const totalImages = job.imageReferences.length;
      setProgress({ stage: 'uploading', completed: Object.keys(job.uploadedImageUrls || {}).length, total: totalImages });

      // Request Image Permissions if needed
      const imgPerm = await runtimeClient.prepareImagePermissions(job, draft.markdown);
      let deniedOrigins: string[] = [];
      if (imgPerm.missingOrigins.length > 0) {
        const result = await runtimeClient.requestImagePermissions(imgPerm.missingOrigins);
        deniedOrigins = result.denied;
      }

      const updatedJob = await runtimeClient.uploadImages(job.jobId, {
        deniedImageOrigins: deniedOrigins,
      });
      setJob(updatedJob);
      setDraft(editableDraft(updatedJob));
      const uploadedCount = Object.keys(updatedJob.uploadedImageUrls || {}).length;
      setProgress({ stage: 'ready' });
      toast({
        title: t('clipUploadDone'),
        description: t('clipUploadDoneDesc', { total: totalImages, uploaded: uploadedCount }),
      });
    } catch (err: any) {
      setProgress({ stage: 'ready' });
      setErrorMessage(err.message || t('clipUploadFailed'));
    } finally {
      setIsUploadingImages(false);
    }
  };

  // Select Vault
  const handleChooseVault = async () => {
    try {
      const v = await runtimeClient.chooseVault();
      setVault(v);
      toast({ title: t('clipVaultAuthorized'), description: v.name });
    } catch (err: any) {
      // 用户在系统目录选择框里点了取消，不算错误
      if (err?.name !== 'AbortError') setErrorMessage(err.message || t('clipVaultAuthFailed'));
    }
  };

  // 目录已绑定但浏览器要求重新确认访问权限（必须由点击触发）
  const handleAuthorizeVault = async () => {
    if (!vault) return;
    try {
      setErrorMessage(null);
      await vault.requestPermission();
      const refreshed = await runtimeClient.loadVault();
      setVault(refreshed);
      if (refreshed?.permission === 'granted') {
        toast({ title: t('clipVaultAuthorized'), description: refreshed.name });
      } else {
        setErrorMessage(t('clipVaultAuthFailed'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('clipVaultAuthFailed'));
    }
  };

  // Save to Obsidian
  const handleSave = async () => {
    if (!job) return;
    try {
      setErrorMessage(null);
      await syncDraft();

      // 选择 / 授权 Vault 是主按钮的独立步骤，保存时不再隐式弹出目录选择器
      if (!vault || vault.permission !== 'granted') return;

      setIsSaving(true);
      setProgress({ stage: 'uploading', completed: 0, total: job.imageReferences.length });

      // Request Image Permissions if needed
      const imgPerm = await runtimeClient.prepareImagePermissions(job, draft.markdown);
      let deniedOrigins: string[] = [];
      if (imgPerm.missingOrigins.length > 0) {
        const result = await runtimeClient.requestImagePermissions(imgPerm.missingOrigins);
        deniedOrigins = result.denied;
      }

      setProgress({ stage: 'writing' });
      const completed = await runtimeClient.confirmAndSave(job.jobId, {
        deniedImageOrigins: deniedOrigins,
      });
      setJob(completed);
      setProgress({ stage: 'completed' });
      toast({ title: t('clipSaved') });
    } catch (err: any) {
      setProgress({ stage: 'failed' });
      setErrorMessage(err.message || t('clipSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Markdown
  const handleCopy = async () => {
    try {
      await runtimeClient.copyMarkdown(draft.markdown);
      setIsCopied(true);
      toast({ title: t('clipCopied') });
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: t('clipCopyFailed') });
    }
  };

  const busy = isAiFormatting || isUploadingImages || isSaving || isSelectingRegion
    || progress.stage === 'extracting' || progress.stage === 'formatting';
  const pendingImages = job
    ? job.imageReferences.filter((reference) => !job.uploadedImageUrls[reference.sourceUrl]).length
    : 0;
  const primaryAction: 'choose-vault' | 'authorize-vault' | 'save' = !vault
    ? 'choose-vault'
    : vault.permission !== 'granted'
      ? 'authorize-vault'
      : 'save';
  const primaryLabel = isSaving
    ? t('clipSaving')
    : primaryAction === 'choose-vault'
      ? t('clipChooseVault')
      : primaryAction === 'authorize-vault'
        ? t('clipAuthorizeVault')
        : t('clipSave');
  const primaryNote = primaryAction === 'choose-vault'
    ? t('clipChooseVaultNote')
    : primaryAction === 'authorize-vault'
      ? t('clipAuthorizeVaultNote')
      : pendingImages > 0
        ? t('clipSaveImagesNote', { count: pendingImages })
        : null;
  const handlePrimary = primaryAction === 'choose-vault'
    ? handleChooseVault
    : primaryAction === 'authorize-vault'
      ? handleAuthorizeVault
      : handleSave;
  const warnings = job
    ? [
        job.modelWarning ? localizeModelWarning(job.modelWarning, t) : null,
        job.imageWarning ? localizeImageWarning(job.imageWarning, t) : null,
      ].filter((warning): warning is string => Boolean(warning))
    : [];

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-background text-sm text-foreground blueprint:font-mono">
      {/* 可滚动的内容区：窗口较矮时整体滚动，而不是把编辑区挤没 */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        <div className="space-y-2 border-b pb-2">
          <div className="flex items-center gap-2 text-base font-semibold blueprint:uppercase blueprint:tracking-[0.12em]">
            <FolderTree className="h-4 w-4 shrink-0 text-primary" />
            <h1>{t('clipTitle')}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 min-w-[7rem] flex-1"
              onClick={handleReExtract}
              disabled={busy}
              title={t('clipReExtractHint')}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {t('clipReExtract')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 min-w-[7rem] flex-1"
              onClick={handleSelectRegion}
              disabled={busy}
              title={t('clipSelectRegionHint')}
            >
              <MousePointerClick className="mr-1.5 h-4 w-4" />
              {t('clipSelectRegion')}
            </Button>
          </div>
        </div>

        <Progress progress={progress} />

        {pendingJob && (() => {
          const { title, host } = summarizePendingJob(pendingJob);
          return (
            <div className="flex items-center gap-2 rounded border bg-muted/60 p-2">
              <History className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{t('clipPendingTitle')}</div>
                <div className="truncate font-medium" title={`${title}${host ? ` (${host})` : ''}`}>
                  {title}{host ? ` (${host})` : ''}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleResumePending}>
                {t('clipPendingResume')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={handleDiscardPending}
                aria-label={t('clipDiscardAria')}
                title={t('clipPendingDiscard')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })()}

        {errorMessage && !siteAccess && (
          <div role="alert" className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="max-h-28 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-xs">{errorMessage}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0 text-destructive hover:text-destructive"
              onClick={() => { void runtimeClient.copyMarkdown(errorMessage); }}
              aria-label={t('clipErrorCopy')}
              title={t('clipErrorCopy')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0 text-destructive hover:text-destructive"
              onClick={() => setErrorMessage(null)}
              aria-label={t('clipErrorDismiss')}
              title={t('clipErrorDismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {siteAccess && (
          <div role="status" className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 p-2">
            <p className="min-w-0 flex-1 text-xs">{t('clipSiteAccessNote', { host: hostLabel(siteAccess.replace('/*', '')) })}</p>
            <Button size="sm" className="h-8 shrink-0 px-3" onClick={handleGrantSiteAccess}>
              {t('clipSiteAccessGrant')}
            </Button>
          </div>
        )}

        {warnings.length > 0 && (
          <div role="status" className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-0.5 text-xs">
              {warnings.map((warning) => (
                <p key={warning} className="break-words">{warning}</p>
              ))}
            </div>
          </div>
        )}

        {/* Meta Form: Title & Subdir */}
        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor="clip-title" className="block text-sm font-medium text-muted-foreground">
              {t('clipNoteTitle')}
            </label>
            <Input
              id="clip-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onBlur={() => syncDraft('title')}
              className="h-9 text-sm font-medium"
              placeholder={t('clipNoteTitlePlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="clip-subdir" className="block text-sm font-medium text-muted-foreground">
              {t('clipSubdir')}
            </label>
            <Input
              id="clip-subdir"
              value={draft.targetSubdirectory}
              onChange={(e) =>
                setDraft((d) => ({ ...d, targetSubdirectory: e.target.value }))
              }
              onBlur={() => syncDraft('targetSubdirectory')}
              className="h-9 font-mono text-sm"
              placeholder={t('clipSubdirPlaceholder')}
            />
          </div>
        </div>

        <Editor
          markdown={draft.markdown}
          imageReferences={job?.imageReferences}
          uploadedImageUrls={job?.uploadedImageUrls}
          activeTab={activeTab}
          onMarkdownChange={(val) => setDraft((d) => ({ ...d, markdown: val }))}
          onMarkdownBlur={() => syncDraft('markdown')}
          onTabChange={setActiveTab}
        />
      </div>

      {/* 固定在底部的操作区：一个主按钮 + 两个辅助操作 */}
      <div className="shrink-0 space-y-2 border-t bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-9 min-w-0 justify-start gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleChooseVault}
            title={t('clipVaultHint')}
          >
            <FolderSearch className="h-4 w-4 shrink-0" />
            <span className="truncate">{vault ? vault.name : t('clipVaultNone')}</span>
            {vault && vault.permission !== 'granted' && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 text-xs text-amber-700 dark:text-amber-400">
                {t('clipVaultNeedsAuth')}
              </span>
            )}
            {vault && vault.permission === 'granted' && (
              <span className="shrink-0 text-xs underline-offset-2 hover:underline">{t('clipVaultChange')}</span>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0 px-3"
            onClick={handleCopy}
            disabled={!draft.markdown}
          >
            {isCopied ? <Check className="mr-1.5 h-4 w-4 text-emerald-500" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {isCopied ? t('clipCopiedButton') : t('clipCopyButton')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={handleAIFormat}
            disabled={busy || !draft.markdown}
            title={t('clipAiFormatHint')}
          >
            {isAiFormatting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {isAiFormatting ? t('clipAiFormatting') : t('clipAiFormat')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={handleUploadImages}
            disabled={busy || !draft.markdown || !job || job.imageReferences.length === 0}
            title={job && job.imageReferences.length === 0 ? t('clipNoImages') : t('clipUploadImagesHint')}
          >
            {isUploadingImages ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
            {isUploadingImages ? t('clipUploadingImages') : t('clipUploadImages')}
          </Button>
        </div>

        {primaryNote && <p className="text-xs text-muted-foreground">{primaryNote}</p>}

        <Button
          className="h-10 w-full font-semibold"
          onClick={handlePrimary}
          disabled={primaryAction === 'save' ? busy || !draft.markdown : isSaving}
        >
          {isSaving
            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            : primaryAction === 'save'
              ? <Save className="mr-1.5 h-4 w-4" />
              : <FolderSearch className="mr-1.5 h-4 w-4" />}
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
