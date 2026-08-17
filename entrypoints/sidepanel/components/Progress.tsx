import React from 'react';
import { Progress as ProgressBar } from '@/components/ui/progress.tsx';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, UploadCloud, FileEdit } from 'lucide-react';
import { zhCN } from '@/lib/clipper/ui/zh-cn';

export type PanelProgress =
  | { stage: 'extracting' }
  | { stage: 'formatting' }
  | { stage: 'ready' }
  | { stage: 'uploading'; completed: number; total: number }
  | { stage: 'writing' }
  | { stage: 'completed' }
  | { stage: 'cancelled' }
  | { stage: 'failed' };

function getStatusDetails(progress: PanelProgress) {
  switch (progress.stage) {
    case 'extracting':
      return {
        label: '正在提取正文…',
        icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
        color: 'text-primary'
      };
    case 'formatting':
      return {
        label: 'AI 正在排版优化…',
        icon: <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />,
        color: 'text-amber-500'
      };
    case 'ready':
      return {
        label: '就绪（可编辑并保存）',
        icon: <FileEdit className="h-4 w-4 text-emerald-500" />,
        color: 'text-emerald-500'
      };
    case 'uploading':
      return {
        label: zhCN.progress.uploading(progress.completed, progress.total),
        icon: <UploadCloud className="h-4 w-4 animate-bounce text-blue-500" />,
        color: 'text-blue-500'
      };
    case 'writing':
      return {
        label: '正在写入 Obsidian 库…',
        icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
        color: 'text-primary'
      };
    case 'completed':
      return {
        label: '笔记已保存至 Obsidian',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        color: 'text-emerald-500'
      };
    case 'cancelled':
      return {
        label: '已取消区域选择',
        icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
        color: 'text-muted-foreground'
      };
    case 'failed':
      return {
        label: '操作失败',
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
        color: 'text-destructive'
      };
  }
}

export function Progress({ progress }: { progress: PanelProgress }) {
  const { label, icon, color } = getStatusDetails(progress);

  const percent = progress.stage === 'uploading'
    ? progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
    : progress.stage === 'completed'
      ? 100
      : undefined;

  return (
    <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/50 border text-xs" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className={`font-medium ${color}`}>{label}</span>
        </div>
        {progress.stage === 'uploading' && (
          <span className="text-muted-foreground text-[11px]">
            {progress.completed} / {progress.total}
          </span>
        )}
      </div>
      {percent !== undefined && (
        <ProgressBar value={percent} className="h-1.5 w-full" />
      )}
    </div>
  );
}
