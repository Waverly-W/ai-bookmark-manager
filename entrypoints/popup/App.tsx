import './App.css';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { browser } from "wxt/browser";
import {
    createChromeBookmark,
    validateBookmarkUrl,
    validateBookmarkTitle,
    getBookmarkFolderTree,
    BookmarkFolder,
    getBookmarkTitlesInFolder,
    getBookmarkFolders
} from "@/lib/bookmarkUtils";
import { Loader2, Plus, Wand2, Folder as FolderIcon, Check, Sparkles, Globe, LayoutGrid } from "lucide-react";
import { CascadingFolderSelect } from "@/components/ui/cascading-folder-select";
import { useTranslation } from 'react-i18next';
import { getAIConfig, AIConfig } from "@/lib/aiConfigUtils";
import { recommendFolderWithAI, renameBookmarkContextuallyWithAI } from "@/lib/aiService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function App() {
    const { toast } = useToast();
    const { t, i18n } = useTranslation('popup');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('1'); // 默认选择书签栏

    // AI States
    const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isRenameSuccess, setIsRenameSuccess] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [recommendations, setRecommendations] = useState<Array<{ folderId: string; folderPath: string; reason?: string }>>([]);
    const [recommendationOpen, setRecommendationOpen] = useState(false);
    const [allFlatFolders, setAllFlatFolders] = useState<BookmarkFolder[]>([]);

    // 组件加载时，获取当前标签页的信息和文件夹列表
    useEffect(() => {
        const initialize = async () => {
            try {
                // 获取当前标签页信息
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });

                if (tabs && tabs.length > 0 && tabs[0].url && tabs[0].title) {
                    setUrl(tabs[0].url);
                    setTitle(tabs[0].title);
                }

                // 获取文件夹列表
                const folderTree = await getBookmarkFolderTree();
                // 过滤掉"全部书签"选项
                const filteredFolders = folderTree.filter(f => f.id !== 'all');
                setFolders(filteredFolders);

                // 获取平铺的文件夹列表用于查找
                const flatFolders = await getBookmarkFolders();
                setAllFlatFolders(flatFolders);

                // 加载AI配置
                const config = await getAIConfig();
                setAiConfig(config);
            } catch (error) {
                console.error('Error initializing popup:', error);
            }
        };

        initialize();
    }, []);

    // 处理AI重命名
    const handleAIRename = async () => {
        if (!aiConfig || !aiConfig.apiKey) {
            toast({
                title: i18n.language.startsWith('zh') ? "AI未配置" : "AI Not Configured",
                description: i18n.language.startsWith('zh') ? "请先在设置中配置AI API Key" : "Please configure AI API Key in settings first",
                variant: "destructive"
            });
            return;
        }

        setIsRenaming(true);
        setIsRenameSuccess(false);
        try {
            // 获取当前选中文件夹中的其他书签标题
            const otherTitles = await getBookmarkTitlesInFolder(selectedFolder);

            // 获取当前文件夹名称
            const currentFolderName = allFlatFolders.find(f => f.id === selectedFolder)?.title || 'Unknown';

            const result = await renameBookmarkContextuallyWithAI(
                aiConfig,
                url,
                title,
                currentFolderName,
                otherTitles,
                i18n.language
            );

            if (result.success && result.newTitle) {
                setTitle(result.newTitle);
                setIsRenameSuccess(true);
                // 2秒后重置成功状态
                setTimeout(() => setIsRenameSuccess(false), 2000);
            } else {
                throw new Error(result.error || "Unknown error");
            }
        } catch (error) {
            console.error('AI rename failed:', error);
            toast({
                title: t('aiRenameFailed'),
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
            });
        } finally {
            setIsRenaming(false);
        }
    };

    // 处理AI推荐文件夹
    const handleAIRecommend = async () => {
        if (!aiConfig || !aiConfig.apiKey) {
            toast({
                title: i18n.language.startsWith('zh') ? "AI未配置" : "AI Not Configured",
                description: i18n.language.startsWith('zh') ? "请先在设置中配置AI API Key" : "Please configure AI API Key in settings first",
                variant: "destructive"
            });
            return;
        }

        setIsRecommending(true);
        try {
            // 准备文件夹路径列表 (格式: [ID: id] path)
            const folderList = allFlatFolders
                .filter(f => f.id !== 'all')
                .map(f => `[ID: ${f.id}] ${f.path}`);

            const result = await recommendFolderWithAI(
                aiConfig,
                url,
                title,
                folderList,
                i18n.language
            );

            if (result.success && result.recommendations && result.recommendations.length > 0) {
                setRecommendations(result.recommendations);
                setRecommendationOpen(true);
            } else {
                toast({
                    title: t('noRecommendations'),
                });
            }
        } catch (error) {
            console.error('AI recommend failed:', error);
            toast({
                title: t('aiRecommendFailed'),
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
            });
        } finally {
            setIsRecommending(false);
        }
    };

    // 选择推荐的文件夹
    const handleSelectRecommendation = (rec: any) => {
        // 直接使用返回的 folderId
        const folderId = rec.folderId;
        const folder = allFlatFolders.find(f => f.id === folderId);

        if (folder) {
            setSelectedFolder(folder.id);
            setRecommendationOpen(false);
        } else {
            // Fallback: try path matching if ID fails
            const folderByPath = allFlatFolders.find(f => f.path === rec.folderPath);
            if (folderByPath) {
                setSelectedFolder(folderByPath.id);
                setRecommendationOpen(false);
            } else {
                toast({
                    title: t('cannotLocateFolder'),
                    description: rec.folderPath,
                    variant: "destructive"
                });
            }
        }
    };

    // 处理添加书签
    const handleAddBookmark = async () => {
        // 验证输入
        if (!validateBookmarkTitle(title)) {
            toast({
                title: t('validationError'),
                description: t('titleValidationError'),
                variant: "destructive"
            });
            return;
        }

        if (!validateBookmarkUrl(url)) {
            toast({
                title: t('validationError'),
                description: t('urlValidationError'),
                variant: "destructive"
            });
            return;
        }

        setIsCreating(true);
        try {
            await createChromeBookmark(title, url, selectedFolder);

            // 获取选中文件夹的名称用于提示
            const folderName = folders.find(f => f.id === selectedFolder)?.title || '书签栏';

            toast({
                title: t('success'),
                description: t('bookmarkAdded', { folderName }),
            });

            // 清空表单
            setTitle('');
            setUrl('');

            // 延迟关闭popup，让用户看到成功提示
            setTimeout(() => {
                window.close();
            }, 800);
        } catch (error) {
            console.error('Failed to create bookmark:', error);
            toast({
                title: t('addFailed'),
                description: error instanceof Error ? error.message : t('cannotAddBookmark'),
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <TooltipProvider>
            <div className="w-[400px] bg-background font-sans text-foreground">
                <Card className="border-none shadow-none rounded-none">
                    <CardHeader className="px-6 py-4 border-b bg-muted/10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                                <div className="p-1.5 bg-primary/10 rounded-md">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                </div>
                                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                                    AI Bookmark
                                </span>
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5 h-5 bg-background/50">
                                v1.0
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6 space-y-6">
                        {/* 书签标题 */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="bookmark-title" className="text-sm font-medium text-foreground/80">
                                    {t('title')}
                                </Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleAIRename}
                                            disabled={isRenaming || !url || !title}
                                            className={`h-6 px-2 text-xs gap-1.5 hover:bg-primary/5 ${isRenameSuccess ? "text-green-600 hover:text-green-700" : "text-primary hover:text-primary/80"}`}
                                        >
                                            {isRenaming ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : isRenameSuccess ? (
                                                <Check className="h-3 w-3" />
                                            ) : (
                                                <Wand2 className="h-3 w-3" />
                                            )}
                                            <span>{t('aiRename')}</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{t('optimizeTitleWithAI')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input
                                id="bookmark-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('enterTitle')}
                                disabled={isCreating}
                                className="h-10 bg-background focus-visible:ring-primary/20 transition-all"
                            />
                        </div>

                        {/* 书签URL */}
                        <div className="space-y-2.5">
                            <Label htmlFor="bookmark-url" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                URL
                            </Label>
                            <Input
                                id="bookmark-url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                type="url"
                                disabled={isCreating}
                                className="h-10 font-mono text-xs text-muted-foreground bg-muted/30 focus-visible:ring-primary/20"
                            />
                        </div>

                        {/* 文件夹选择 */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="bookmark-folder" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                    <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                                    {t('location')}
                                </Label>
                                <Popover open={recommendationOpen} onOpenChange={setRecommendationOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleAIRecommend}
                                            disabled={isRecommending || !url || !title}
                                            className="h-6 px-2 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                            {isRecommending ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Sparkles className="h-3 w-3" />
                                            )}
                                            <span>{t('aiRecommend')}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[320px] p-0 shadow-lg border-border/50" align="end" sideOffset={5}>
                                        <div className="p-3 bg-muted/30 border-b flex items-center justify-between">
                                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                                {t('aiRecommendations')}
                                            </h4>
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                                {recommendations.length}
                                            </Badge>
                                        </div>
                                        <div className="p-1 max-h-[280px] overflow-y-auto custom-scrollbar">
                                            {recommendations.map((rec, index) => (
                                                <div key={index}>
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full justify-start h-auto py-2.5 px-3 text-left flex flex-col items-start gap-1 hover:bg-accent/50 group transition-colors"
                                                        onClick={() => handleSelectRecommendation(rec)}
                                                    >
                                                        <div className="flex items-center gap-2.5 w-full">
                                                            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors shrink-0">
                                                                <FolderIcon className="h-3.5 w-3.5" />
                                                            </div>
                                                            <span className="text-sm font-medium truncate flex-1 text-foreground/90 group-hover:text-foreground">
                                                                {rec.folderPath}
                                                            </span>
                                                        </div>
                                                        {rec.reason && (
                                                            <span className="text-xs text-muted-foreground/80 line-clamp-2 pl-9 leading-relaxed">
                                                                {rec.reason}
                                                            </span>
                                                        )}
                                                    </Button>
                                                    {index < recommendations.length - 1 && <Separator className="my-1 opacity-30" />}
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <CascadingFolderSelect
                                folders={folders}
                                selectedId={selectedFolder}
                                onSelect={setSelectedFolder}
                                placeholder={t('selectFolder')}
                                className="w-full"
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="p-6 pt-2 pb-6 bg-background">
                        <Button
                            onClick={handleAddBookmark}
                            disabled={isCreating || !title.trim() || !url.trim()}
                            className="w-full h-11 text-sm font-medium shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90"
                            size="lg"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('adding')}
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('addBookmark')}
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </TooltipProvider>
    );
}

export default App;
