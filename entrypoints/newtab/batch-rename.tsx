import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FolderOpen, ArrowLeft, AlertTriangle, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
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
                toast({
                    title: t('noBookmarksFound'),
                    description: t('selectedFolderEmpty'),
                    variant: "destructive"
                });
                return;
            }
            
            toast({
                title: t('folderSelected'),
                description: `${t('foundText')} ${folderBookmarks.length} ${t('bookmarksText')}`,
            });
        } catch (error) {
            console.error('Failed to get folder bookmarks:', error);
            toast({
                title: t('error'),
                description: t('failedToLoadBookmarks'),
                variant: "destructive"
            });
        }
    };

    // 开始批量重命名
    const handleStartBatchRename = async () => {
        if (bookmarks.length === 0) {
            toast({
                title: t('noBookmarksSelected'),
                description: t('pleaseSelectFolder'),
                variant: "destructive"
            });
            return;
        }

        // 检查AI配置
        const aiConfigured = await isAIConfigured();
        if (!aiConfigured) {
            toast({
                title: t('aiNotConfigured'),
                description: t('pleaseConfigureAI'),
                variant: "destructive"
            });
            return;
        }

        setCurrentStep(BatchRenameStep.Processing);
        setIsProcessing(true);
        setProgress(0);

        try {
            const config = await getAIConfig();
            if (!config) {
                throw new Error('AI configuration not found');
            }

            // 调用批量重命名API
            const results = await batchRenameBookmarksWithConsistency(
                config,
                bookmarks,
                i18n.language,
                (current, total) => {
                    setProgress((current / total) * 100);
                },
                useIndividualRequests
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
            toast({
                title: t('batchRenameFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
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
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary" />
                <div>
                    <h1 className="text-2xl font-bold">{t('batchRenameTitle')}</h1>
                    <p className="text-muted-foreground">{t('batchRenameDescription')}</p>
                </div>
            </div>

            {/* 步骤指示器 */}
            <div className="flex items-center gap-4">
                <Badge variant={currentStep === BatchRenameStep.FolderSelection ? "default" : "secondary"}>
                    1. {t('selectFolder')}
                </Badge>
                <Badge variant={currentStep === BatchRenameStep.Processing ? "default" : "secondary"}>
                    2. {t('processing')}
                </Badge>
                <Badge variant={currentStep === BatchRenameStep.Review ? "default" : "secondary"}>
                    3. {t('review')}
                </Badge>
            </div>

            {/* 文件夹选择步骤 */}
            {currentStep === BatchRenameStep.FolderSelection && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5" />
                            {t('selectFolderToRename')}
                        </CardTitle>
                        <CardDescription>
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
                <Card>
                    <CardHeader>
                        <CardTitle>{t('processingProgress')}</CardTitle>
                        <CardDescription>
                            {useIndividualRequests
                                ? t('individualProcessingDescription')
                                : t('batchProcessingDescription')
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Progress value={progress} className="w-full" />
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                                {t('processing')} {Math.round(progress)}%
                            </span>
                            <span className="text-muted-foreground">
                                {useIndividualRequests
                                    ? `${Math.floor(progress * bookmarks.length / 100)} / ${bookmarks.length}`
                                    : t('batchProcessing')
                                }
                            </span>
                        </div>
                        {useIndividualRequests && (
                            <p className="text-xs text-muted-foreground text-center">
                                {t('individualProcessingNote')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 审查步骤 */}
            {currentStep === BatchRenameStep.Review && (
                <div className="space-y-6">
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
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            onClick={handleBackToFolderSelection}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {t('backToFolderSelection')}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleSelectionChange('all')}
                        >
                            {t('selectAll')}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleSelectionChange('none')}
                        >
                            {t('deselectAll')}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleSelectionChange('invert')}
                        >
                            {t('invertSelection')}
                        </Button>

                        <Button
                            onClick={handleApplySelected}
                            disabled={(renameResults || []).filter(r => r.selected).length === 0}
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {t('applySelected')} ({(renameResults || []).filter(r => r.selected).length})
                        </Button>
                    </div>

                    {/* 结果列表 */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">{t('renameResults')}</CardTitle>
                            <CardDescription>
                                {t('reviewAndSelectChanges')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-2">
                                {(renameResults || []).map((result) => (
                                    <div
                                        key={result.id}
                                        className={`border rounded-md p-3 transition-all ${
                                            result.selected
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-border hover:border-muted-foreground/30'
                                        }`}
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

                                            {/* 内容区域 - 单行布局 */}
                                            <div className="flex-1 min-w-0">
                                                {result.success && result.newTitle ? (
                                                    <div className="grid grid-cols-12 gap-3 items-center">
                                                        {/* 原标题 - 4列 */}
                                                        <div className="col-span-4 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
                                                                    {t('original')}
                                                                </span>
                                                                <p className="text-sm text-muted-foreground truncate" title={result.originalTitle}>
                                                                    {result.originalTitle}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* 箭头 - 1列 */}
                                                        <div className="col-span-1 flex justify-center">
                                                            <span className="text-muted-foreground">→</span>
                                                        </div>

                                                        {/* 编辑输入框 - 6列 */}
                                                        <div className="col-span-6 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    value={result.editedTitle || result.newTitle || ''}
                                                                    onChange={(e) => handleManualEdit(result.id, e.target.value)}
                                                                    placeholder={t('enterCustomTitle')}
                                                                    className={`text-sm h-8 flex-1 ${
                                                                        result.editedTitle
                                                                            ? 'border-primary bg-primary/5'
                                                                            : 'border-border'
                                                                    }`}
                                                                />
                                                                {result.editedTitle && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleResetToAI(result.id)}
                                                                        className="h-8 w-8 p-0 flex-shrink-0"
                                                                        title={t('resetToAI')}
                                                                    >
                                                                        <RotateCcw className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 状态指示 - 1列 */}
                                                        <div className="col-span-1 flex justify-center">
                                                            {result.editedTitle && (
                                                                <span className="text-xs text-primary font-medium" title={t('modified')}>
                                                                    ✓
                                                                </span>
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
