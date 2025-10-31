import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BookmarkCardItem } from './bookmark-card';

interface FolderEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: BookmarkCardItem | null;
    onSave: (id: string, title: string) => Promise<void>;
}

export const FolderEditDialog: React.FC<FolderEditDialogProps> = ({
    open,
    onOpenChange,
    folder,
    onSave
}) => {
    const { t } = useTranslation('common');
    const { toast } = useToast();

    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // 当弹窗打开时，初始化表单数据
    useEffect(() => {
        if (open && folder) {
            setTitle(folder.title);
            setIsSaving(false);
        }
    }, [open, folder]);

    // 当弹窗关闭时，重置所有状态
    useEffect(() => {
        if (!open) {
            setIsSaving(false);
        }
    }, [open]);

    // 处理保存
    const handleSave = async () => {
        if (!folder) return;

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            toast({
                title: t('saveFolderFailed'),
                description: t('folderNameRequired'),
                variant: "destructive"
            });
            return;
        }

        if (trimmedTitle === folder.title) {
            // 没有变化，直接关闭
            onOpenChange(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(folder.id, trimmedTitle);
            toast({
                title: t('folderUpdated'),
                description: t('folderUpdatedSuccessfully'),
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Save folder error:', error);
            toast({
                title: t('saveFolderFailed'),
                description: error instanceof Error ? error.message : t('saveFolderFailed'),
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    // 处理取消
    const handleCancel = () => {
        console.log('Folder dialog cancel clicked');
        // 重置表单状态
        if (folder) {
            setTitle(folder.title);
        }
        setIsSaving(false);
        onOpenChange(false);
    };

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isSaving) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    if (!folder) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[425px]"
                onKeyDown={handleKeyDown}
            >
                <DialogHeader>
                    <DialogTitle>{t('editFolder')}</DialogTitle>
                    <DialogDescription>
                        {t('editFolderDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* 文件夹名称 */}
                    <div className="grid gap-2">
                        <Label htmlFor="folder-name">{t('folderName')}</Label>
                        <Input
                            id="folder-name"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('folderNamePlaceholder')}
                            disabled={isSaving}
                            autoFocus
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !title.trim()}
                    >
                        {isSaving ? t('saving') + '...' : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
