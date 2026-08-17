import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

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
import { normalizeImageWarning, normalizeModelWarning, zhCN } from '@/lib/clipper/ui/zh-cn';

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
  MousePointerClick,
  AlertTriangle,
  FolderSearch,
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

export interface RuntimeClient {
  getMostRecentIncomplete(signal?: AbortSignal): Promise<ClippingJob | undefined>;
  getJob(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
  extractActive(signal?: AbortSignal): Promise<ClippingJob>;
  preparePreview(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
  formatWithAI(jobId: string, signal?: AbortSignal): Promise<ClippingJob>;
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
  selectRegion(signal?: AbortSignal): Promise<ClippingJob>;
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
  if (!tab?.id) throw new Error('无法获取当前活动标签页。');
  return tab.id;
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
    async extractActive(signal) {
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
      return created.payload.job;
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
    async selectRegion(signal) {
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
      return created.payload.job;
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
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existingVault = await runtimeClient.loadVault();
        if (mounted) setVault(existingVault);

        setProgress({ stage: 'extracting' });
        const initialJob = (await runtimeClient.getMostRecentIncomplete()) ?? (await runtimeClient.extractActive());
        if (mounted) {
          setJob(initialJob);
          setDraft(editableDraft(initialJob));
          setProgress({ stage: 'ready' });
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Init failed:', err);
          setProgress({ stage: 'failed' });
          setErrorMessage(err.message || '提取文章失败');
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

  // Re-extract
  const handleReExtract = async () => {
    try {
      setErrorMessage(null);
      setProgress({ stage: 'extracting' });
      const newJob = await runtimeClient.extractActive();
      setJob(newJob);
      setDraft(editableDraft(newJob));
      setProgress({ stage: 'ready' });
      toast({ title: '已重新提取页面' });
    } catch (err: any) {
      setProgress({ stage: 'failed' });
      setErrorMessage(err.message || '提取失败');
    }
  };

  // Region Selection
  const handleSelectRegion = async () => {
    try {
      setErrorMessage(null);
      setIsSelectingRegion(true);
      const newJob = await runtimeClient.selectRegion();
      setJob(newJob);
      setDraft(editableDraft(newJob));
      setProgress({ stage: 'ready' });
      toast({ title: '区域内容提取成功' });
    } catch (err: any) {
      if (isRegionSelectionCancelled(err)) {
        setProgress({ stage: 'cancelled' });
      } else {
        setProgress({ stage: 'failed' });
        setErrorMessage(err.message || '区域选择失败');
      }
    } finally {
      setIsSelectingRegion(false);
    }
  };

  // AI Format
  const handleAIFormat = async () => {
    if (!job) return;
    try {
      await syncDraft();
      setIsAiFormatting(true);
      setProgress({ stage: 'formatting' });
      const formatted = await runtimeClient.formatWithAI(job.jobId);
      setJob(formatted);
      setDraft(editableDraft(formatted));
      setProgress({ stage: 'ready' });
      toast({ title: 'AI 结构化排版完成' });
    } catch (err: any) {
      setProgress({ stage: 'ready' });
      toast({
        variant: 'destructive',
        title: 'AI 排版失败',
        description: err.message || '调用大模型服务失败',
      });
    } finally {
      setIsAiFormatting(false);
    }
  };

  // Select Vault
  const handleChooseVault = async () => {
    try {
      const v = await runtimeClient.chooseVault();
      setVault(v);
      toast({ title: '已授权 Obsidian Vault', description: v.name });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Vault 授权失败',
        description: err.message,
      });
    }
  };

  // Save to Obsidian
  const handleSave = async () => {
    if (!job) return;
    try {
      setErrorMessage(null);
      await syncDraft();

      // Check Vault permission
      if (!vault || vault.permission !== 'granted') {
        const v = await runtimeClient.chooseVault();
        setVault(v);
      }

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
      toast({ title: '已保存至 Obsidian Vault！' });
    } catch (err: any) {
      setProgress({ stage: 'failed' });
      setErrorMessage(err.message || '保存失败');
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Markdown
  const handleCopy = async () => {
    try {
      await runtimeClient.copyMarkdown(draft.markdown);
      setIsCopied(true);
      toast({ title: 'Markdown 已复制到剪贴板' });
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: '复制失败' });
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen p-3 space-y-2.5 overflow-hidden bg-background text-foreground text-xs">
      {/* Top Header / Progress */}
      <div className="flex items-center justify-between pb-1 border-b">
        <div className="flex items-center gap-1.5 font-semibold text-sm">
          <FolderTree className="h-4 w-4 text-primary" />
          <span>网页剪藏至 Obsidian</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={handleReExtract}
            title="重新提取"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            重提
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={handleSelectRegion}
            disabled={isSelectingRegion}
            title="选择页面区域提取"
          >
            <MousePointerClick className="h-3.5 w-3.5 mr-1" />
            选区
          </Button>
        </div>
      </div>

      {/* Progress & Alert Banner */}
      <Progress progress={progress} />

      {errorMessage && (
        <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-1.5 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* Meta Form: Title & Subdir */}
      <div className="space-y-1.5">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">
            笔记标题
          </label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            onBlur={() => syncDraft('title')}
            className="h-8 text-xs font-medium"
            placeholder="文章标题..."
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">
            Vault 存放子目录（相对路径）
          </label>
          <Input
            value={draft.targetSubdirectory}
            onChange={(e) =>
              setDraft((d) => ({ ...d, targetSubdirectory: e.target.value }))
            }
            onBlur={() => syncDraft('targetSubdirectory')}
            className="h-8 text-xs font-mono"
            placeholder="Clippings/ (留空为根目录)"
          />
        </div>
      </div>

      {/* Main Markdown Editor & Preview */}
      <Editor
        markdown={draft.markdown}
        activeTab={activeTab}
        onMarkdownChange={(val) => setDraft((d) => ({ ...d, markdown: val }))}
        onMarkdownBlur={() => syncDraft('markdown')}
        onTabChange={setActiveTab}
      />

      {/* Bottom Action Footer */}
      <div className="pt-1.5 border-t flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* Vault Status */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleChooseVault}
              title="设置或切换 Obsidian Vault 目标目录"
            >
              <FolderSearch className="h-3.5 w-3.5 mr-1" />
              <span>{vault ? vault.name : '未选择 Vault 目录'}</span>
            </Button>
          </div>

          {/* Auxiliary actions */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={handleCopy}
            >
              {isCopied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {isCopied ? '已复制' : '复制 MD'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400 font-medium"
              onClick={handleAIFormat}
              disabled={isAiFormatting || !draft.markdown}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {isAiFormatting ? '排版中…' : 'AI 规范排版'}
            </Button>
          </div>
        </div>

        {/* Primary Save Button */}
        <Button
          size="sm"
          className="w-full h-8 text-xs font-semibold flex items-center justify-center gap-1.5"
          onClick={handleSave}
          disabled={isSaving || !draft.markdown}
        >
          <Save className="h-4 w-4" />
          {isSaving ? '处理中…' : '上传图片并保存到 Obsidian'}
        </Button>
      </div>
    </div>
  );
}
