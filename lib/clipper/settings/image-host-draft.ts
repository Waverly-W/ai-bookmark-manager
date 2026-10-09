import type { ImageHostSettings } from '../contracts/settings';

/**
 * 表单里留空的 R2 密钥表示「保持已保存的值」（已保存的密钥不会回显到界面）。
 * 保存设置和「测试图床」都通过它得到真正要使用的配置。
 */
export function resolveImageHostDraft(draft: ImageHostSettings, saved: ImageHostSettings): ImageHostSettings {
  if (draft.kind !== 'r2') return draft;
  return {
    ...draft,
    accessKeyId: draft.accessKeyId || (saved.kind === 'r2' ? saved.accessKeyId : ''),
    secretAccessKey: draft.secretAccessKey || (saved.kind === 'r2' ? saved.secretAccessKey : ''),
  };
}
