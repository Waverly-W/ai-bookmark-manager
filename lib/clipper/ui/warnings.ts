import { MAX_SAFE_SEGMENT_REQUESTS } from '../contracts/limits';
import {
  IMAGE_WARNING_FALLBACK,
  MODEL_WARNING_FALLBACK,
  normalizeImageWarning,
  normalizeModelWarning,
  providerCodeMessages,
  zhCN,
} from './zh-cn';

export type Translate = (key: string, options?: Record<string, unknown>) => string;

// 任务数据里存的是中文警告文案（历史数据也是如此），显示时先规范化成受信任的文案，
// 再映射到 i18n key，这样既不改存储格式，也不会把模型返回的任意文本直接展示给用户。
const modelWarnings = new Map<string, (t: Translate) => string>([
  [zhCN.model.unavailable(), (t) => t('clipWarnModelUnavailable')],
  [zhCN.model.unavailableWithOriginal, (t) => t('clipWarnModelUnavailableWithOriginal')],
  [zhCN.model.notConfigured, (t) => t('clipWarnModelNotConfigured')],
  [zhCN.model.outputTooLarge, (t) => t('clipWarnModelOutputTooLarge')],
  [zhCN.model.warningTooLarge, (t) => t('clipWarnModelWarningTooLarge')],
  [zhCN.model.protectedChanged, (t) => t('clipWarnModelProtectedChanged')],
  [zhCN.model.segmentLimit(MAX_SAFE_SEGMENT_REQUESTS), (t) => t('clipWarnModelSegmentLimit', { count: MAX_SAFE_SEGMENT_REQUESTS })],
  [MODEL_WARNING_FALLBACK, (t) => t('clipWarnModelFallback')],
  ...Object.keys(providerCodeMessages).map((code): [string, (t: Translate) => string] => [
    zhCN.model.unavailable(code),
    (t) => t('clipWarnModelUnavailableReason', { reason: t(`clipWarnReason_${code}`) }),
  ]),
]);

export function localizeModelWarning(raw: string, t: Translate): string {
  return (modelWarnings.get(normalizeModelWarning(raw)) ?? (() => t('clipWarnModelFallback')))(t);
}

const IMAGE_WARNING_PATTERN = /(\d+) 张图片因未授予来源站点权限而保留原始 URL。|(\d+) 张图片上传失败，笔记中已保留原始 URL。/gu;

export function localizeImageWarning(raw: string, t: Translate): string {
  const normalized = normalizeImageWarning(raw);
  if (normalized === IMAGE_WARNING_FALLBACK) return t('clipWarnImageFallback');

  const parts = Array.from(normalized.matchAll(IMAGE_WARNING_PATTERN), (match) =>
    match[1] !== undefined
      ? t('clipWarnImageDenied', { count: Number(match[1]) })
      : t('clipWarnImageFailed', { count: Number(match[2]) }));
  return parts.length > 0 ? parts.join(' ') : t('clipWarnImageFallback');
}
