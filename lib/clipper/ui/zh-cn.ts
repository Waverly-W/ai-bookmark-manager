import { MAX_IMAGE_REFERENCES, MAX_SAFE_SEGMENT_REQUESTS } from '../contracts/limits';

export const zhCN = {
  common: {
    working: '处理中…',
    cancel: '取消',
    retry: '重试',
  },
  model: {
    unavailable: (code?: string) => {
      const reason = code && Object.hasOwn(providerCodeMessages, code)
        ? providerCodeMessages[code as ProviderCode]
        : undefined;
      return reason ? `模型格式化不可用：${reason}` : '模型格式化不可用。';
    },
    unavailableWithOriginal: '模型格式化不可用，已保留原始笔记内容供检查。',
    notConfigured: '尚未配置 AI 服务，请先在「AI 设置」中完成配置。已保留原始笔记内容。',
    outputTooLarge: '模型输出过大，已保留原始笔记内容。',
    warningTooLarge: '模型警告过长，已将其丢弃。',
    protectedChanged: '模型修改了受保护内容，已保留原始笔记内容。',
    segmentLimit: (count: number) => `模型格式化的文本分段超过 ${count} 个，已保留原始笔记内容。`,
  },
  image: {
    denied: (count: number) => `${count} 张图片因未授予来源站点权限而保留原始 URL。`,
    failed: (count: number) => `${count} 张图片上传失败，笔记中已保留原始 URL。`,
  },
  progress: {
    uploading: (completed: number, total: number) => `正在上传图片 ${completed}/${total}`,
  },
  save: {
    uploadCount: (count: number) => `写入笔记前将上传 ${count} 张图片。`,
    rejectedImageSources: (count: number) => `${count} 个非网页图片来源将保留原始 URL。`,
  },
} as const;

export const providerCodeMessages = {
  TIMEOUT: '模型服务响应超时。',
  HTTP_ERROR: '模型服务返回请求错误。',
  INVALID_RESPONSE: '模型服务返回了无效响应。',
  INCOMPLETE_RESPONSE: '模型服务返回的内容不完整。',
  ABORTED: '模型请求已取消。',
  NETWORK_ERROR: '无法连接模型服务。',
  CONTEXT_LENGTH: '文章内容超出模型上下文长度。',
} as const;

type ProviderCode = keyof typeof providerCodeMessages;

export const MODEL_WARNING_FALLBACK = '模型格式化未生效，已保留原始 Markdown。';
export const IMAGE_WARNING_FALLBACK = '部分图片处理未完成，笔记中已保留可用内容。';

const trustedModelWarnings = new Set<string>([
  zhCN.model.unavailable(),
  ...Object.keys(providerCodeMessages).map((code) => zhCN.model.unavailable(code)),
  zhCN.model.unavailableWithOriginal,
  zhCN.model.notConfigured,
  zhCN.model.outputTooLarge,
  zhCN.model.warningTooLarge,
  zhCN.model.protectedChanged,
]);

export function normalizeModelWarning(warning: string): string {
  if (trustedModelWarnings.has(warning)) return warning;
  const current = /^模型格式化的文本分段超过 ([1-9]\d*) 个，已保留原始笔记内容。$/u.exec(warning);
  const legacy = /^Safe-segment formatting exceeded ([1-9]\d*) model requests\.$/u.exec(warning);
  const rawCount = current?.[1] ?? legacy?.[1];
  const count = rawCount === undefined ? undefined : Number(rawCount);
  if (count !== undefined
    && Number.isSafeInteger(count)
    && count === MAX_SAFE_SEGMENT_REQUESTS) {
    return zhCN.model.segmentLimit(MAX_SAFE_SEGMENT_REQUESTS);
  }
  return MODEL_WARNING_FALLBACK;
}

function supportedImageCount(raw: string): number | undefined {
  const count = Number(raw);
  return Number.isSafeInteger(count) && count > 0 && count <= MAX_IMAGE_REFERENCES
    ? count
    : undefined;
}

export function normalizeImageWarning(warning: string): string {
  const parsers: Array<(input: string) => { consumed: string; normalized: string } | undefined> = [
    (input) => {
      const match = /^([1-9]\d*) 张图片因未授予来源站点权限而保留原始 URL。/u.exec(input);
      const count = match ? supportedImageCount(match[1]) : undefined;
      return match && count !== undefined ? { consumed: match[0], normalized: zhCN.image.denied(count) } : undefined;
    },
    (input) => {
      const match = /^([1-9]\d*) 张图片上传失败，笔记中已保留原始 URL。/u.exec(input);
      const count = match ? supportedImageCount(match[1]) : undefined;
      return match && count !== undefined ? { consumed: match[0], normalized: zhCN.image.failed(count) } : undefined;
    },
    (input) => {
      const match = /^([1-9]\d*) images? (?:was|were) kept because source-host permission was not granted\./u.exec(input);
      const count = match ? supportedImageCount(match[1]) : undefined;
      return match && count !== undefined ? { consumed: match[0], normalized: zhCN.image.denied(count) } : undefined;
    },
    (input) => {
      const match = /^([1-9]\d*) images? failed; (?:its|their) original URLs? remains? in the note\./u.exec(input);
      const count = match ? supportedImageCount(match[1]) : undefined;
      return match && count !== undefined ? { consumed: match[0], normalized: zhCN.image.failed(count) } : undefined;
    },
  ];
  let remaining = warning.trim();
  const normalized: string[] = [];
  while (remaining) {
    const parsed = parsers.map((parser) => parser(remaining)).find(Boolean);
    if (!parsed) return IMAGE_WARNING_FALLBACK;
    if (!normalized.includes(parsed.normalized)) normalized.push(parsed.normalized);
    remaining = remaining.slice(parsed.consumed.length).trimStart();
  }
  return normalized.length > 0 ? normalized.join(' ') : IMAGE_WARNING_FALLBACK;
}
