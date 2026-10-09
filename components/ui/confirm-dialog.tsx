import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** 危险操作使用红色确认按钮 */
    destructive?: boolean;
}

/**
 * 替代 window.confirm 的确认对话框：`const ok = await confirm({ ... })`。
 * 需要把返回的 `confirmDialog` 渲染在组件树中。
 */
export function useConfirmDialog() {
    const { t } = useTranslation();
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const settle = useCallback((value: boolean) => {
        resolveRef.current?.(value);
        resolveRef.current = null;
        setOptions(null);
    }, []);

    const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>((resolve) => {
        // 如有尚未关闭的对话框，视为取消，避免 Promise 悬空
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOptions(next);
    }), []);

    const confirmDialog = (
        <AlertDialog open={options !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{options?.title}</AlertDialogTitle>
                    {options?.description && (
                        <AlertDialogDescription>{options.description}</AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{options?.cancelLabel ?? t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => settle(true)}
                        className={cn(options?.destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                    >
                        {options?.confirmLabel ?? t('confirmAction')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { confirm, confirmDialog };
}
