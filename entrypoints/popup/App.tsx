import './App.css';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useToast } from "@/hooks/use-toast";
import { browser } from "wxt/browser";
import { createChromeBookmark, validateBookmarkUrl, validateBookmarkTitle, getBookmarkFolderTree, BookmarkFolder } from "@/lib/bookmarkUtils";
import { Loader2, Plus } from "lucide-react";
import { CascadingFolderSelect } from "@/components/ui/cascading-folder-select";
import { useTranslation } from 'react-i18next';

function App() {
    const { toast } = useToast();
    const { i18n } = useTranslation();
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('1'); // 默认选择书签栏

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
            } catch (error) {
                console.error('Error initializing popup:', error);
            }
        };

        initialize();
    }, []);



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
                        <Input
                            id="bookmark-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="输入书签标题"
                            disabled={isCreating}
                        />
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
                        <CascadingFolderSelect
                            folders={folders}
                            selectedId={selectedFolder}
                            onSelect={setSelectedFolder}
                            placeholder="选择文件夹"
                            className="w-full"
                        />
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
