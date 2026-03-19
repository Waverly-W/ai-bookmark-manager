import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { findDuplicateBookmarks, DuplicateGroup, updateChromeBookmark, deleteChromeBookmark, getBookmarkFolders, moveChromeBookmark } from '@/lib/bookmarkUtils';
import { BookmarkNode } from '@/entrypoints/types';
import { Loader2, Save, Folder, Calendar, AlertCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { CascadingFolderSelect } from "@/components/ui/cascading-folder-select";

interface DuplicateManagerProps {
    bookmarks: BookmarkNode[];
    onRefresh: () => void;
    onBack: () => void;
}

export const DuplicateManager: React.FC<DuplicateManagerProps> = ({ bookmarks, onRefresh, onBack }) => {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [scanned, setScanned] = useState(false);
    const [folders, setFolders] = useState<any[]>([]);

    // Scan for duplicates
    const handleScan = async () => {
        setIsScanning(true);
        try {
            // Simulate a small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            const results = findDuplicateBookmarks(bookmarks);
            setDuplicates(results);
            setScanned(true);

            // Load folders for move operation
            const allFolders = await getBookmarkFolders();
            setFolders(allFolders);

            if (results.length > 0) {
                toast({
                    title: t('scanComplete', 'Scan Complete'),
                    description: t('duplicatesFound', { count: results.length }),
                });
            } else {
                toast({
                    title: t('scanComplete', 'Scan Complete'),
                    description: t('noDuplicatesFound', 'No duplicates found.'),
                });
            }
        } catch (error) {
            console.error('Scan failed:', error);
            toast({
                title: t('error'),
                description: t('scanFailed', 'Failed to scan for duplicates.'),
                variant: "destructive"
            });
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-border/70 bg-card/88 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                <Button variant="outline" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                        {t('duplicateManager')}
                    </span>
                    <h2 className="font-display text-3xl font-semibold tracking-tight">{t('duplicateOrganization', 'Duplicate Manager')}</h2>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        {t('duplicateManagerCardDesc', 'Find and merge duplicate bookmarks to clean up your collection.')}
                    </p>
                </div>
                </div>
            </div>

            {!scanned ? (
                <div className="mt-8 flex flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-border/80 bg-surface-2/65 p-12">
                    <div className="mb-4 rounded-full bg-primary/10 p-4">
                        <AlertCircle className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t('scanForDuplicates', 'Scan for Duplicates')}</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-6">
                        {t('duplicateScanDesc', 'Find bookmarks with identical URLs. You can choose which one to keep and merge them.')}
                    </p>
                    <Button onClick={handleScan} disabled={isScanning} size="lg">
                        {isScanning ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('scanning', 'Scanning...')}
                            </>
                        ) : (
                            t('startScan', 'Start Scan')
                        )}
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-card/92 px-4 py-3 shadow-sm">
                        <h3 className="text-lg font-medium">
                            {duplicates.length > 0
                                ? t('duplicatesFound', { count: duplicates.length })
                                : t('noDuplicatesFound', 'No duplicates found.')}
                        </h3>
                        <Button variant="outline" onClick={handleScan} disabled={isScanning}>
                            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : t('rescan', 'Rescan')}
                        </Button>
                    </div>

                    {duplicates.length > 0 && (
                        <div className="space-y-6">
                            {duplicates.map((group, index) => (
                                <DuplicateGroupItem
                                    key={`${group.url}-${index}`}
                                    group={group}
                                    folders={folders}
                                    onMergeComplete={() => {
                                        const newDuplicates = [...duplicates];
                                        newDuplicates.splice(index, 1);
                                        setDuplicates(newDuplicates);
                                        onRefresh();
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface DuplicateGroupItemProps {
    group: DuplicateGroup;
    folders: any[];
    onMergeComplete: () => void;
}

const DuplicateGroupItem: React.FC<DuplicateGroupItemProps> = ({ group, folders, onMergeComplete }) => {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [selectedId, setSelectedId] = useState<string>(group.bookmarks[0].id);
    const [newTitle, setNewTitle] = useState<string>(group.bookmarks[0].title);
    const [targetFolderId, setTargetFolderId] = useState<string>(group.bookmarks[0].parentId || '1');
    const [isMerging, setIsMerging] = useState(false);

    // Update form when selection changes
    const handleSelectionChange = (id: string) => {
        setSelectedId(id);
        const selected = group.bookmarks.find(b => b.id === id);
        if (selected) {
            setNewTitle(selected.title);
            setTargetFolderId(selected.parentId || '1');
        }
    };

    const handleMerge = async () => {
        setIsMerging(true);
        try {
            // 1. Update the selected bookmark
            await updateChromeBookmark(selectedId, newTitle, group.url);

            // 2. Move if folder changed
            const selected = group.bookmarks.find(b => b.id === selectedId);
            if (selected && selected.parentId !== targetFolderId) {
                await moveChromeBookmark(selectedId, targetFolderId);
            }

            // 3. Delete others
            const toDelete = group.bookmarks.filter(b => b.id !== selectedId);
            await Promise.all(toDelete.map(b => deleteChromeBookmark(b.id)));

            toast({
                title: t('mergedSuccess', 'Merged successfully'),
                description: t('mergedDesc', 'Kept 1 bookmark and deleted {{count}} duplicates.', { count: toDelete.length }),
            });

            onMergeComplete();
        } catch (error) {
            console.error('Merge failed:', error);
            toast({
                title: t('error'),
                description: t('mergeFailed', 'Failed to merge bookmarks.'),
                variant: "destructive"
            });
        } finally {
            setIsMerging(false);
        }
    };

    // Find folder name helper
    const getFolderName = (parentId?: string) => {
        if (!parentId) return 'Unknown';
        const folder = folders.find(f => f.id === parentId);
        return folder ? folder.title : 'Unknown Folder';
    };

    return (
        <Card className="overflow-hidden border-l-4 border-l-primary bg-card/92">
            <CardHeader className="bg-surface-2/85 p-3">
                <CardTitle className="text-sm font-medium break-all font-mono text-muted-foreground">
                    {group.url}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <RadioGroup value={selectedId} onValueChange={handleSelectionChange} className="space-y-2">
                    {group.bookmarks.map((bookmark) => (
                        <div
                            key={bookmark.id}
                            className={`flex cursor-pointer items-start space-x-3 rounded-[1rem] border p-3 transition-all ${selectedId === bookmark.id ? 'border-primary bg-primary/5 ring-1 ring-primary/25' : 'border-border/70 hover:bg-surface-2/70'}`}
                            onClick={() => handleSelectionChange(bookmark.id)}
                        >
                            <RadioGroupItem value={bookmark.id} id={`item-${bookmark.id}`} className="mt-1" />
                            <div className="flex-1 space-y-0.5">
                                <Label htmlFor={`item-${bookmark.id}`} className="text-sm font-medium cursor-pointer">
                                    {bookmark.title}
                                </Label>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Folder className="h-3 w-3" />
                                        {getFolderName(bookmark.parentId)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {bookmark.dateAdded ? format(new Date(bookmark.dateAdded), 'yyyy-MM-dd') : '-'}
                                    </span>
                                </div>
                            </div>
                            {selectedId === bookmark.id && (
                                <div className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                                    {t('keep', 'Keep')}
                                </div>
                            )}
                        </div>
                    ))}
                </RadioGroup>

                {/* Edit Area for Selected Item */}
                <div className="mt-4 space-y-3 border-t border-border/70 pt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t('title', 'Title')}</Label>
                            <Input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="Bookmark Title"
                                className="h-8 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t('folder', 'Folder')}</Label>
                            <CascadingFolderSelect
                                folders={folders}
                                selectedId={targetFolderId}
                                onSelect={setTargetFolderId}
                                className="w-full h-8 text-sm"
                                placeholder={t('selectFolder', 'Select Folder')}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-1">
                        <Button onClick={handleMerge} disabled={isMerging} size="sm">
                            {isMerging ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-3 w-3" />
                            )}
                            {t('mergeAndSave', 'Merge & Save')}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
