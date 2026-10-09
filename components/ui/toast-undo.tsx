import React from 'react';
import { ToastAction } from '@/components/ui/toast';

/** 删除类操作 toast 的「撤销」按钮 */
export const undoToastAction = (label: string, onUndo: () => void) => (
    <ToastAction altText={label} onClick={onUndo}>{label}</ToastAction>
);

/** 撤销窗口：足够读完提示并反应，但不会长期占住界面 */
export const UNDO_TOAST_DURATION_MS = 8000;
