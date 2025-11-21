import './App.css';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Plus, Wand2, Folder as FolderIcon, Check, Sparkles } from "lucide-react";
import { CascadingFolderSelect } from "@/components/ui/cascading-folder-select";
import { useTranslation } from 'react-i18next';
import { getAIConfig, AIConfig } from "@/lib/aiConfigUtils";
import { recommendFolderWithAI, renameBookmarkContextuallyWithAI } from "@/lib/aiService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

function App() {
    const { toast } = useToast();
    const { i18n } = useTranslation();
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
                title: i18n.language.startsWith('zh') ? "AI重命名失败" : "AI Rename Failed",
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
                    title: i18n.language.startsWith('zh') ? "未找到推荐文件夹" : "No recommendations found",
                });
            }
        } catch (error) {
            console.error('AI recommend failed:', error);
            toast({
                title: i18n.language.startsWith('zh') ? "AI推荐失败" : "AI Recommendation Failed",
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
            // 不再显示Toast，直接选中即可，或者可以给按钮一个短暂的反馈（这里简化处理）
        } else {
            // Fallback: try path matching if ID fails
            const folderByPath = allFlatFolders.find(f => f.path === rec.folderPath);
            if (folderByPath) {
                setSelectedFolder(folderByPath.id);
                setRecommendationOpen(false);
            } else {
                toast({
                    title: i18n.language.startsWith('zh') ? "无法定位文件夹" : "Cannot locate folder",
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
                title: "验证错误",
                description: "书签标题不能为空且不能超过200个字符",
                variant: "destructive"
            });
            return;
        }

        if (!validateBookmarkUrl(url)) {
            toast({
                title: "验证错误",
                description: "请输入有效的URL",
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
                title: "成功",
                description: `书签已添加到「${folderName}」`,
            });

            // 清空表单
            setTitle('');
            setUrl('');

            // 可选：关闭popup
            // window.close();
        } catch (error) {
            console.error('Failed to create bookmark:', error);
            toast({
                title: "添加失败",
                description: error instanceof Error ? error.message : "无法添加书签",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="w-[400px] bg-background">
            <Card className="border-none shadow-none rounded-none">
                <CardHeader className="p-4 pb-2 border-b">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        AI Bookmark Manager
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-5">
                    {/* 书签标题 */}
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {i18n.language.startsWith('zh') ? "标题" : "Title"}
                        </Label>
                        <div className="relative">
                            <Input
                                id="bookmark-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={i18n.language.startsWith('zh') ? "输入书签标题" : "Enter bookmark title"}
                                disabled={isCreating}
                                className="pr-10"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleAIRename}
                                disabled={isRenaming || !url || !title}
                                title={i18n.language.startsWith('zh') ? "AI 智能重命名" : "AI Smart Rename"}
                                className={`absolute right-0 top-0 h-full w-10 rounded-l-none hover:bg-transparent ${isRenameSuccess ? "text-green-600" : "text-muted-foreground hover:text-primary"}`}
                            >
                                {isRenaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isRenameSuccess ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Wand2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* 书签URL */}
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-url" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</Label>
                        <Input
                            id="bookmark-url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                            disabled={isCreating}
                            className="font-mono text-xs text-muted-foreground bg-muted/30"
                        />
                    </div>

                    {/* 文件夹选择 */}
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-folder" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {i18n.language.startsWith('zh') ? "保存到" : "Folder"}
                        </Label>
                        <div className="relative flex gap-2">
                            <div className="flex-1 min-w-0">
                                <CascadingFolderSelect
                                    folders={folders}
                                    selectedId={selectedFolder}
                                    onSelect={setSelectedFolder}
                                    placeholder={i18n.language.startsWith('zh') ? "选择文件夹" : "Select folder"}
                                    className="w-full"
                                />
                            </div>

                            <Popover open={recommendationOpen} onOpenChange={setRecommendationOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleAIRecommend}
                                        disabled={isRecommending || !url || !title}
                                        title={i18n.language.startsWith('zh') ? "AI 推荐文件夹" : "AI Recommend Folder"}
                                        className="shrink-0"
                                    >
                                        {isRecommending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Wand2 className="h-4 w-4 text-blue-500" />
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[340px] p-0" align="end" sideOffset={5}>
                                    <div className="p-3 bg-muted/30 border-b">
                                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                            <Sparkles className="w-3 h-3 text-blue-500" />
                                            {i18n.language.startsWith('zh') ? "AI 推荐文件夹" : "AI Recommendations"}
                                        </h4>
                                    </div>
                                    <div className="p-1 max-h-[300px] overflow-y-auto">
                                        {recommendations.map((rec, index) => (
                                            <div key={index}>
                                                <Button
                                                    variant="ghost"
                                                    className="w-full justify-start h-auto py-3 px-3 text-left flex flex-col items-start gap-1.5 hover:bg-accent/50 group"
                                                    onClick={() => handleSelectRecommendation(rec)}
                                                >
                                                    <div className="flex items-center gap-2 w-full">
                                                        <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                                            <FolderIcon className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-sm font-medium truncate flex-1 text-foreground">{rec.folderPath}</span>
                                                    </div>
                                                    {rec.reason && (
                                                        <span className="text-xs text-muted-foreground line-clamp-2 pl-9 leading-relaxed">
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
                    </div>

                    {/* 添加按钮 */}
                    <div className="pt-2">
                        <Button
                            onClick={handleAddBookmark}
                            disabled={isCreating || !title.trim() || !url.trim()}
                            className="w-full h-10 text-sm font-medium shadow-sm"
                            size="lg"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {i18n.language.startsWith('zh') ? "添加中..." : "Adding..."}
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {i18n.language.startsWith('zh') ? "添加书签" : "Add Bookmark"}
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default App;
