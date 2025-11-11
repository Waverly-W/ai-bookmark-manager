import './App.css';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useToast } from "@/hooks/use-toast";
import { browser } from "wxt/browser";
import { createChromeBookmark, validateBookmarkUrl, validateBookmarkTitle, getBookmarkFolderTree, BookmarkFolder, getBookmarkTitlesInFolder } from "@/lib/bookmarkUtils";
import { Loader2, Plus, Wand2 } from "lucide-react";
import { SearchableFolderSelect } from "@/components/ui/searchable-folder-select";
import { recommendFolder, FolderRecommendation } from "@/lib/folderRecommendation";
import { getAIConfig, isAIConfigured } from "@/lib/aiConfigUtils";
import { getFolderRecommendationConfig } from "@/lib/folderRecommendationConfig";
import { getAIRenameConfig } from "@/lib/aiRenameConfig";
import { renameBookmarkWithAI } from "@/lib/aiService";
import { useTranslation } from 'react-i18next';

function App() {
    const { toast } = useToast();
    const { i18n } = useTranslation();
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('1'); // 默认选择书签栏
    const [isRecommending, setIsRecommending] = useState(false);
    const [recommendations, setRecommendations] = useState<FolderRecommendation[]>([]); // 改为数组
    const [isRenaming, setIsRenaming] = useState(false); // AI 重命名加载状态

    // 组件加载时，获取当前标签页的信息和文件夹列表
    useEffect(() => {
        const initialize = async () => {
            try {
                // 获取当前标签页信息
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                let currentUrl = '';
                let currentTitle = '';

                if (tabs && tabs.length > 0 && tabs[0].url && tabs[0].title) {
                    currentUrl = tabs[0].url;
                    currentTitle = tabs[0].title;
                    setUrl(currentUrl);
                    setTitle(currentTitle);
                }

                // 获取文件夹列表
                const folderTree = await getBookmarkFolderTree();
                // 过滤掉"全部书签"选项
                const filteredFolders = folderTree.filter(f => f.id !== 'all');
                setFolders(filteredFolders);

                // 获取推荐配置
                const recommendConfig = await getFolderRecommendationConfig();

                // 如果启用了推荐功能，且有 URL 和标题，则调用推荐服务
                if (recommendConfig.enabled && currentUrl && currentTitle && filteredFolders.length > 0) {
                    setIsRecommending(true);

                    try {
                        const aiConfig = await getAIConfig();
                        const locale = i18n.language || 'zh_CN';

                        const result = await recommendFolder(
                            {
                                url: currentUrl,
                                title: currentTitle
                            },
                            filteredFolders,
                            aiConfig,
                            {
                                includeReason: recommendConfig.showReason,
                                timeoutMs: recommendConfig.timeoutMs,
                                locale,
                                maxRecommendations: recommendConfig.maxRecommendations
                            }
                        );

                        if (result.success && result.recommendations && result.recommendations.length > 0) {
                            setRecommendations(result.recommendations);

                            // 如果配置为自动应用推荐，则自动选择第一个推荐的文件夹
                            if (recommendConfig.autoApply && result.recommendations[0].confidence > 0) {
                                setSelectedFolder(result.recommendations[0].folderId);
                            }
                        }
                    } catch (error) {
                        console.error('Folder recommendation failed:', error);
                        // 推荐失败不影响正常使用，静默处理
                    } finally {
                        setIsRecommending(false);
                    }
                }
            } catch (error) {
                console.error('Error initializing popup:', error);
            }
        };

        initialize();
    }, [i18n.language]);

    // 处理 AI 重命名
    const handleAIRename = async () => {
        if (!url) {
            toast({
                title: "错误",
                description: "请先输入 URL",
                variant: "destructive"
            });
            return;
        }

        setIsRenaming(true);
        try {
            // 检查 AI 是否配置
            const aiConfigured = await isAIConfigured();
            if (!aiConfigured) {
                toast({
                    title: "AI 未配置",
                    description: "请先在设置中配置 AI 服务",
                    variant: "destructive"
                });
                return;
            }

            // 获取 AI 配置
            const aiConfig = await getAIConfig();
            const locale = i18n.language || 'zh_CN';

            // 获取 AI 重命名配置
            const renameConfig = await getAIRenameConfig();

            // 获取目标文件夹中的书签标题（用于参考命名格式）
            let referenceBookmarks: string[] | undefined;
            if (renameConfig.useReferenceNaming && selectedFolder && selectedFolder !== '1') {
                referenceBookmarks = await getBookmarkTitlesInFolder(selectedFolder, 20);
                console.log('[AI Rename] 参考书签:', referenceBookmarks);
            }

            // 调用 AI 重命名
            const result = await renameBookmarkWithAI(
                aiConfig,
                url,
                title || '未命名',
                locale,
                referenceBookmarks
            );

            if (result.success && result.newTitle) {
                setTitle(result.newTitle);
                toast({
                    title: "重命名成功",
                    description: `AI 建议的标题：${result.newTitle}`,
                });
            } else {
                toast({
                    title: "重命名失败",
                    description: result.error || "AI 无法生成标题",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('AI rename failed:', error);
            toast({
                title: "重命名失败",
                description: error instanceof Error ? error.message : "未知错误",
                variant: "destructive"
            });
        } finally {
            setIsRenaming(false);
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
        <div className="p-4 w-full">
            <div className="space-y-4">
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold">添加书签</h2>
                </div>

                <div className="space-y-3">
                    {/* 书签标题 */}
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-title">标题</Label>
                        <div className="flex gap-2">
                            <Input
                                id="bookmark-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="输入书签标题"
                                disabled={isCreating || isRenaming}
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAIRename}
                                disabled={isCreating || isRenaming || !url}
                                title="AI 智能重命名"
                                className="px-3"
                            >
                                {isRenaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Wand2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* 书签URL */}
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-url">URL</Label>
                        <Input
                            id="bookmark-url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                            disabled={isCreating}
                        />
                    </div>

                    {/* 文件夹选择 */}
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-folder">保存到</Label>
                        <SearchableFolderSelect
                            folders={folders}
                            selectedId={selectedFolder}
                            onSelect={setSelectedFolder}
                            placeholder="选择文件夹"
                        />

                        {/* 显示加载状态 */}
                        {isRecommending && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>AI 正在分析推荐...</span>
                            </div>
                        )}

                        {/* 显示 AI 推荐列表 */}
                        {!isRecommending && recommendations.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <Label className="text-sm font-medium">AI 推荐</Label>
                                <div className="space-y-2">
                                    {recommendations.map((rec, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedFolder === rec.folderId
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                                : 'border-border hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                                                }`}
                                            onClick={() => setSelectedFolder(rec.folderId)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium truncate">
                                                            {rec.folderPath}
                                                        </span>
                                                        {index === 0 && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                                                首选
                                                            </span>
                                                        )}
                                                    </div>
                                                    {rec.reason && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {rec.reason}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-xs font-medium ${rec.confidence >= 0.8 ? 'text-blue-600' :
                                                        rec.confidence >= 0.5 ? 'text-blue-500' :
                                                            'text-gray-500'
                                                        }`}>
                                                        {Math.round(rec.confidence * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 添加按钮 */}
                    <Button
                        onClick={handleAddBookmark}
                        disabled={isCreating || !title.trim() || !url.trim()}
                        className="w-full"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                添加中...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                添加书签
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default App;
