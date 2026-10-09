import { deleteBookmarkWithSnapshot, restoreBookmarkSnapshot, type BookmarkSnapshot } from '@/lib/bookmarkTrash';
import { undoToastAction, UNDO_TOAST_DURATION_MS } from '@/components/ui/toast-undo';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findEmptyFolders } from '@/lib/bookmarkUtils';
import { BookmarkNode } from '@/entrypoints/types';
import { Folder, Trash2, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface EmptyFolderManagerProps {
    bookmarks: BookmarkNode[];
    onRefresh: () => void;
    onBack: () => void;
}

export const EmptyFolderManager: React.FC<EmptyFolderManagerProps> = ({ bookmarks, onRefresh, onBack }) => {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [emptyFolders, setEmptyFolders] = useState<BookmarkNode[]>([]);
    const [hasScanned, setHasScanned] = useState(false);

    const handleScan = () => {
        const found = findEmptyFolders(bookmarks);
        setEmptyFolders(found);
        setHasScanned(true);
        if (found.length === 0) {
            toast({
                title: t('scanComplete'),
                description: t('noEmptyFolders'),
            });
        } else {
            toast({
                title: t('scanComplete'),
                description: t('emptyFoldersFound', { count: found.length }),
            });
        }
    };

    // 快照按删除顺序传入，恢复时倒序执行以还原原有位置
    const undoDelete = async (snapshots: BookmarkSnapshot[]) => {
        try {
            for (const snapshot of [...snapshots].reverse()) {
                await restoreBookmarkSnapshot(snapshot);
            }
            onRefresh();
            toast({ title: t('undoRestored') });
        } catch (error) {
            console.error('Undo failed:', error);
            toast({ title: t('undoFailed'), variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const target = emptyFolders.find(f => f.id === id);
            const snapshot = await deleteBookmarkWithSnapshot(id);
            setEmptyFolders(prev => prev.filter(f => f.id !== id));
            onRefresh();
            toast({
                title: t('folderDeleted'),
                description: target ? t('undoDeletedDesc', { name: target.title }) : undefined,
                duration: UNDO_TOAST_DURATION_MS,
                action: undoToastAction(t('undo'), () => undoDelete([snapshot])),
            });
        } catch (error) {
            console.error('Delete failed:', error);
            toast({
                title: t('error'),
                description: t('deleteFolderFailed'),
                variant: "destructive"
            });
        }
    };

    const handleDeleteAll = async () => {
        try {
            // Delete sequentially to avoid overwhelming browser API or race conditions
            const snapshots: BookmarkSnapshot[] = [];
            for (const folder of emptyFolders) {
                snapshots.push(await deleteBookmarkWithSnapshot(folder.id));
            }
            setEmptyFolders([]);
            onRefresh();
            toast({
                title: t('allEmptyFoldersDeleted'),
                description: t('deletedCount', { count: snapshots.length }),
                duration: UNDO_TOAST_DURATION_MS,
                action: undoToastAction(t('undo'), () => undoDelete(snapshots)),
            });
        } catch (error) {
            console.error('Delete all failed:', error);
            toast({
                title: t('error'),
                description: t('deleteFolderFailed'),
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className={cn(
                "rounded-[1.75rem] border border-border/70 bg-card/88 p-6 shadow-sm",
                "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)] blueprint:border-dashed"
            )}>
                <div className="flex items-start gap-4">
                <Button variant="outline" size="icon" className={cn("blueprint:rounded-[var(--button-radius)]")} onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="space-y-2">
                    <span className={cn(
                        "inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary",
                        "blueprint:rounded-[var(--badge-radius)] blueprint:border blueprint:border-border/60 blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.14em]"
                    )}>
                        {t('emptyFolderManager')}
                    </span>
                    <h2 className={cn("font-display text-3xl font-semibold tracking-tight", "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.18em]")}>{t('emptyFolderManager')}</h2>
                    <p className={cn("max-w-2xl text-sm text-muted-foreground", "blueprint:font-mono")}>
                        {t('emptyFolderManagerDesc')}
                    </p>
                </div>
                </div>
            </div>

            {!hasScanned ? (
                <div className={cn(
                    "mt-8 flex flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-border/80 bg-surface-2/65 p-12",
                    "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)]"
                )}>
                    <div className={cn(
                        "mb-4 rounded-full bg-primary/10 p-4",
                        "blueprint:rounded-[var(--card-radius)] blueprint:border blueprint:border-primary/30"
                    )}>
                        <Folder className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t('scanForEmptyFolders')}</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-6">
                        {t('emptyFolderScanDesc')}
                    </p>
                    <Button onClick={handleScan} size="lg" className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")}>
                        {t('startScan')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className={cn(
                        "flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-card/92 px-4 py-3 shadow-sm",
                        "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)] blueprint:border-dashed"
                    )}>
                        <h3 className={cn("text-lg font-medium", "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.14em]")}>
                            {emptyFolders.length > 0
                                ? t('emptyFoldersFound', { count: emptyFolders.length })
                                : t('noEmptyFolders')}
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="outline" className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")} onClick={handleScan}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t('rescan')}
                            </Button>
                            {emptyFolders.length > 0 && (
                                <Button variant="destructive" className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")} onClick={handleDeleteAll}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('deleteAll')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {emptyFolders.length > 0 ? (
                        <ScrollArea className={cn(
                            "h-[500px] rounded-[1.25rem] border border-border/70 bg-card/92 p-4",
                            "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)] blueprint:border-dashed"
                        )}>
                            <div className="space-y-2">
                                {emptyFolders.map((folder) => (
                                        <Card key={folder.id} className={cn(
                                            "overflow-hidden border-border/70 bg-card/92",
                                            "blueprint:rounded-[var(--card-radius)] blueprint:border-dashed"
                                        )}>
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{folder.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate font-mono">ID: {folder.id}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive flex-shrink-0"
                                                onClick={() => handleDelete(folder.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className={cn(
                            "flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/80 bg-surface-2/65 p-12 text-muted-foreground",
                            "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)] blueprint:font-mono"
                        )}>
                            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>{t('noEmptyFolders')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
