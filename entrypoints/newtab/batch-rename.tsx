import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FolderOpen, ArrowLeft, AlertTriangle, CheckCircle, XCircle, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CascadingFolderSelect } from '@/components/ui/cascading-folder-select';
import { getBookmarksInFolder, getBookmarkFolderTree, BookmarkFolder } from '@/lib/bookmarkUtils';
import { isAIConfigured, getAIConfig } from '@/lib/aiConfigUtils';
import { batchRenameBookmarksWithConsistency, detectStyleConsistency } from '@/lib/aiService';
import { updateChromeBookmark, broadcastBookmarkUpdate } from '@/lib/bookmarkUtils';

interface BookmarkItem {
    id: string;
    title: string;
    url: string;
}

interface RenameResult {
    id: string;
    originalTitle: string;
    url: string;  // 书签的URL
    newTitle?: string;
    editedTitle?: string;  // 用户手动编辑的标题
    success: boolean;
    error?: string;
    selected: boolean;
}

enum BatchRenameStep {
    FolderSelection = 'folder-selection',
    Processing = 'processing',
    Review = 'review'
}

export const BatchRenamePage: React.FC = () => {
    const { t, i18n } = useTranslation('common');
    const { toast } = useToast();

    const [currentStep, setCurrentStep] = useState<BatchRenameStep>(BatchRenameStep.FolderSelection);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [selectedFolderName, setSelectedFolderName] = useState<string>('');
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [renameResults, setRenameResults] = useState<RenameResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [useIndividualRequests, setUseIndividualRequests] = useState(true);
    const [consistencyCheck, setConsistencyCheck] = useState<{
        isConsistent: boolean;
        issues: string[];
        suggestions: string[];
    } | null>(null);
    const [errorMessage, setErrorMessage] = useState<{ title: string; description: string } | null>(null);
    const abortControllerRef = React.useRef<AbortController | null>(null);

    // 获取文件夹列表
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

    // 处理文件夹选择
    const handleFolderSelect = async (folderId: string, folderName: string) => {
        try {
            setSelectedFolderId(folderId);
            setSelectedFolderName(folderName);

            // 获取文件夹中的书签
            const folderBookmarks = await getBookmarksInFolder(folderId);
            setBookmarks(folderBookmarks);

            if (folderBookmarks.length === 0) {
                setErrorMessage({
                    title: t('noBookmarksFound'),
                    description: t('selectedFolderEmpty')
                });
                return;
            }

            toast({
                title: t('folderSelected'),
                description: `${t('foundText')} ${folderBookmarks.length} ${t('bookmarksText')}`,
            });
            setErrorMessage(null);
        } catch (error) {
            console.error('Failed to get folder bookmarks:', error);
            setErrorMessage({
                title: t('error'),
                description: t('failedToLoadBookmarks')
            });
        }
    };

    // 开始批量重命名
    const handleStartBatchRename = async () => {
        if (bookmarks.length === 0) {
            setErrorMessage({
                title: t('noBookmarksSelected'),
                description: t('pleaseSelectFolder')
            });
            return;
        }

        // 检查AI配置
        const aiConfigured = await isAIConfigured();
        if (!aiConfigured) {
            setErrorMessage({
                title: t('aiNotConfigured'),
                description: t('pleaseConfigureAI')
            });
            return;
        }

        setErrorMessage(null);

        setCurrentStep(BatchRenameStep.Processing);
        setIsProcessing(true);
        setProgress(0);

        // 创建新的 AbortController
        abortControllerRef.current = new AbortController();

        try {
            const config = await getAIConfig();
            if (!config) {
                throw new Error('AI configuration not found');
            }

            // 调用批量重命名API，传入 AbortSignal
            const results = await batchRenameBookmarksWithConsistency(
                config,
                bookmarks,
                i18n.language,
                (current, total, result) => {
                    setProgress((current / total) * 100);
                    if (result) {
                        setRenameResults(prev => {
                            // 避免重复添加
                            if (prev.some(r => r.id === result.id)) return prev;
                            // 从 bookmarks 中获取 url
                            const bookmark = bookmarks.find(b => b.id === result.id);
                            return [...prev, { ...result, url: bookmark?.url || '', selected: result.success && !!result.newTitle }];
                        });
                    }
                },
                useIndividualRequests,
                { signal: abortControllerRef.current.signal }
            );

            // 转换结果格式并默认选中成功的项
            const formattedResults: RenameResult[] = (results || []).map(result => {
                // 从 bookmarks 中获取 url
                const bookmark = bookmarks.find(b => b.id === result.id);
                return {
                    ...result,
                    url: bookmark?.url || '',
                    selected: result.success && !!result.newTitle
                };
            });

            setRenameResults(formattedResults);

            // 检查风格一致性
            const successfulTitles = formattedResults
                .filter(r => r.success && r.newTitle)
                .map(r => r.newTitle!);

            if (successfulTitles && successfulTitles.length > 1) {
                const consistency = detectStyleConsistency(successfulTitles);
                setConsistencyCheck(consistency);
            }

            setCurrentStep(BatchRenameStep.Review);

            toast({
                title: t('processingCompleted'),
                description: t('reviewResults'),
            });
        } catch (error) {
            console.error('Batch rename failed:', error);
            const errorMessage = error instanceof Error ? error.message : t('unknownError');
            const isCancelled = errorMessage.includes('cancelled');

            toast({
                title: isCancelled ? t('operationCancelled') : t('batchRenameFailed'),
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    // 取消批量重命名
    const handleCancelBatchRename = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    // 切换选择状态
    const toggleSelection = (id: string) => {
        setRenameResults(prev => (prev || []).map(result =>
            result.id === id ? { ...result, selected: !result.selected } : result
        ));
    };

    // 手动编辑标题
    const handleManualEdit = (id: string, editedTitle: string) => {
        setRenameResults(prev => (prev || []).map(result =>
            result.id === id ? {
                ...result,
                editedTitle: editedTitle.trim(),
                selected: editedTitle.trim() !== result.originalTitle // 如果有修改则自动选中
            } : result
        ));
    };

    // 重置为AI建议的标题
    const handleResetToAI = (id: string) => {
        setRenameResults(prev => (prev || []).map(result =>
            result.id === id ? {
                ...result,
                editedTitle: undefined, // 清除手动编辑
                selected: result.newTitle !== result.originalTitle // 如果AI建议与原标题不同则选中
            } : result
        ));
    };

    // 全选/全不选/反选
    const handleSelectionChange = (action: 'all' | 'none' | 'invert') => {
        setRenameResults(prev => (prev || []).map(result => {
            if (!result.success || !result.newTitle) return result;

            switch (action) {
                case 'all':
                    return { ...result, selected: true };
                case 'none':
                    return { ...result, selected: false };
                case 'invert':
                    return { ...result, selected: !result.selected };
                default:
                    return result;
            }
        }));
    };

    // 应用选中的修改
    const handleApplySelected = async () => {
        const selectedResults = (renameResults || []).filter(r => r.selected);

        if (selectedResults.length === 0) {
            toast({
                title: t('noBookmarksSelected'),
                description: t('pleaseSelectBookmarks'),
                variant: "destructive"
            });
            return;
        }

        try {
            let successCount = 0;

            for (const result of selectedResults) {
                // 优先使用用户编辑的标题，否则使用AI建议的标题
                const finalTitle = result.editedTitle || result.newTitle;
                if (finalTitle && finalTitle !== result.originalTitle) {
                    await updateChromeBookmark(result.id, finalTitle, '');
                    await broadcastBookmarkUpdate(result.id, finalTitle, '');
                    successCount++;
                }
            }

            toast({
                title: `${t('successfullyRenamed')} ${successCount} ${t('bookmarksText')}`,
                description: t('bookmarksUpdated'),
            });

            // 重置状态
            setCurrentStep(BatchRenameStep.FolderSelection);
            setBookmarks([]);
            setRenameResults([]);
            setConsistencyCheck(null);
            setSelectedFolderId('');
            setSelectedFolderName('');
        } catch (error) {
            console.error('Failed to apply changes:', error);
            toast({
                title: t('applyChangesFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: "destructive"
            });
        }
    };

    // 返回文件夹选择
    const handleBackToFolderSelection = () => {
        setCurrentStep(BatchRenameStep.FolderSelection);
        setRenameResults([]);
        setConsistencyCheck(null);
        setProgress(0);
    };

    return (
        <div className="container mx-auto p-6 md:p-8 max-w-7xl space-y-8 pb-10">
            {/* 固定位置的错误提示 */}
            {errorMessage && (
                <div className="sticky top-4 z-50 px-4 animate-in slide-in-from-top-2">
                    <Alert variant="destructive" className="shadow-lg border-destructive/20 bg-destructive/10 backdrop-blur-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <div className="ml-2 flex-1">
                            <h3 className="font-semibold">{errorMessage.title}</h3>
                            <p className="text-sm mt-1 opacity-90">{errorMessage.description}</p>
                        </div>
                        <button
                            onClick={() => setErrorMessage(null)}
                            className="ml-2 text-destructive hover:text-destructive/80 transition-colors"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    </Alert>
                </div>
            )}

            {/* 页面标题区域 */}
            <div className="space-y-4 pb-4 border-b border-border/50">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">{t('batchRenameTitle')}</h1>
                    <p className="text-muted-foreground text-sm">
                        {t('batchRenameDescription')}
                    </p>
                </div>
            </div>

            {/* 步骤指示器 */}
            <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10" />
                <div className="flex justify-between max-w-3xl mx-auto">
                    {[
                        { step: BatchRenameStep.FolderSelection, label: t('selectFolder'), number: 1 },
                        { step: BatchRenameStep.Processing, label: t('processing'), number: 2 },
                        { step: BatchRenameStep.Review, label: t('review'), number: 3 }
                    ].map((item, index) => {
                        const isActive = currentStep === item.step;
                        const isCompleted =
                            (currentStep === BatchRenameStep.Processing && index === 0) ||
                            (currentStep === BatchRenameStep.Review && index < 2);

                        return (
                            <div key={item.step} className="flex flex-col items-center bg-background px-4">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2
                                    ${isActive || isCompleted
                                        ? 'border-primary bg-primary text-primary-foreground scale-110'
                                        : 'border-muted bg-background text-muted-foreground'}
                                `}>
                                    {isCompleted ? <CheckCircle className="h-6 w-6" /> : item.number}
                                </div>
                                <span className={`mt-2 text-sm font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'
                                    }`}>
                                    {item.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 主要内容区域 */}
            <div className="min-h-[400px]">
                {/* 步骤 1: 文件夹选择 */}
                {currentStep === BatchRenameStep.FolderSelection && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="border-muted/60 shadow-sm">
                            <CardHeader>
                                <CardTitle>{t('selectFolderToRename')}</CardTitle>
                                <CardDescription>{t('selectFolderDescription')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <CascadingFolderSelect
                                    folders={folders}
                                    selectedId={selectedFolderId}
                                    onSelect={(folderId: string) => {
                                        const findFolderName = (folders: BookmarkFolder[], id: string): string => {
                                            for (const folder of folders) {
                                                if (folder.id === id) return folder.title;
                                                if (folder.children) {
                                                    const childName = findFolderName(folder.children, id);
                                                    if (childName) return childName;
                                                }
                                            }
                                            return '';
                                        };
                                        const folderName = findFolderName(folders, folderId);
                                        handleFolderSelect(folderId, folderName);
                                    }}
                                    placeholder={t('chooseFolderPlaceholder')}
                                />

                                {bookmarks.length > 0 && (
                                    <div className="space-y-6 pt-4 border-t">
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 text-primary border border-primary/10">
                                            <CheckCircle className="h-5 w-5 flex-shrink-0" />
                                            <span className="font-medium">
                                                {t('foundText')} {bookmarks.length} {t('bookmarksText')}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id="individual-requests"
                                                    checked={useIndividualRequests}
                                                    onCheckedChange={(checked) => setUseIndividualRequests(checked as boolean)}
                                                    className="mt-1"
                                                />
                                                <div className="space-y-1">
                                                    <label
                                                        htmlFor="individual-requests"
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {t('useIndividualRequests')}
                                                    </label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {useIndividualRequests
                                                            ? t('individualRequestsDescription')
                                                            : t('batchRequestsDescription')
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={handleStartBatchRename}
                                            className="w-full h-12 text-lg shadow-md hover:shadow-lg transition-all"
                                            size="lg"
                                        >
                                            <Sparkles className="mr-2 h-5 w-5" />
                                            {t('startBatchRename')}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* 步骤 2: 处理 */}
                {currentStep === BatchRenameStep.Processing && (
                    <div className="max-w-xl mx-auto mt-12 animate-in fade-in zoom-in-95 duration-500 space-y-6">
                        <Card className="border-primary/20 shadow-lg overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-pulse" />
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                                <CardTitle className="text-xl">{t('processingProgress')}</CardTitle>
                                <CardDescription>
                                    {useIndividualRequests ? t('individualProcessingDescription') : t('batchProcessingDescription')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8 pt-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>{Math.round(progress)}%</span>
                                        <span>{Math.round(progress * bookmarks.length / 100)} / {bookmarks.length}</span>
                                    </div>
                                    <Progress value={progress} className="h-3" />
                                </div>

                                {useIndividualRequests && (
                                    <div className="text-center p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                                        {t('individualProcessingNote')}
                                    </div>
                                )}

                                <div className="flex justify-center">
                                    {isProcessing ? (
                                        <Button variant="destructive" onClick={handleCancelBatchRename}>
                                            {t('cancel')}
                                        </Button>
                                    ) : (
                                        <Button variant="outline" onClick={handleBackToFolderSelection}>
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            {t('backToFolderSelection')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 实时显示处理结果 */}
                        {renameResults.length > 0 && (
                            <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
                                <h3 className="text-sm font-medium text-muted-foreground px-1">
                                    {t('processedItems')} ({renameResults.length})
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {[...renameResults].reverse().map((result) => (
                                        <div
                                            key={result.id}
                                            className="bg-background border rounded-lg p-3 text-sm flex items-center justify-between shadow-sm animate-in slide-in-from-left-2 fade-in duration-300"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {result.success ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                                                )}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="truncate text-muted-foreground text-xs" title={result.originalTitle}>
                                                        {result.originalTitle}
                                                    </span>
                                                    <span className="truncate font-medium" title={result.newTitle || t('failed')}>
                                                        {result.newTitle || t('failed')}
                                                    </span>
                                                </div>
                                            </div>
                                            {result.success && (
                                                <Badge variant="outline" className="ml-2 text-[10px] h-5">
                                                    Done
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 步骤 3: 审查 */}
                {currentStep === BatchRenameStep.Review && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* 风格一致性检查 */}
                        {consistencyCheck && !consistencyCheck.isConsistent && (
                            <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="space-y-2">
                                        <p className="font-semibold">{t('consistencyWarning')}</p>
                                        <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
                                            {(consistencyCheck?.issues || []).map((issue, index) => (
                                                <li key={index}>{issue}</li>
                                            ))}
                                        </ul>
                                        {consistencyCheck.suggestions.length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-sm font-medium mb-1">{t('suggestions')}:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {consistencyCheck.suggestions.map((suggestion, index) => (
                                                        <Badge key={index} variant="outline" className="bg-background/50">
                                                            {suggestion}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* 操作栏 - 粘性定位 */}
                        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b flex flex-wrap items-center gap-4 justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    {t('renameResults')}
                                    <Badge variant="secondary" className="ml-2">
                                        {(renameResults || []).filter(r => r.selected).length} / {renameResults.length}
                                    </Badge>
                                </h2>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleSelectionChange('all')}>
                                    {t('selectAll')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleSelectionChange('none')}>
                                    {t('deselectAll')}
                                </Button>
                                <Button
                                    onClick={handleApplySelected}
                                    disabled={(renameResults || []).filter(r => r.selected).length === 0}
                                    className="shadow-sm"
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {t('applySelected')}
                                </Button>
                            </div>
                        </div>

                        {/* 结果列表 - 网格布局 */}
                        <div className="grid gap-4">
                            {(renameResults || []).map((result, index) => (
                                <Card
                                    key={result.id}
                                    className={`
                                        transition-all duration-200 border-l-4
                                        ${result.selected ? 'border-l-primary ring-1 ring-primary/20' : 'border-l-transparent hover:border-l-muted-foreground/30'}
                                    `}
                                >
                                    <CardContent className="p-4 flex items-center gap-4">
                                        {result.success && result.newTitle && (
                                            <Checkbox
                                                checked={result.selected}
                                                onCheckedChange={() => toggleSelection(result.id)}
                                                className="mt-1"
                                            />
                                        )}

                                        <div className="flex-1 grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                            {/* 原标题 */}
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                                                    {t('original')}
                                                </div>
                                                <div className="text-sm truncate font-medium" title={result.originalTitle}>
                                                    {result.originalTitle}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate mt-0.5 opacity-60">
                                                    {result.url}
                                                </div>
                                            </div>

                                            {/* 箭头 */}
                                            <div className="hidden md:flex items-center justify-center text-muted-foreground/50">
                                                <ArrowLeft className="h-5 w-5 rotate-180" />
                                            </div>

                                            {/* 新标题 */}
                                            <div className="min-w-0">
                                                {result.success ? (
                                                    <div className="space-y-1">
                                                        <div className="text-xs font-medium text-primary mb-1 uppercase tracking-wider flex items-center justify-between">
                                                            {t('newTitle')}
                                                            {result.editedTitle && (
                                                                <Badge variant="secondary" className="h-4 px-1 text-[10px]">Modified</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                value={result.editedTitle || result.newTitle || ''}
                                                                onChange={(e) => handleManualEdit(result.id, e.target.value)}
                                                                className={`h-9 text-sm ${result.editedTitle ? 'border-primary/50 bg-primary/5' : ''}`}
                                                                placeholder={t('enterCustomTitle')}
                                                            />
                                                            {result.editedTitle && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9 shrink-0"
                                                                    onClick={() => handleResetToAI(result.id)}
                                                                    title={t('resetToAI')}
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded text-sm">
                                                        <XCircle className="h-4 w-4" />
                                                        {t('failed')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="flex justify-center pt-6">
                            <Button variant="ghost" onClick={handleBackToFolderSelection}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                {t('backToFolderSelection')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
