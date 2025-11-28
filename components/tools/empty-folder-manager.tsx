import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findEmptyFolders, deleteChromeBookmark } from '@/lib/bookmarkUtils';
import { BookmarkNode } from '@/entrypoints/types';
import { Folder, Trash2, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

    const handleDelete = async (id: string) => {
        try {
            await deleteChromeBookmark(id);
            setEmptyFolders(prev => prev.filter(f => f.id !== id));
            onRefresh();
            toast({
                title: t('folderDeleted'),
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
            for (const folder of emptyFolders) {
                await deleteChromeBookmark(folder.id);
            }
            setEmptyFolders([]);
            onRefresh();
            toast({
                title: t('allEmptyFoldersDeleted'),
                description: t('deletedCount', { count: emptyFolders.length }),
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
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('emptyFolderManager')}</h2>
                    <p className="text-muted-foreground">
                        {t('emptyFolderManagerDesc')}
                    </p>
                </div>
            </div>

            {!hasScanned ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/10 mt-8">
                    <div className="mb-4 p-4 bg-primary/10 rounded-full">
                        <Folder className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t('scanForEmptyFolders')}</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-6">
                        {t('emptyFolderScanDesc')}
                    </p>
                    <Button onClick={handleScan} size="lg">
                        {t('startScan')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">
                            {emptyFolders.length > 0
                                ? t('emptyFoldersFound', { count: emptyFolders.length })
                                : t('noEmptyFolders')}
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleScan}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t('rescan')}
                            </Button>
                            {emptyFolders.length > 0 && (
                                <Button variant="destructive" onClick={handleDeleteAll}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('deleteAll')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {emptyFolders.length > 0 ? (
                        <ScrollArea className="h-[500px] border rounded-md p-4">
                            <div className="space-y-2">
                                {emptyFolders.map((folder) => (
                                    <Card key={folder.id} className="overflow-hidden">
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
                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>{t('noEmptyFolders')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
