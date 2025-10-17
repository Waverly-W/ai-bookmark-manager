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
    const [useIndividualRequests, setUseIndividualRequests] = useState(false);
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
                (current, total) => {
                    setProgress((current / total) * 100);
                },
                useIndividualRequests,
                { signal: abortControllerRef.current.signal }
            );

            // 转换结果格式并默认选中成功的项
            const formattedResults: RenameResult[] = (results || []).map(result => ({
                ...result,
                selected: result.success && !!result.newTitle
            }));

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
        <div className="space-y-6">
            {/* 固定位置的错误提示 */}
            {errorMessage && (
                <div className="sticky top-0 z-50 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm border-b" role="alert" aria-live="assertive" aria-atomic="true">
                    <Alert variant="destructive" className="mb-0 animate-fade-in">
                        <AlertTriangle className="h-4 w-4" />
                        <div className="ml-2">
                            <h3 className="font-semibold">{errorMessage.title}</h3>
                            <p className="text-sm mt-1">{errorMessage.description}</p>
                        </div>
                        <button
                            onClick={() => setErrorMessage(null)}
                            className="ml-auto text-destructive hover:text-destructive/80 transition-smooth flex-shrink-0"
                            aria-label="Close error"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    </Alert>
                </div>
            )}

            {/* 页面标题区域 */}
            <div className="space-y-3 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-7 w-7 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-3xl font-bold tracking-tight">{t('batchRenameTitle')}</h1>
                        <p className="text-muted-foreground text-sm mt-1">{t('batchRenameDescription')}</p>
                    </div>
                </div>
            </div>

            {/* 步骤指示器 */}
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 px-1 -mx-1">
                {/* 步骤 1: 文件夹选择 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all ${
                        currentStep === BatchRenameStep.FolderSelection
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                            : currentStep === BatchRenameStep.Processing || currentStep === BatchRenameStep.Review
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {currentStep === BatchRenameStep.Processing || currentStep === BatchRenameStep.Review ? (
                            <CheckCircle className="h-5 w-5" />
                        ) : (
                            '1'
                        )}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{t('selectFolder')}</span>
                </div>

                {/* 连接线 1 */}
                <div className={`flex-1 h-1 rounded transition-all min-w-4 md:min-w-8 ${
                    currentStep === BatchRenameStep.Processing || currentStep === BatchRenameStep.Review
                        ? 'bg-primary'
                        : 'bg-muted'
                }`} />

                {/* 步骤 2: 处理 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all ${
                        currentStep === BatchRenameStep.Processing
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                            : currentStep === BatchRenameStep.Review
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {currentStep === BatchRenameStep.Review ? (
                            <CheckCircle className="h-5 w-5" />
                        ) : (
                            '2'
                        )}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{t('processing')}</span>
                </div>

                {/* 连接线 2 */}
                <div className={`flex-1 h-1 rounded transition-all min-w-4 md:min-w-8 ${
                    currentStep === BatchRenameStep.Review
                        ? 'bg-primary'
                        : 'bg-muted'
                }`} />

                {/* 步骤 3: 审查 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all ${
                        currentStep === BatchRenameStep.Review
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        3
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{t('review')}</span>
                </div>
            </div>

            {/* 文件夹选择步骤 */}
            {currentStep === BatchRenameStep.FolderSelection && (
                <Card className="border-l-4 border-l-primary animate-fade-in">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardTitle className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5 text-primary" />
                            {t('selectFolderToRename')}
                        </CardTitle>
                        <CardDescription className="mt-2">
                            {t('selectFolderDescription')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <CascadingFolderSelect
                            folders={folders}
                            selectedId={selectedFolderId}
                            onSelect={(folderId: string) => {
                                // 找到对应的文件夹名称
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
                            <div className="space-y-4">
                                <Alert>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {t('foundText')} {bookmarks.length} {t('bookmarksText')}
                                    </AlertDescription>
                                </Alert>

                                {/* 处理模式选择 */}
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="individual-requests"
                                            checked={useIndividualRequests}
                                            onChange={(e) => setUseIndividualRequests(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        <label htmlFor="individual-requests" className="text-sm font-medium">
                                            {t('useIndividualRequests')}
                                        </label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {useIndividualRequests
                                            ? t('individualRequestsDescription')
                                            : t('batchRequestsDescription')
                                        }
                                    </p>
                                </div>

                                <Button
                                    onClick={handleStartBatchRename}
                                    className="w-full"
                                    size="lg"
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {t('startBatchRename')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 处理步骤 */}
            {currentStep === BatchRenameStep.Processing && (
                <Card className="border-l-4 border-l-blue-500 animate-fade-in">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardTitle className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                            {t('processingProgress')}
                        </CardTitle>
                        <CardDescription className="mt-2">
                            {useIndividualRequests
                                ? t('individualProcessingDescription')
                                : t('batchProcessingDescription')
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 加载状态指示 */}
                        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                            <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                    {useIndividualRequests ? t('processing') : t('batchProcessing')}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {useIndividualRequests
                                        ? `${Math.floor(progress * bookmarks.length / 100)} / ${bookmarks.length} ${t('bookmarksText')}`
                                        : t('processingBatch')
                                    }
                                </p>
                            </div>
                        </div>

                        {/* 进度条 */}
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>{Math.round(progress)}% {t('complete')}</span>
                                <span>{Math.round(progress * bookmarks.length / 100)} / {bookmarks.length}</span>
                            </div>
                        </div>

                        {/* 处理说明 */}
                        {useIndividualRequests && (
                            <p className="text-xs text-muted-foreground text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                                {t('individualProcessingNote')}
                            </p>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex gap-2 justify-center pt-4 flex-wrap">
                            {/* 返回修改按钮 - 仅在处理完成后显示 */}
                            {!isProcessing && (
                                <Button
                                    variant="outline"
                                    onClick={handleBackToFolderSelection}
                                    className="flex items-center gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {t('backToFolderSelection')}
                                </Button>
                            )}

                            {/* 取消按钮 - 仅在处理中显示 */}
                            {isProcessing && (
                                <Button
                                    variant="destructive"
                                    onClick={handleCancelBatchRename}
                                    disabled={!isProcessing}
                                >
                                    {t('cancel')}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 审查步骤 */}
            {currentStep === BatchRenameStep.Review && (
                <div className="space-y-6 animate-fade-in">
                    {/* 风格一致性检查 */}
                    {consistencyCheck && !consistencyCheck.isConsistent && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="space-y-2">
                                    <p className="font-medium">{t('consistencyWarning')}</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        {(consistencyCheck?.issues || []).map((issue, index) => (
                                            <li key={index} className="text-sm">{issue}</li>
                                        ))}
                                    </ul>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">{t('suggestions')}:</p>
                                        {(consistencyCheck?.suggestions || []).map((suggestion, index) => (
                                            <p key={index} className="text-sm">• {suggestion}</p>
                                        ))}
                                    </div>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex flex-wrap gap-2 md:gap-3 items-center">
                        {/* 主要操作按钮 - 应用选中 */}
                        <Button
                            onClick={handleApplySelected}
                            disabled={(renameResults || []).filter(r => r.selected).length === 0}
                            className="w-full sm:w-auto"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {t('applySelected')} ({(renameResults || []).filter(r => r.selected).length})
                        </Button>

                        {/* 次要操作按钮 - 选择操作 */}
                        <Button
                            variant="outline"
                            onClick={() => handleSelectionChange('all')}
                            size="sm"
                            className="flex-1 sm:flex-none"
                        >
                            {t('selectAll')}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleSelectionChange('none')}
                            size="sm"
                            className="flex-1 sm:flex-none"
                        >
                            {t('deselectAll')}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleSelectionChange('invert')}
                            size="sm"
                            className="flex-1 sm:flex-none"
                        >
                            {t('invertSelection')}
                        </Button>

                        {/* 返回按钮 - 幽灵样式 */}
                        <Button
                            variant="ghost"
                            onClick={handleBackToFolderSelection}
                            className="w-full sm:w-auto"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {t('backToFolderSelection')}
                        </Button>
                    </div>

                    {/* 结果列表 */}
                    <Card className="border-l-4 border-l-green-500 animate-scale-in">
                        <CardHeader className="pb-4 border-b border-border/50">
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                {t('renameResults')}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                {t('reviewAndSelectChanges')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-2">
                                {(renameResults || []).map((result, index) => (
                                    <div
                                        key={result.id}
                                        className={`border rounded-md p-3 transition-smooth animate-fade-in ${
                                            result.selected
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-border hover:border-muted-foreground/30'
                                        }`}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* 复选框 */}
                                            {result.success && result.newTitle && (
                                                <Checkbox
                                                    checked={result.selected}
                                                    onCheckedChange={() => toggleSelection(result.id)}
                                                    className="flex-shrink-0"
                                                />
                                            )}

                                            {/* 状态图标 */}
                                            <div className="flex-shrink-0">
                                                {result.success ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>

                                            {/* 内容区域 - 响应式布局 */}
                                            <div className="flex-1 min-w-0">
                                                {result.success && result.newTitle ? (
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                                        {/* 原标题 */}
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
                                                                {t('original')}
                                                            </span>
                                                            <p className="text-sm text-muted-foreground truncate" title={result.originalTitle}>
                                                                {result.originalTitle}
                                                            </p>
                                                        </div>

                                                        {/* 箭头 */}
                                                        <span className="text-muted-foreground hidden sm:inline flex-shrink-0">→</span>

                                                        {/* 编辑输入框 */}
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <Input
                                                                value={result.editedTitle || result.newTitle || ''}
                                                                onChange={(e) => handleManualEdit(result.id, e.target.value)}
                                                                placeholder={t('enterCustomTitle')}
                                                                className={`text-sm h-8 flex-1 min-w-0 ${
                                                                    result.editedTitle
                                                                        ? 'border-primary bg-primary/5'
                                                                        : 'border-border'
                                                                }`}
                                                            />
                                                            {result.editedTitle && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleResetToAI(result.id)}
                                                                        className="h-8 w-8 p-0 flex-shrink-0"
                                                                        title={t('resetToAI')}
                                                                    >
                                                                        <RotateCcw className="h-3 w-3" />
                                                                    </Button>
                                                                    <span className="text-xs text-primary font-medium flex-shrink-0" title={t('modified')}>
                                                                        ✓
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
                                                                {t('original')}
                                                            </span>
                                                            <p className="text-sm text-muted-foreground truncate" title={result.originalTitle}>
                                                                {result.originalTitle}
                                                            </p>
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
                                                                {t('failed')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
