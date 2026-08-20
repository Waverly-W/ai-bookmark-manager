import { browser } from 'wxt/browser';
import ExtMessage, { MessageType } from '@/entrypoints/types.ts';
import {
  runtimeRequestSchema,
  runtimeResponseSchema,
  type RuntimeRequest,
  type RuntimeResponse,
} from '@/lib/clipper/contracts/messages';
import { redactJobError } from '@/lib/clipper/jobs/state-machine';
import {
  createOperationContext,
  initializeDefaultSettings,
  type OperationContext,
} from '@/lib/clipper/jobs/factory';

async function routeClipperRequest(
  request: RuntimeRequest,
  operation: OperationContext,
): Promise<RuntimeResponse> {
  switch (request.type) {
    case 'EXTRACT_ARTICLE':
      return {
        type: 'PAGE_SNAPSHOT',
        payload: {
          kind: 'article',
          snapshot: await operation.snapshotArticle(request.payload.tabId),
        },
      };
    case 'START_REGION_SELECTION':
      return {
        type: 'PAGE_SNAPSHOT',
        payload: {
          kind: 'region',
          selectionId: request.payload.selectionId,
          snapshot: await operation.selectRegion(
            request.payload.tabId,
            request.payload.selectionId,
          ),
        },
      };
    case 'CANCEL_REGION_SELECTION':
      await operation.cancelRegionSelection(
        request.payload.tabId,
        request.payload.selectionId,
      );
      return { type: 'REGION_SELECTION_CANCELLED', payload: request.payload };
    case 'CREATE_JOB':
      return {
        type: 'JOB_UPDATED',
        payload: { job: await operation.createJob(request.payload) },
      };
    case 'GET_JOB': {
      const job = await operation.jobs.get(request.payload.jobId);
      if (!job) {
        const error = new Error('The clipping job was not found.') as Error & {
          code: string;
        };
        error.code = 'NOT_FOUND';
        throw error;
      }
      return { type: 'JOB_UPDATED', payload: { job } };
    }
    case 'GET_MOST_RECENT_INCOMPLETE':
      return {
        type: 'INCOMPLETE_JOB',
        payload: {
          job: (await operation.jobs.getMostRecentIncomplete()) ?? null,
        },
      };
    case 'PATCH_JOB':
      return {
        type: 'JOB_UPDATED',
        payload: {
          job: await operation.jobs.patchEditable(
            request.payload.jobId,
            request.payload.expectedUpdatedAt,
            request.payload.patch,
          ),
        },
      };
    case 'PREPARE_PREVIEW':
      return {
        type: 'JOB_UPDATED',
        payload: {
          job: await operation.orchestrator.preparePreview(
            request.payload.jobId,
          ),
        },
      };
    case 'FORMAT_WITH_AI':
      return {
        type: 'JOB_UPDATED',
        payload: {
          job: await operation.orchestrator.formatWithAI(request.payload.jobId),
        },
      };
    case 'UPLOAD_IMAGES':
      return {
        type: 'JOB_UPDATED',
        payload: {
          job: await operation.orchestrator.uploadImages(
            request.payload.jobId,
            undefined,
            request.payload.deniedImageOrigins,
          ),
        },
      };
    case 'CONFIRM_AND_SAVE':
      return {
        type: 'JOB_UPDATED',
        payload: {
          job: await operation.orchestrator.confirmAndSave(
            request.payload.jobId,
            undefined,
            request.payload.deniedImageOrigins,
          ),
        },
      };
    case 'RETRY_JOB':
      return {
        type: 'JOB_UPDATED',
        payload: { job: await operation.retryJob(request.payload.jobId) },
      };
    case 'DISCARD_JOB':
      await operation.jobs.discard(request.payload.jobId);
      return { type: 'JOB_DISCARDED', payload: request.payload };
  }
}

export default defineBackground(() => {
  console.log('芥子书签 Background Service Initialized!', {
    id: browser.runtime.id,
  });

  // 扩展安装或更新时的初始化
  browser.runtime.onInstalled.addListener(async () => {
    try {
      await initializeDefaultSettings(browser.storage);
    } catch (e) {
      console.warn('Failed to initialize default clipper settings:', e);
    }

    try {
      // @ts-ignore
      await browser.sidePanel?.setOptions?.({ enabled: true });
    } catch {
      // Firefox or unsupported browser
    }

    // 创建右键菜单
    browser.contextMenus.create({
      id: 'openNewTab',
      title: '打开芥子书签仪表盘',
      contexts: ['action'],
    });

    browser.contextMenus.create({
      id: 'clipToObsidian',
      title: '剪藏当前网页至 Obsidian',
      contexts: ['page', 'selection', 'action'],
    });
  });

  // 处理右键菜单点击
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (info.menuItemId === 'openNewTab') {
        await browser.tabs.create({});
      } else if (info.menuItemId === 'clipToObsidian') {
        if (tab?.windowId) {
          // @ts-ignore
          if (browser.sidePanel?.open) {
            // @ts-ignore
            await browser.sidePanel.open({ windowId: tab.windowId });
          } else {
            await browser.tabs.create({
              url: browser.runtime.getURL('/sidepanel.html' as any),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  });

  // 统一消息监听器（支持原有的 Theme/Locale 消息与 Clipper 消息）
  browser.runtime.onMessage.addListener(
    (message: any, _sender, sendResponse: (res: any) => void) => {
      // 1. 处理原本的书签扩展管理消息
      if (message && typeof message === 'object' && 'messageType' in message) {
        if (
          message.messageType === MessageType.changeTheme ||
          message.messageType === MessageType.changeLocale
        ) {
          sendResponse({ success: true });
          return;
        }
      }

      // 2. 处理 Web-to-Obsidian Clipper 管道消息
      const clipperParsed = runtimeRequestSchema.safeParse(message);
      if (clipperParsed.success) {
        (async () => {
          let operation: OperationContext | undefined;
          try {
            operation = await createOperationContext();
            const result = await routeClipperRequest(
              clipperParsed.data,
              operation,
            );
            sendResponse(runtimeResponseSchema.parse(result));
          } catch (error) {
            sendResponse(
              runtimeResponseSchema.parse({
                type: 'ERROR',
                error: redactJobError(error),
              }),
            );
          } finally {
            operation?.close();
          }
        })();
        return true; // 异步响应
      }
    },
  );
});
