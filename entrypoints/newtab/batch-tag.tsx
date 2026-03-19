import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, AlertTriangle, Loader2, Tags, RotateCcw, WandSparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CascadingFolderSelect } from '@/components/ui/cascading-folder-select';
import { getBookmarksInFolder, getBookmarkFolderTree, BookmarkFolder, broadcastBookmarkUpdate } from '@/lib/bookmarkUtils';
import { batchTagBookmarks, BatchTaggingResult } from '@/lib/aiService';
import { getAIConfig, isAIConfigured } from '@/lib/aiConfigUtils';
import { getTagsMapForBookmarks, mergeTags, saveTagsForBookmarks } from '@/lib/tagStorage';

interface BookmarkItem {
    id: string;
    title: string;
    url: string;
}

enum BatchTagStep {
    FolderSelection = 'folder-selection',
    Processing = 'processing',
    Review = 'review'
}

interface ReviewTagResult extends BatchTaggingResult {
    selected: boolean;
    finalTags: string[];
}

const findFolderTitle = (folders: BookmarkFolder[], folderId: string): string => {
    for (const folder of folders) {
        if (folder.id === folderId) {
            return folder.title;
        }
        if (folder.children) {
            const nestedTitle = findFolderTitle(folder.children, folderId);
            if (nestedTitle) {
                return nestedTitle;
            }
        }
    }

    return folderId;
};

export const BatchTagPage: React.FC = () => {
    const { t, i18n } = useTranslation('common');
    const { toast } = useToast();

    const [currentStep, setCurrentStep] = useState<BatchTagStep>(BatchTagStep.FolderSelection);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [selectedFolderName, setSelectedFolderName] = useState<string>('');
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [results, setResults] = useState<ReviewTagResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [errorMessage, setErrorMessage] = useState<{ title: string; description: string } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const loadFolders = async () => {
            try {
                const folderTree = await getBookmarkFolderTree();
                setFolders(folderTree || []);
            } catch (error) {
                console.error('Failed to load folders:', error);
                setFolders([]);
            }
        };

        loadFolders();
    }, []);

    const handleFolderSelect = async (folderId: string, folderName: string) => {
        try {
            setSelectedFolderId(folderId);
            setSelectedFolderName(folderName);
            const folderBookmarks = await getBookmarksInFolder(folderId);
            setBookmarks(folderBookmarks);
            setResults([]);
            setErrorMessage(folderBookmarks.length === 0
                ? { title: t('noBookmarksFound'), description: t('selectedFolderEmpty') }
                : null);
        } catch (error) {
            console.error('Failed to load folder bookmarks:', error);
            setErrorMessage({
                title: t('error'),
                description: t('failedToLoadBookmarks')
            });
        }
    };

    const handleStartBatchTagging = async () => {
        if (bookmarks.length === 0) {
            setErrorMessage({
                title: t('noBookmarksSelected'),
                description: t('pleaseSelectFolder')
            });
            return;
        }

        const aiConfigured = await isAIConfigured();
        if (!aiConfigured) {
            setErrorMessage({
                title: t('aiNotConfigured'),
                description: t('pleaseConfigureAI')
            });
            return;
        }

        setErrorMessage(null);
        setCurrentStep(BatchTagStep.Processing);
        setIsProcessing(true);
        setProgress(0);
        setResults([]);
        abortControllerRef.current = new AbortController();

        try {
            const config = await getAIConfig();
            if (!config) {
                throw new Error('AI configuration not found');
            }

            const existingTagsMap = await getTagsMapForBookmarks(bookmarks.map((bookmark) => bookmark.id));
            const response = await batchTagBookmarks(
                config,
                bookmarks.map((bookmark) => ({
                    ...bookmark,
                    existingTags: existingTagsMap[bookmark.id] || []
                })),
                i18n.language,
                (current, total, result) => {
                    setProgress((current / total) * 100);
                    if (!result) {
                        return;
                    }

                    setResults((prev) => {
                        if (prev.some((item) => item.id === result.id)) {
                            return prev;
                        }

                        const finalTags = mergeTags(result.existingTags, result.suggestedTags || []);
                        const hasNewTags = finalTags.length > result.existingTags.length;

                        return [
                            ...prev,
                            {
                                ...result,
                                selected: result.success && hasNewTags,
                                finalTags
                            }
                        ];
                    });
                },
                { signal: abortControllerRef.current.signal }
            );

            setResults(response.map((result) => {
                const finalTags = mergeTags(result.existingTags, result.suggestedTags || []);
                return {
                    ...result,
                    selected: result.success && finalTags.length > result.existingTags.length,
                    finalTags
                };
            }));
            setCurrentStep(BatchTagStep.Review);
        } catch (error) {
            console.error('Batch tagging failed:', error);
            toast({
                title: t('batchTagFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: "destructive"
            });
            setCurrentStep(BatchTagStep.FolderSelection);
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const toggleSelection = (id: string) => {
        setResults((prev) => prev.map((result) =>
            result.id === id ? { ...result, selected: !result.selected } : result
        ));
    };

    const removeTagFromResult = (id: string, tag: string) => {
        setResults((prev) => prev.map((result) => {
            if (result.id !== id) {
                return result;
            }

            const nextFinalTags = result.finalTags.filter((item) => item !== tag);
            return {
                ...result,
                finalTags: nextFinalTags,
                selected: nextFinalTags.length > result.existingTags.length
            };
        }));
    };

    const resetResultTags = (id: string) => {
        setResults((prev) => prev.map((result) => {
            if (result.id !== id) {
                return result;
            }

            const finalTags = mergeTags(result.existingTags, result.suggestedTags || []);
            return {
                ...result,
                finalTags,
                selected: finalTags.length > result.existingTags.length
            };
        }));
    };

    const handleApply = async () => {
        const selectedResults = results.filter((result) => result.selected);
        if (selectedResults.length === 0) {
            return;
        }

        setIsApplying(true);
        try {
            const payload = selectedResults.reduce<Record<string, string[]>>((acc, result) => {
                acc[result.id] = result.finalTags;
                return acc;
            }, {});

            await saveTagsForBookmarks(payload);
            await Promise.all(selectedResults.map((result) => broadcastBookmarkUpdate(result.id, result.title, result.url)));

            toast({
                title: t('batchTagSuccess'),
                description: t('batchTagSuccessDesc', { count: selectedResults.length })
            });

            setCurrentStep(BatchTagStep.FolderSelection);
            setResults([]);
            setBookmarks([]);
            setSelectedFolderId('');
            setSelectedFolderName('');
            setProgress(0);
        } catch (error) {
            console.error('Failed to apply tags:', error);
            toast({
                title: t('applyChangesFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: "destructive"
            });
        } finally {
            setIsApplying(false);
        }
    };

    if (currentStep === BatchTagStep.Processing) {
        return (
            <div className="container mx-auto max-w-5xl space-y-6 p-6 md:p-8 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={handleCancel}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="font-display text-3xl font-semibold tracking-tight">{t('batchTagTitle')}</h1>
                        <p className="text-muted-foreground">{t('batchTagProcessingDesc', { folder: selectedFolderName })}</p>
                    </div>
                </div>

                <Card className="border-primary/20 bg-card/92">
                    <CardHeader>
                        <CardTitle>{t('processing')}</CardTitle>
                        <CardDescription>{t('batchTagInProgress')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Progress value={progress} className="h-3" />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('batchTagProgress', { progress: Math.round(progress) })}
                        </div>
                        <Button variant="outline" onClick={handleCancel}>
                            {t('cancel')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (currentStep === BatchTagStep.Review) {
        const selectedCount = results.filter((result) => result.selected).length;

        return (
            <div className="container mx-auto max-w-6xl space-y-6 p-6 md:p-8 animate-in fade-in duration-300">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-display text-3xl font-semibold tracking-tight">{t('batchTagReviewTitle')}</h1>
                        <p className="text-muted-foreground">{t('batchTagReviewDesc', { count: results.length, folder: selectedFolderName })}</p>
                    </div>
                    <Button variant="outline" onClick={() => setCurrentStep(BatchTagStep.FolderSelection)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('back')}
                    </Button>
                </div>

                <Card className="border-border/70 bg-card/92">
                    <CardHeader>
                        <CardTitle>{t('reviewResults')}</CardTitle>
                        <CardDescription>{t('selectedCount', { count: selectedCount })}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[480px] pr-4">
                            <div className="space-y-4">
                                {results.map((result) => (
                                    <div
                                        key={result.id}
                                        className={`rounded-[1.25rem] border p-4 transition-colors ${result.selected ? 'border-primary/50 bg-primary/5' : 'border-border/70 bg-card/92'}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <Checkbox
                                                    checked={result.selected}
                                                    onCheckedChange={() => toggleSelection(result.id)}
                                                    disabled={!result.success}
                                                />
                                                <div className="space-y-2 min-w-0 flex-1">
                                                    <div>
                                                        <p className="font-medium truncate">{result.title}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{result.url}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">{t('existingTags')}</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {result.existingTags.length > 0 ? result.existingTags.map((tag) => (
                                                                <Badge key={`${result.id}-${tag}-existing`} variant="outline">{tag}</Badge>
                                                            )) : (
                                                                <span className="text-xs text-muted-foreground">{t('noTags')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-xs text-muted-foreground">{t('finalTags')}</p>
                                                            {result.success && (
                                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => resetResultTags(result.id)}>
                                                                    <RotateCcw className="mr-1 h-3 w-3" />
                                                                    {t('reset')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {result.finalTags.length > 0 ? result.finalTags.map((tag) => (
                                                                <Badge key={`${result.id}-${tag}-final`} className="gap-1 pr-1 rounded-full">
                                                                    {tag}
                                                                    {!result.existingTags.includes(tag) && (
                                                                        <button onClick={() => removeTagFromResult(result.id, tag)} className="rounded-full p-0.5 hover:bg-black/10">
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    )}
                                                                </Badge>
                                                            )) : (
                                                                <span className="text-xs text-muted-foreground">{t('noTags')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {!result.success && (
                                                <Badge variant="destructive">{result.error || t('failed')}</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setCurrentStep(BatchTagStep.FolderSelection)}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={handleApply} disabled={isApplying || selectedCount === 0}>
                                {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('applySelected')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl space-y-6 p-6 md:p-8 animate-in fade-in duration-300">
            <div className="space-y-4 rounded-[1.75rem] border border-border/70 bg-card/88 p-6 shadow-sm">
                <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                        {t('batchTagTitle')}
                    </span>
                    <h1 className="font-display text-3xl font-semibold tracking-tight">{t('batchTagTitle')}</h1>
                    <p className="text-muted-foreground">{t('batchTagDescription')}</p>
                </div>
            </div>

            {errorMessage && (
                <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        <span className="font-medium">{errorMessage.title}</span>
                        <span className="ml-2">{errorMessage.description}</span>
                    </AlertDescription>
                </Alert>
            )}

            <Card className="border-border/70 bg-card/92 shadow-sm">
                <CardHeader>
                    <CardTitle>{t('selectFolder')}</CardTitle>
                    <CardDescription>{t('batchTagFolderHelp')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <CascadingFolderSelect
                        folders={folders}
                        selectedId={selectedFolderId}
                        onSelect={(folderId) => {
                            handleFolderSelect(folderId, findFolderTitle(folders, folderId));
                        }}
                        placeholder={t('selectFolder')}
                    />

                    <div className="rounded-[1.15rem] border border-dashed border-border/80 bg-surface-2/70 p-4 text-sm text-muted-foreground">
                        {selectedFolderName
                            ? t('batchTagFolderSummary', { folder: selectedFolderName, count: bookmarks.length })
                            : t('batchTagFolderEmpty')}
                    </div>

                    <Button onClick={handleStartBatchTagging} disabled={!selectedFolderId || bookmarks.length === 0} className="w-full sm:w-auto">
                        <WandSparkles className="mr-2 h-4 w-4" />
                        {t('startBatchTagging')}
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/92 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Tags className="h-5 w-5 text-primary" />
                        <CardTitle>{t('batchTagWhatYouGet')}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{t('batchTagFeature1')}</p>
                    <p>{t('batchTagFeature2')}</p>
                    <p>{t('batchTagFeature3')}</p>
                </CardContent>
            </Card>
        </div>
    );
};
