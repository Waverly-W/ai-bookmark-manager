import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FaFolder, FaSearch, FaArrowLeft, FaHistory, FaTimes } from 'react-icons/fa';
import { Edit, Trash2, X, CheckSquare, Sparkles, Loader2, BarChart2 } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/breadcrumb';
import { BookmarkCard, BookmarkCardItem } from '@/components/ui/bookmark-card';
import { BookmarkEditDialog } from '@/components/ui/bookmark-edit-dialog';
import { BookmarkDeleteDialog } from '@/components/ui/bookmark-delete-dialog';
import { FolderEditDialog } from '@/components/ui/folder-edit-dialog';
import { FolderDeleteDialog } from '@/components/ui/folder-delete-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import {
    getBookmarkRootSetting,
    filterBookmarksByRoot,
    updateChromeBookmark,
    deleteChromeBookmark,
    broadcastBookmarkUpdate
} from '@/lib/bookmarkUtils';
import { preloadFavicons, cleanupFaviconCache } from '@/lib/faviconUtils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help';
import { ClassificationDialog } from '@/components/ui/classification-dialog';
import { batchClassifyBookmarks } from '@/lib/aiService';
import { getAIConfig } from '@/lib/aiConfigUtils';
import { getBookmarkFolders, moveChromeBookmark } from '@/lib/bookmarkUtils';
import { BookmarkNode } from '@/entrypoints/types';

// 书签节点类型定义 - 使用 entrypoints/types.ts 中的定义
// interface BookmarkNode {
//     id: string;
//     title: string;
//     url?: string;
//     children?: BookmarkNode[];
//     parentId?: string;
//     index?: number;
//     dateAdded?: number;
//     dateGroupModified?: number;
// }

// 导航历史项
interface NavigationItem {
    id: string;
    title: string;
    node?: BookmarkNode;
}

// 递归搜索书签
const searchBookmarks = (nodes: BookmarkNode[], searchTerm: string): BookmarkNode[] => {
    const results: BookmarkNode[] = [];

    for (const node of nodes) {
        // 检查当前节点是否匹配
        const titleMatch = node.title.toLowerCase().includes(searchTerm.toLowerCase());
        const urlMatch = node.url && node.url.toLowerCase().includes(searchTerm.toLowerCase());

        if (titleMatch || urlMatch) {
            results.push(node);
        }

        // 递归搜索子节点
        if (node.children) {
            const childResults = searchBookmarks(node.children, searchTerm);
            results.push(...childResults);
        }
    }

    return results;
};

// 统计书签数量（递归）
const countBookmarks = (nodes: BookmarkNode[]): number => {
    let count = 0;
    for (const node of nodes) {
        if (node.url) {
            count++;
        }
        if (node.children) {
            count += countBookmarks(node.children);
        }
    }
    return count;
};

// 根据ID查找书签节点
const findNodeById = (nodes: BookmarkNode[], id: string): BookmarkNode | null => {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
};

// 转换为卡片项格式
const convertToCardItems = (nodes: BookmarkNode[]): BookmarkCardItem[] => {
    if (!nodes || !Array.isArray(nodes)) {
        return [];
    }

    return nodes.map(node => ({
        id: node.id,
        title: node.title,
        url: node.url,
        children: node.children ? convertToCardItems(node.children) : undefined
    }));
};

// 收集所有书签URL（用于预加载favicon）
const collectBookmarkUrls = (nodes: BookmarkNode[]): string[] => {
    const urls: string[] = [];

    for (const node of nodes) {
        if (node.url) {
            urls.push(node.url);
        }
        if (node.children) {
            urls.push(...collectBookmarkUrls(node.children));
        }
    }

    return urls;
};

export const Bookmarks: React.FC = () => {
    const [allBookmarks, setAllBookmarks] = useState<BookmarkNode[]>([]);
    const [currentItems, setCurrentItems] = useState<BookmarkCardItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [navigationHistory, setNavigationHistory] = useState<NavigationItem[]>([
        { id: 'root', title: 'All Bookmarks' }
    ]);
    const [editingBookmark, setEditingBookmark] = useState<BookmarkCardItem | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [deletingBookmark, setDeletingBookmark] = useState<BookmarkCardItem | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [showSearchHistory, setShowSearchHistory] = useState(false);

    // 批量管理状态
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // AI 批量分类状态
    const [isClassifying, setIsClassifying] = useState(false);
    const [classificationResults, setClassificationResults] = useState<any[]>([]);
    const [showClassificationDialog, setShowClassificationDialog] = useState(false);
    const [isApplyingClassification, setIsApplyingClassification] = useState(false);
    const [allFolders, setAllFolders] = useState<any[]>([]);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

    // 加载搜索历史
    useEffect(() => {
        browser.storage.local.get('searchHistory').then((result) => {
            if (result.searchHistory) {
                setSearchHistory(result.searchHistory);
            }
        });
    }, []);

    // 保存搜索历史
    const saveSearchHistory = (term: string) => {
        if (!term.trim()) return;
        const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
        setSearchHistory(newHistory);
        browser.storage.local.set({ searchHistory: newHistory });
    };

    // 清除搜索历史
    const clearSearchHistory = () => {
        setSearchHistory([]);
        browser.storage.local.remove('searchHistory');
    };

    // 删除单条历史
    const removeHistoryItem = (e: React.MouseEvent, term: string) => {
        e.stopPropagation();
        const newHistory = searchHistory.filter(h => h !== term);
        setSearchHistory(newHistory);
        browser.storage.local.set({ searchHistory: newHistory });
    };

    // 文件夹编辑和删除状态
    const [editingFolder, setEditingFolder] = useState<BookmarkCardItem | null>(null);
    const [isFolderEditDialogOpen, setIsFolderEditDialogOpen] = useState(false);
    const [deletingFolder, setDeletingFolder] = useState<BookmarkCardItem | null>(null);
    const [isFolderDeleteDialogOpen, setIsFolderDeleteDialogOpen] = useState(false);
    const [isDeletingFolder, setIsDeletingFolder] = useState(false);



    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    useEffect(() => {
        loadBookmarks();

        // 清理过期的favicon缓存
        cleanupFaviconCache();

        // 监听storage变化，当书签根目录设置改变时重新加载
        const handleStorageChange = (changes: { [key: string]: any }) => {
            if (changes.bookmarkRootFolder) {
                loadBookmarks();
            }
        };

        browser.storage.onChanged.addListener(handleStorageChange);

        return () => {
            browser.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    // 键盘快捷键
    useKeyboardShortcuts([
        // / - 聚焦搜索框
        {
            key: '/',
            handler: () => {
                searchInputRef.current?.focus();
            },
            description: t('focusSearch'),
        },
        // Esc - 清空搜索
        {
            key: 'Escape',
            handler: () => {
                setSearchTerm('');
                searchInputRef.current?.blur();
            },
            description: t('clearSearch'),
        },
        // ? - 显示快捷键帮助
        {
            key: '?',
            handler: () => {
                setShowShortcutsHelp(prev => !prev);
            },
            description: t('showShortcuts'),
        },
    ]);

    const loadBookmarks = async () => {
        try {
            setLoading(true);
            setError(null);

            // 获取书签树和根目录设置
            const [bookmarkTree, rootFolderId] = await Promise.all([
                browser.bookmarks.getTree(),
                getBookmarkRootSetting()
            ]);

            // Chrome书签树的结构：根节点 -> 书签栏、其他书签等
            const rootNodes = bookmarkTree[0]?.children || [];

            // 根据设置过滤书签
            const filteredBookmarks = filterBookmarksByRoot(rootNodes, rootFolderId);

            setAllBookmarks(filteredBookmarks);



            // 设置当前显示的项目（根级别）
            const rootItems = convertToCardItems(filteredBookmarks);
            setCurrentItems(rootItems);

            // 重置导航历史
            setNavigationHistory([{ id: 'root', title: t('allBookmarks') }]);

            // 预加载favicon（异步，不阻塞UI）
            const bookmarkUrls = collectBookmarkUrls(filteredBookmarks);
            if (bookmarkUrls.length > 0) {
                preloadFavicons(bookmarkUrls);
            }
        } catch (err) {
            console.error('Error loading bookmarks:', err);
            setError(t('bookmarksLoadError'));
        } finally {
            setLoading(false);
        }
    };

    // 处理卡片点击
    const handleCardClick = async (item: BookmarkCardItem) => {
        if (item.url) {
            // 是书签，打开链接
            try {
                await browser.tabs.create({ url: item.url });
            } catch (error) {
                console.error('Error opening bookmark:', error);
            }
        } else {
            // 是文件夹，进入文件夹
            const folderItems = item.children || [];
            setCurrentItems(folderItems);

            // 更新导航历史
            setNavigationHistory(prev => [
                ...prev,
                { id: item.id, title: item.title }
            ]);
        }
    };

    // 处理编辑（书签或文件夹）
    const handleBookmarkEdit = (item: BookmarkCardItem) => {
        const isFolder = !item.url;
        console.log('Opening edit dialog for:', isFolder ? 'folder' : 'bookmark', item.title);

        if (isFolder) {
            setEditingFolder(item);
            setIsFolderEditDialogOpen(true);
        } else {
            setEditingBookmark(item);
            setIsEditDialogOpen(true);
        }
    };

    // 处理弹窗关闭
    const handleDialogClose = (open: boolean) => {
        console.log('Dialog open state changed:', open);
        setIsEditDialogOpen(open);
        if (!open) {
            // 立即清理状态
            setEditingBookmark(null);

            // 强制清理可能残留的Portal元素
            setTimeout(() => {
                console.log('Edit dialog closed, cleaning up and restoring interactions');

                // 查找并移除可能残留的Radix Portal元素
                const portals = document.querySelectorAll('[data-radix-portal]');
                portals.forEach(portal => {
                    if (portal.children.length === 0) {
                        portal.remove();
                    }
                });

                // 查找并移除可能残留的overlay元素
                const overlays = document.querySelectorAll('[data-slot="dialog-overlay"]');
                overlays.forEach(overlay => {
                    if (overlay.getAttribute('data-state') === 'closed') {
                        overlay.remove();
                    }
                });

                // 确保body没有被设置为不可交互
                document.body.style.pointerEvents = '';

                console.log('Edit dialog cleanup completed');
            }, 300);
        }
    };

    // 处理书签保存
    const handleBookmarkSave = async (id: string, title: string, url: string) => {
        try {
            // 更新Chrome书签
            await updateChromeBookmark(id, title, url);

            // 广播更新消息
            await broadcastBookmarkUpdate(id, title, url);

            // 更新本地状态
            const updateBookmarkInTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
                if (!nodes || !Array.isArray(nodes)) {
                    return [];
                }
                return nodes.map(node => {
                    if (node.id === id) {
                        return { ...node, title, url };
                    }
                    if (node.children) {
                        return { ...node, children: updateBookmarkInTree(node.children) };
                    }
                    return node;
                });
            };

            const updatedBookmarks = updateBookmarkInTree(allBookmarks);
            setAllBookmarks(updatedBookmarks);

            // 更新当前显示的项目
            const updateCurrentItems = (items: BookmarkCardItem[]): BookmarkCardItem[] => {
                if (!items || !Array.isArray(items)) {
                    return [];
                }
                return items.map(item => {
                    if (item.id === id) {
                        return { ...item, title, url };
                    }
                    if (item.children) {
                        return { ...item, children: updateCurrentItems(item.children) };
                    }
                    return item;
                });
            };

            setCurrentItems(updateCurrentItems(currentItems));
        } catch (error) {
            console.error('Failed to save bookmark:', error);
            throw error; // 重新抛出错误，让Dialog组件处理
        }
    };

    // 处理删除（书签或文件夹）
    const handleBookmarkDelete = (item: BookmarkCardItem) => {
        const isFolder = !item.url;
        console.log('Opening delete dialog for:', isFolder ? 'folder' : 'bookmark', item.title);

        if (isFolder) {
            setDeletingFolder(item);
            setIsFolderDeleteDialogOpen(true);
        } else {
            setDeletingBookmark(item);
            setIsDeleteDialogOpen(true);
        }
    };

    // 处理删除确认
    const handleDeleteConfirm = async () => {
        if (!deletingBookmark) return;

        setIsDeleting(true);
        try {
            // 删除Chrome书签
            await deleteChromeBookmark(deletingBookmark.id);

            // 从本地状态中移除书签
            const removeBookmarkFromTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
                if (!nodes || !Array.isArray(nodes)) {
                    return [];
                }
                return nodes
                    .filter(node => node.id !== deletingBookmark.id)
                    .map(node => {
                        if (node.children) {
                            return { ...node, children: removeBookmarkFromTree(node.children) };
                        }
                        return node;
                    });
            };

            const updatedBookmarks = removeBookmarkFromTree(allBookmarks);
            setAllBookmarks(updatedBookmarks);

            // 更新当前显示的项目
            const removeFromCurrentItems = (items: BookmarkCardItem[]): BookmarkCardItem[] => {
                if (!items || !Array.isArray(items)) {
                    return [];
                }
                return items
                    .filter(item => item.id !== deletingBookmark.id)
                    .map(item => {
                        if (item.children) {
                            return { ...item, children: removeFromCurrentItems(item.children) };
                        }
                        return item;
                    });
            };

            setCurrentItems(removeFromCurrentItems(currentItems));

            // 显示成功消息
            toast({
                title: t('bookmarkDeleted'),
                description: `"${deletingBookmark.title}" ${t('bookmarkDeleted')}`,
            });

            // 立即重置所有状态
            setIsDeleteDialogOpen(false);
            setDeletingBookmark(null);
            setIsDeleting(false);

            // 确保页面交互正常
            setTimeout(() => {
                console.log('Delete operation completed successfully, page interactions restored');
            }, 50);
        } catch (error) {
            console.error('Failed to delete bookmark:', error);
            toast({
                title: t('deleteBookmarkFailed'),
                description: error instanceof Error ? error.message : t('deleteBookmarkFailed'),
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // 处理删除对话框关闭
    const handleDeleteDialogClose = (open: boolean) => {
        console.log('Delete dialog open state changed:', open);
        setIsDeleteDialogOpen(open);
        if (!open) {
            // 立即重置状态，确保页面交互正常
            setDeletingBookmark(null);
            setIsDeleting(false);

            // 强制清理可能残留的Portal元素
            setTimeout(() => {
                console.log('Delete dialog closed, cleaning up and restoring interactions');

                // 查找并移除可能残留的Radix Portal元素
                const portals = document.querySelectorAll('[data-radix-portal]');
                portals.forEach(portal => {
                    if (portal.children.length === 0) {
                        portal.remove();
                    }
                });

                // 查找并移除可能残留的overlay元素
                const overlays = document.querySelectorAll('[data-slot="alert-dialog-overlay"]');
                overlays.forEach(overlay => {
                    if (overlay.getAttribute('data-state') === 'closed') {
                        overlay.remove();
                    }
                });

                // 确保body没有被设置为不可交互
                document.body.style.pointerEvents = '';

                console.log('Portal cleanup completed');
            }, 300);
        }
    };

    // 文件夹编辑相关处理函数
    const handleFolderDialogClose = (open: boolean) => {
        console.log('Folder dialog open state changed:', open);
        setIsFolderEditDialogOpen(open);
        if (!open) {
            // 立即清理状态
            setEditingFolder(null);

            // 强制清理可能残留的Portal元素
            setTimeout(() => {
                console.log('Folder dialog closed, cleaning up and restoring interactions');

                // 查找并移除可能残留的Radix Portal元素
                const portals = document.querySelectorAll('[data-radix-portal]');
                portals.forEach(portal => {
                    if (portal.children.length === 0) {
                        portal.remove();
                    }
                });

                // 查找并移除可能残留的overlay元素
                const overlays = document.querySelectorAll('[data-slot="dialog-overlay"]');
                overlays.forEach(overlay => {
                    if (overlay.getAttribute('data-state') === 'closed') {
                        overlay.remove();
                    }
                });

                // 确保body没有被设置为不可交互
                document.body.style.pointerEvents = '';

                console.log('Folder dialog cleanup completed');
            }, 300);
        }
    };

    // 处理文件夹保存
    const handleFolderSave = async (id: string, title: string) => {
        try {
            // 更新Chrome书签
            await updateChromeBookmark(id, title, '');

            // 广播更新消息
            await broadcastBookmarkUpdate(id, title, '');

            // 更新本地状态
            const updateFolderInTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
                if (!nodes || !Array.isArray(nodes)) {
                    return [];
                }
                return nodes.map(node => {
                    if (node.id === id) {
                        return { ...node, title };
                    }
                    if (node.children) {
                        return { ...node, children: updateFolderInTree(node.children) };
                    }
                    return node;
                });
            };

            const updatedBookmarks = updateFolderInTree(allBookmarks);
            setAllBookmarks(updatedBookmarks);

            // 更新当前显示的项目
            const updateCurrentItems = (items: BookmarkCardItem[]): BookmarkCardItem[] => {
                if (!items || !Array.isArray(items)) {
                    return [];
                }
                return items.map(item => {
                    if (item.id === id) {
                        return { ...item, title };
                    }
                    if (item.children) {
                        return { ...item, children: updateCurrentItems(item.children) };
                    }
                    return item;
                });
            };

            setCurrentItems(updateCurrentItems(currentItems));

            // 更新导航历史中的标题
            setNavigationHistory(prev => prev.map(item =>
                item.id === id ? { ...item, title } : item
            ));
        } catch (error) {
            console.error('Failed to save folder:', error);
            throw error;
        }
    };

    // 处理文件夹删除确认
    const handleFolderDeleteConfirm = async () => {
        if (!deletingFolder) return;

        setIsDeletingFolder(true);
        try {
            // 删除Chrome书签文件夹
            await deleteChromeBookmark(deletingFolder.id);

            // 从本地状态中移除文件夹
            const removeFolderFromTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
                if (!nodes || !Array.isArray(nodes)) {
                    return [];
                }
                return nodes
                    .filter(node => node.id !== deletingFolder.id)
                    .map(node => {
                        if (node.children) {
                            return { ...node, children: removeFolderFromTree(node.children) };
                        }
                        return node;
                    });
            };

            const updatedBookmarks = removeFolderFromTree(allBookmarks);
            setAllBookmarks(updatedBookmarks);

            // 更新当前显示的项目
            const removeFromCurrentItems = (items: BookmarkCardItem[]): BookmarkCardItem[] => {
                if (!items || !Array.isArray(items)) {
                    return [];
                }
                return items
                    .filter(item => item.id !== deletingFolder.id)
                    .map(item => {
                        if (item.children) {
                            return { ...item, children: removeFromCurrentItems(item.children) };
                        }
                        return item;
                    });
            };

            setCurrentItems(removeFromCurrentItems(currentItems));

            // 如果删除的是当前所在的文件夹，返回上一级
            const isCurrentFolder = navigationHistory.some(item => item.id === deletingFolder.id);
            if (isCurrentFolder) {
                // 返回根目录
                const rootItems = convertToCardItems(updatedBookmarks);
                setCurrentItems(rootItems);
                setNavigationHistory([{ id: 'root', title: t('allBookmarks') }]);
            }

            // 显示成功消息
            toast({
                title: t('folderDeleted'),
                description: `"${deletingFolder.title}" ${t('folderDeleted')}`,
            });

            // 立即重置所有状态
            setIsFolderDeleteDialogOpen(false);
            setDeletingFolder(null);
            setIsDeletingFolder(false);

            // 确保页面交互正常
            setTimeout(() => {
                console.log('Folder delete operation completed successfully, page interactions restored');
            }, 50);
        } catch (error) {
            console.error('Failed to delete folder:', error);
            toast({
                title: t('deleteFolderFailed'),
                description: error instanceof Error ? error.message : t('deleteFolderFailed'),
                variant: "destructive"
            });
        } finally {
            setIsDeletingFolder(false);
        }
    };

    // 处理文件夹删除对话框关闭
    const handleFolderDeleteDialogClose = (open: boolean) => {
        console.log('Folder delete dialog open state changed:', open);
        setIsFolderDeleteDialogOpen(open);
        if (!open) {
            // 立即重置状态，确保页面交互正常
            setDeletingFolder(null);
            setIsDeletingFolder(false);

            // 强制清理可能残留的Portal元素
            setTimeout(() => {
                console.log('Folder delete dialog closed, cleaning up and restoring interactions');

                // 查找并移除可能残留的Radix Portal元素
                const portals = document.querySelectorAll('[data-radix-portal]');
                portals.forEach(portal => {
                    if (portal.children.length === 0) {
                        portal.remove();
                    }
                });

                // 查找并移除可能残留的overlay元素
                const overlays = document.querySelectorAll('[data-slot="alert-dialog-overlay"]');
                overlays.forEach(overlay => {
                    if (overlay.getAttribute('data-state') === 'closed') {
                        overlay.remove();
                    }
                });

                // 确保body没有被设置为不可交互
                document.body.style.pointerEvents = '';

                console.log('Folder delete dialog cleanup completed');
            }, 300);
        }
    };

    // 处理面包屑导航
    const handleBreadcrumbNavigate = (itemId: string) => {
        if (itemId === 'root') {
            // 返回根目录
            const rootItems = convertToCardItems(allBookmarks);
            setCurrentItems(rootItems);
            setNavigationHistory([{ id: 'root', title: t('allBookmarks') }]);
        } else {
            // 查找对应的节点
            const targetNode = findNodeById(allBookmarks, itemId);
            if (targetNode && targetNode.children) {
                const folderItems = convertToCardItems(targetNode.children);
                setCurrentItems(folderItems);

                // 更新导航历史（保留到目标项为止）
                const targetIndex = navigationHistory.findIndex(item => item.id === itemId);
                if (targetIndex !== -1) {
                    setNavigationHistory(navigationHistory.slice(0, targetIndex + 1));
                }
            }
        }
    };

    // 返回上一级
    const handleBack = () => {
        if (navigationHistory.length > 1) {
            const newHistory = navigationHistory.slice(0, -1);
            const parentId = newHistory[newHistory.length - 1].id;
            handleBreadcrumbNavigate(parentId);
        }
    };



    // 处理搜索
    const getDisplayItems = (): BookmarkCardItem[] => {
        if (searchTerm.trim() === '') {
            return currentItems;
        }

        // 搜索时显示所有匹配的结果，不受层级限制
        const searchResults = searchBookmarks(allBookmarks, searchTerm);
        return convertToCardItems(searchResults);
    };

    // 处理搜索提交
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveSearchHistory(searchTerm);
        setShowSearchHistory(false);
    };

    // 批量管理相关函数
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedItems(new Set());
    };

    const handleSelectItem = (item: BookmarkCardItem, selected: boolean) => {
        const newSelected = new Set(selectedItems);
        if (selected) {
            newSelected.add(item.id);
        } else {
            newSelected.delete(item.id);
        }
        setSelectedItems(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedItems.size === displayItems.length) {
            setSelectedItems(new Set());
        } else {
            const allIds = displayItems.map(item => item.id);
            setSelectedItems(new Set(allIds));
        }
    };


    const handleBatchDeleteConfirm = async () => {
        if (selectedItems.size === 0) return;

        setIsBatchDeleting(true);
        try {
            const idsToDelete = Array.from(selectedItems);

            // 批量删除Chrome书签
            await Promise.all(idsToDelete.map(id => deleteChromeBookmark(id)));

            // 更新本地状态
            const removeBookmarksFromTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
                if (!nodes || !Array.isArray(nodes)) return [];
                return nodes
                    .filter(node => !selectedItems.has(node.id))
                    .map(node => {
                        if (node.children) {
                            return { ...node, children: removeBookmarksFromTree(node.children) };
                        }
                        return node;
                    });
            };

            const updatedBookmarks = removeBookmarksFromTree(allBookmarks);
            setAllBookmarks(updatedBookmarks);

            // 更新文件夹列表
            const folders = await getBookmarkFolders();
            setAllFolders(folders);

            toast({
                title: t('batchDeleteSuccess'),
                description: t('batchDeleteSuccessDesc', { count: selectedItems.size }),
                duration: 3000,
            });

            // 重置状态
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            setShowBatchDeleteDialog(false);
        } catch (error) {
            console.error('Batch delete failed:', error);
            toast({
                title: t('error'),
                description: error instanceof Error ? error.message : t('batchDeleteFailed'),
                variant: "destructive",
            });
        } finally {
            setIsBatchDeleting(false);
        }
    };

    const handleAIClassify = async () => {
        // 1. 检查 AI 配置
        const aiConfig = await getAIConfig();
        if (!aiConfig || !aiConfig.apiKey) {
            toast({
                title: t('aiNotConfigured'),
                description: t('pleaseConfigureAI'),
                variant: "destructive"
            });
            return;
        }

        setIsClassifying(true);
        try {
            // 2. 确定要分类的书签
            let bookmarksToClassify: BookmarkCardItem[] = [];
            if (selectedItems.size > 0) {
                bookmarksToClassify = displayItems.filter(item => selectedItems.has(item.id));
            } else {
                // 如果没有选中，则分类当前视图下的所有书签（排除文件夹）
                bookmarksToClassify = displayItems.filter(item => item.url);
            }

            if (bookmarksToClassify.length === 0) {
                toast({
                    title: t('noBookmarksFound'),
                    description: t('pleaseSelectBookmarks'),
                    variant: "destructive"
                });
                return;
            }

            // 3. 获取所有文件夹
            const folders = await getBookmarkFolders();
            setAllFolders(folders);

            // 4. 调用 AI 服务
            const result = await batchClassifyBookmarks(
                aiConfig,
                bookmarksToClassify.map(b => ({ id: b.id, title: b.title, url: b.url! })),
                folders,
                i18n.language
            );

            if (result.success && result.classifications) {
                // 5. 映射结果，添加原始信息
                const enrichedResults = result.classifications.map(c => {
                    const original = bookmarksToClassify.find(b => b.id === c.bookmarkId);
                    return {
                        ...c,
                        bookmarkTitle: original?.title || '',
                        bookmarkUrl: original?.url || ''
                    };
                });
                setClassificationResults(enrichedResults);
                setShowClassificationDialog(true);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('AI classification failed:', error);
            toast({
                title: t('error'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: "destructive"
            });
        } finally {
            setIsClassifying(false);
        }
    };

    const handleApplyClassification = async (results: any[]) => {
        setIsApplyingClassification(true);
        try {
            let successCount = 0;
            for (const result of results) {
                if (result.suggestedFolderId && result.suggestedFolderId !== '0') {
                    await moveChromeBookmark(result.bookmarkId, result.suggestedFolderId);
                    successCount++;
                }
            }

            toast({
                title: t('processingCompleted'),
                description: t('batchRenameSuccessDesc', { count: successCount }).replace('删除', '移动'),
            });

            // 刷新书签
            const tree = await browser.bookmarks.getTree();
            if (tree.length > 0 && tree[0].children) {
                const flatNodes: BookmarkNode[] = [];
                const traverse = (nodes: any[]) => {
                    for (const node of nodes) {
                        flatNodes.push(node);
                        if (node.children) traverse(node.children);
                    }
                };
                traverse(tree[0].children);
                setAllBookmarks(flatNodes);
            }

            setShowClassificationDialog(false);
            setIsSelectionMode(false);
            setSelectedItems(new Set());
        } catch (error) {
            console.error('Apply classification failed:', error);
            toast({
                title: t('error'),
                description: t('applyChangesFailed'),
                variant: "destructive"
            });
        } finally {
            setIsApplyingClassification(false);
        }
    };

    const displayItems = getDisplayItems();
    const isSearching = searchTerm.trim() !== '';

    // 生成面包屑项
    const breadcrumbItems: BreadcrumbItem[] = (navigationHistory || []).map((item, index) => ({
        id: item.id,
        title: item.id === 'root' ? t('allBookmarks') : item.title,
        isLast: index === navigationHistory.length - 1
    }));

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2">{t('loading')}</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-8">
                    <div className="text-center">
                        <p className="text-red-500 mb-4">{error}</p>
                        <Button onClick={loadBookmarks} variant="outline">
                            {t('retry')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* 页面标题区域 */}
            <div className="space-y-4 pb-4 border-b border-border">
                <div className="space-y-2 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('bookmarks')}</h1>
                        <p className="text-muted-foreground text-sm">
                            {t('bookmarksTotal')}: {countBookmarks(allBookmarks)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={isSelectionMode ? "secondary" : "outline"}
                            onClick={toggleSelectionMode}
                            className="gap-2"
                        >
                            {isSelectionMode ? (
                                <>
                                    <X className="h-4 w-4" />
                                    {t('cancel')}
                                </>
                            ) : (
                                <>
                                    <CheckSquare className="h-4 w-4" />
                                    {t('batchManage')}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="flex justify-start w-full max-w-lg">
                    <div className="relative w-full">
                        <form onSubmit={handleSearchSubmit}>
                            <div className="relative group">
                                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors h-4 w-4" />
                                <Input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={t('searchPlaceholder')}
                                    className="pl-11 h-12 w-full rounded-full bg-secondary/30 hover:bg-secondary/50 focus:bg-surface-container-high border-0 shadow-sm hover:shadow-md transition-all duration-300 ease-md-emphasized text-base placeholder:text-muted-foreground/70"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onFocus={() => setShowSearchHistory(true)}
                                    onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                                />
                            </div>
                        </form>

                        {/* 搜索历史下拉面板 */}
                        {showSearchHistory && searchHistory.length > 0 && !searchTerm && (
                            <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-2xl border-none rounded-[1.5rem] bg-surface-container overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <CardContent className="p-2 space-y-1">
                                    <div className="flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground">
                                        <span>{t('searchHistory')}</span>
                                        <button
                                            onClick={clearSearchHistory}
                                            className="hover:text-destructive transition-colors"
                                        >
                                            {t('clear')}
                                        </button>
                                    </div>
                                    {searchHistory.map((term, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-on-surface/5 rounded-full cursor-pointer group transition-colors duration-200"
                                            onClick={() => {
                                                setSearchTerm(term);
                                                setShowSearchHistory(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FaHistory className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                <span className="text-sm truncate text-foreground/90">{term}</span>
                                            </div>
                                            <button
                                                onClick={(e) => removeHistoryItem(e, term)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-all"
                                            >
                                                <span className="sr-only">{t('delete')}</span>
                                                <FaTimes className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>



            {/* 面包屑导航 */}
            {!isSearching && (
                <div className="py-2">
                    <Breadcrumb
                        items={breadcrumbItems}
                        onNavigate={handleBreadcrumbNavigate}
                        onBack={handleBack}
                    />
                </div>
            )}

            {/* 书签卡片网格 */}
            <div className="min-h-[200px]">
                {displayItems.length === 0 ? (
                    isSearching ? (
                        <EmptyState
                            icon="🔍"
                            title={t('searchNoResults')}
                            variant="search"
                        />
                    ) : (
                        <EmptyState
                            icon="📚"
                            title={t('emptyBookmarksTitle')}
                            features={[
                                t('emptyBookmarksFeature1'),
                                t('emptyBookmarksFeature2'),
                                t('emptyBookmarksFeature3')
                            ]}
                            actions={
                                <>
                                    <Button variant="default" disabled>
                                        {t('importBookmarks')}
                                    </Button>
                                    <Button variant="outline" disabled>
                                        {t('watchTutorial')}
                                    </Button>
                                </>
                            }
                        />
                    )
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {(displayItems || []).map((item) => (
                            <BookmarkCard
                                key={item.id}
                                item={item}
                                onClick={handleCardClick}
                                onEdit={handleBookmarkEdit}
                                onDelete={handleBookmarkDelete}
                                highlight={searchTerm}
                                selectable={isSelectionMode}
                                selected={selectedItems.has(item.id)}
                                onSelect={handleSelectItem}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 书签编辑弹窗 */}
            <BookmarkEditDialog
                open={isEditDialogOpen}
                onOpenChange={handleDialogClose}
                bookmark={editingBookmark}
                onSave={handleBookmarkSave}
            />

            {/* 书签删除确认弹窗 */}
            <BookmarkDeleteDialog
                open={isDeleteDialogOpen}
                onOpenChange={handleDeleteDialogClose}
                bookmark={deletingBookmark}
                onConfirm={handleDeleteConfirm}
                isDeleting={isDeleting}
            />

            {/* 文件夹编辑弹窗 */}
            <FolderEditDialog
                open={isFolderEditDialogOpen}
                onOpenChange={handleFolderDialogClose}
                folder={editingFolder}
                onSave={handleFolderSave}
            />

            {/* 文件夹删除确认弹窗 */}
            <FolderDeleteDialog
                open={isFolderDeleteDialogOpen}
                onOpenChange={handleFolderDeleteDialogClose}
                folder={deletingFolder}
                onConfirm={handleFolderDeleteConfirm}
                isDeleting={isDeletingFolder}
            />

            {/* 批量删除确认弹窗 (existing) */}
            <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('batchDeleteConfirm')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('batchDeleteDescription', { count: selectedItems.size })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBatchDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isBatchDeleting}
                        >
                            {isBatchDeleting ? t('deleting') : t('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ClassificationDialog
                open={showClassificationDialog}
                onOpenChange={setShowClassificationDialog}
                results={classificationResults}
                folders={allFolders}
                onApply={handleApplyClassification}
                isApplying={isApplyingClassification}
            />

            {/* 批量操作栏 */}
            {
                isSelectionMode && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-secondary/90 backdrop-blur-md border-0 shadow-2xl rounded-full px-6 py-2.5 flex items-center space-x-2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 ease-md-emphasized ring-1 ring-white/10">
                        <span className="text-sm font-medium mr-2 text-secondary-foreground">
                            {t('selectedCount', { count: selectedItems.size })}
                        </span>

                        <div className="h-4 w-px bg-secondary-foreground/10 mx-2" />

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAll}
                            className="hover:bg-secondary-foreground/10 text-secondary-foreground rounded-full px-4"
                        >
                            <CheckSquare className="w-4 h-4 mr-2" />
                            {selectedItems.size === displayItems.length ? t('deselectAll') : t('selectAll')}
                        </Button>

                        <div className="h-4 w-px bg-secondary-foreground/10 mx-2" />

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleAIClassify}
                            disabled={isClassifying}
                            className="hover:bg-secondary-foreground/10 text-secondary-foreground rounded-full px-4"
                        >
                            {isClassifying ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2 text-primary" />
                            )}
                            {t('aiBatchClassification')}
                        </Button>

                        <div className="h-4 w-px bg-secondary-foreground/10 mx-2" />

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-100/50 rounded-full px-4"
                            onClick={() => setShowBatchDeleteDialog(true)}
                            disabled={selectedItems.size === 0}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('delete')}
                        </Button>

                        <div className="h-4 w-px bg-secondary-foreground/10 mx-2" />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-secondary-foreground/10 text-secondary-foreground"
                            onClick={toggleSelectionMode}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )
            }

            {/* 键盘快捷键帮助对话框 */}
            <KeyboardShortcutsHelp
                open={showShortcutsHelp}
                onOpenChange={setShowShortcutsHelp}
            />
        </div >
    );
};
