import React, { useState, useMemo } from 'react';
import { FaFolder, FaBookmark, FaSearch } from 'react-icons/fa';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookmarkFolder } from '@/lib/bookmarkUtils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchableFolderSelectProps {
    folders: BookmarkFolder[];
    selectedId: string;
    onSelect: (folderId: string) => void;
    className?: string;
    placeholder?: string;
}

interface FlattenedFolder {
    id: string;
    title: string;
    path: string;
    level: number;
    isSpecial?: boolean;
}

// 将树形结构扁平化为带层级的列表
const flattenFolders = (folders: BookmarkFolder[], level: number = 0, parentPath: string = ''): FlattenedFolder[] => {
    const result: FlattenedFolder[] = [];

    if (!folders || !Array.isArray(folders)) {
        return result;
    }

    folders.forEach(folder => {
        if (!folder) return;

        const currentPath = parentPath ? `${parentPath} > ${folder.title}` : folder.title;

        // 添加当前文件夹
        result.push({
            id: folder.id,
            title: folder.title,
            path: currentPath,
            level,
            isSpecial: folder.id === 'all'
        });

        // 递归添加子文件夹
        if (folder.children && folder.children.length > 0) {
            const subFolders = flattenFolders(folder.children, level + 1, currentPath);
            if (Array.isArray(subFolders)) {
                result.push(...subFolders);
            }
        }
    });

    return result;
};

// 根据层级生成缩进前缀
const getIndentPrefix = (level: number): string => {
    if (level === 0) return '';
    return '　'.repeat(level); // 使用全角空格
};

// 根据ID查找文件夹信息
const findFolderById = (folders: BookmarkFolder[], id: string): BookmarkFolder | null => {
    for (const folder of folders) {
        if (folder.id === id) {
            return folder;
        }
        if (folder.children) {
            const found = findFolderById(folder.children, id);
            if (found) return found;
        }
    }
    return null;
};

export const SearchableFolderSelect: React.FC<SearchableFolderSelectProps> = ({
    folders,
    selectedId,
    onSelect,
    className,
    placeholder = "选择文件夹"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // 扁平化文件夹列表
    const flattenedFolders = useMemo(() => flattenFolders(folders), [folders]);

    // 获取当前选中的文件夹信息
    const selectedFolder = useMemo(() => findFolderById(folders, selectedId), [folders, selectedId]);

    // 根据搜索关键字过滤文件夹
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) {
            return flattenedFolders;
        }

        const query = searchQuery.toLowerCase().trim();
        return flattenedFolders.filter(folder => {
            // 搜索标题或完整路径
            return folder.title.toLowerCase().includes(query) ||
                folder.path.toLowerCase().includes(query);
        });
    }, [flattenedFolders, searchQuery]);

    const handleSelect = (folderId: string) => {
        onSelect(folderId);
        setIsOpen(false);
        setSearchQuery(''); // 清空搜索
    };

    const getDisplayValue = () => {
        if (!selectedFolder) return placeholder;
        return selectedFolder.title;
    };

    const getFolderIcon = (folder: FlattenedFolder) => {
        if (folder.isSpecial) {
            return <FaBookmark className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
        }
        return <FaFolder className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={isOpen}
                    className={cn(
                        "w-full justify-between rounded-full bg-secondary/30 hover:bg-secondary/50 border-0 transition-all duration-300 ease-md-emphasized h-12 px-4 shadow-sm hover:shadow-md",
                        className
                    )}
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1 text-on-surface">
                        {selectedFolder && (
                            <>
                                {selectedFolder.id === 'all' ? (
                                    <FaBookmark className="h-4 w-4 text-primary flex-shrink-0" />
                                ) : (
                                    <FaFolder className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                            </>
                        )}
                        <span className="truncate font-normal text-base text-foreground/80">
                            {getDisplayValue()}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-[1.5rem] border-none shadow-xl bg-surface-container overflow-hidden" align="start">
                <div className="flex flex-col bg-card">
                    {/* 搜索框 - Material Filled Style */}
                    <div className="flex items-center px-4 py-3 bg-surface-container-high border-b border-white/5">
                        <FaSearch className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                            placeholder="搜索文件夹..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground/70"
                        />
                    </div>

                    {/* 文件夹列表 */}
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {filteredFolders.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                未找到匹配的文件夹
                            </div>
                        ) : (
                            <>
                                {filteredFolders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        onClick={() => handleSelect(folder.id)}
                                        className={cn(
                                            "relative flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 text-sm outline-none transition-all duration-200 ease-md-emphasized",
                                            "hover:bg-on-surface/5", // State Layer
                                            selectedId === folder.id
                                                ? "bg-secondary-container text-on-secondary-container font-medium"
                                                : "text-foreground/90"
                                        )}
                                    >
                                        <div className="flex items-center justify-center w-5 h-5">
                                            {selectedId === folder.id ? (
                                                <Check className="h-4 w-4 text-primary" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                            )}
                                        </div>

                                        {getFolderIcon(folder)}
                                        <span
                                            className="truncate flex-1"
                                            title={folder.path}
                                        >
                                            {getIndentPrefix(folder.level)}{folder.title}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

