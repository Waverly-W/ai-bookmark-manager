import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2 } from 'lucide-react';
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
import { getAIConfig, isAIConfigured } from '@/lib/aiConfigUtils';
import { renameBookmarkWithAI } from '@/lib/aiService';

interface BookmarkEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookmark: BookmarkCardItem | null;
    onSave: (id: string, title: string, url: string) => Promise<void>;
}

export const BookmarkEditDialog: React.FC<BookmarkEditDialogProps> = ({
    open,
    onOpenChange,
    bookmark,
    onSave
}) => {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 当弹窗打开时，初始化表单数据
    useEffect(() => {
        if (open && bookmark) {
            setTitle(bookmark.title);
            setUrl(bookmark.url || '');
            setIsRenaming(false);
            setIsSaving(false);
        }
    }, [open, bookmark]);

    // 当弹窗关闭时，重置所有状态
    useEffect(() => {
        if (!open) {
            setIsRenaming(false);
            setIsSaving(false);
        }
    }, [open]);

    // 处理AI重命名
    const handleAIRename = async () => {
        if (!bookmark?.url) {
            toast({
                title: t('renameFailed'),
                description: 'URL is required for AI rename',
                variant: "destructive"
            });
            return;
        }

        // 检查AI配置
        const aiConfigured = await isAIConfigured();
        if (!aiConfigured) {
            toast({
                title: t('aiNotConfigured'),
                description: 'Please configure AI service in settings first',
                variant: "destructive"
            });
            return;
        }

        setIsRenaming(true);
        try {
            const config = await getAIConfig();
            if (!config) {
                throw new Error('AI configuration not found');
            }

            const result = await renameBookmarkWithAI(
                config,
                bookmark.url,
                bookmark.title,
                i18n.language
            );

            if (result.success && result.newTitle) {
                setTitle(result.newTitle);
                toast({
                    title: 'AI Rename Success',
                    description: 'AI has suggested a new title for your bookmark',
                });
            } else {
                throw new Error(result.error || 'AI rename failed');
            }
        } catch (error) {
            console.error('AI rename error:', error);
            toast({
                title: t('renameFailed'),
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                variant: "destructive"
            });
        } finally {
            setIsRenaming(false);
        }
    };

    // 处理保存
    const handleSave = async () => {
        if (!bookmark) return;

        if (!title.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Bookmark name cannot be empty',
                variant: "destructive"
            });
            return;
        }

        if (!url.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Bookmark URL cannot be empty',
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            await onSave(bookmark.id, title.trim(), url.trim());
            console.log('Bookmark saved successfully');
            toast({
                title: 'Success',
                description: 'Bookmark updated successfully',
            });
            // 重置状态并关闭弹窗
            setIsRenaming(false);
            setIsSaving(false);
            console.log('Closing dialog after save');
            onOpenChange(false);
        } catch (error) {
            console.error('Save bookmark error:', error);
            toast({
                title: 'Save Failed',
                description: error instanceof Error ? error.message : 'Failed to save bookmark',
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    // 处理取消
    const handleCancel = () => {
        console.log('Dialog cancel clicked');
        // 重置表单状态
        if (bookmark) {
            setTitle(bookmark.title);
            setUrl(bookmark.url || '');
        }
        setIsRenaming(false);
        setIsSaving(false);
        onOpenChange(false);
    };

    if (!bookmark) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[425px]"
                onPointerDownOutside={(e) => {
                    console.log('Pointer down outside dialog');
                }}
                onInteractOutside={(e) => {
                    console.log('Interact outside dialog');
                }}
            >
                <DialogHeader>
                    <DialogTitle>{t('editBookmark')}</DialogTitle>
                    <DialogDescription>
                        {t('editBookmarkDescription')}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    {/* 书签名称 */}
                    <div className="grid gap-2">
                        <Label htmlFor="bookmark-name">{t('bookmarkName')}</Label>
                        <div className="flex gap-2">
                            <Input
                                id="bookmark-name"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('bookmarkName')}
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleAIRename}
                                disabled={isRenaming || !bookmark.url}
                                title={t('aiRename')}
                            >
                                {isRenaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* 书签URL */}
                    <div className="grid gap-2">
                        <Label htmlFor="bookmark-url">{t('bookmarkUrl')}</Label>
                        <Input
                            id="bookmark-url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            t('save')
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
