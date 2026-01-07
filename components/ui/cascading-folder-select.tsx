import React, { useState, useMemo, useCallback } from 'react';
import { FaFolder, FaBookmark, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { BookmarkFolder } from '@/lib/bookmarkUtils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CascadingFolderSelectProps {
    folders: BookmarkFolder[];
    selectedId: string;
    onSelect: (folderId: string) => void;
    className?: string;
    placeholder?: string;
}

interface Panel {
    level: number;
    folders: BookmarkFolder[];
    parentId?: string;
}

interface FolderItemProps {
    folder: BookmarkFolder;
    isSelected: boolean;
    isHovered: boolean;
    hasChildren: boolean;
    onHover: (folderId: string | null) => void;
    onClick: (folderId: string) => void;
    level: number;
}

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

// 根据ID查找文件夹路径
const findFolderPath = (folders: BookmarkFolder[], targetId: string): string[] => {
    const findPath = (folders: BookmarkFolder[], path: string[] = []): string[] | null => {
        for (const folder of folders) {
            const currentPath = [...path, folder.id];
            if (folder.id === targetId) {
                return currentPath;
            }
            if (folder.children) {
                const found = findPath(folder.children, currentPath);
                if (found) return found;
            }
        }
        return null;
    };
    return findPath(folders) || [];
};

export const CascadingFolderSelect: React.FC<CascadingFolderSelectProps> = ({
    folders,
    selectedId,
    onSelect,
    className,
    placeholder = "选择文件夹"
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // 获取当前选中的文件夹信息
    const selectedFolder = useMemo(() => {
        return findFolderById(folders, selectedId);
    }, [folders, selectedId]);

    // 根据选中ID计算展开路径
    const activePath = useMemo(() => {
        return findFolderPath(folders, selectedId);
    }, [folders, selectedId]);

    // 构建面板数据
    const panels = useMemo(() => {
        const result: Panel[] = [];
        let currentFolders = folders;
        let level = 0;

        // 第一层面板
        result.push({
            level: 0,
            folders: currentFolders,
            parentId: undefined
        });

        // 根据路径构建后续面板
        for (const folderId of activePath) {
            const folder = findFolderById(currentFolders, folderId);
            if (folder && folder.children && folder.children.length > 0) {
                level++;
                result.push({
                    level,
                    folders: folder.children,
                    parentId: folderId
                });
                currentFolders = folder.children;
            } else {
                break;
            }
        }

        return result;
    }, [folders, activePath]);

    // 处理文件夹点击
    const handleFolderClick = useCallback((folderId: string) => {
        onSelect(folderId);
    }, [onSelect]);

    // 生成显示值
    const getDisplayValue = () => {
        if (!selectedFolder) return placeholder;
        return selectedFolder.title;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div
                    className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2 text-sm",
                        "border-0 rounded-full bg-secondary/30 cursor-pointer",
                        "hover:bg-secondary/50 hover:shadow-md transition-all duration-300 ease-md-emphasized",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "h-12 shadow-sm",
                        className
                    )}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="tree"
                >
                    <div className="flex items-center gap-3 min-w-0 text-on-surface">
                        {selectedFolder && (
                            <>
                                {selectedFolder.id === 'all' ? (
                                    <FaBookmark className="h-4 w-4 text-primary flex-shrink-0" />
                                ) : (
                                    <FaFolder className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                            </>
                        )}
                        <span className={cn("truncate font-normal text-base", !selectedFolder ? "text-muted-foreground" : "text-foreground/90")}>
                            {getDisplayValue()}
                        </span>
                    </div>
                    <FaChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-300 ease-md-emphasized",
                        isOpen && "rotate-180"
                    )} />
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 max-w-none shadow-2xl border-none rounded-[1.5rem] bg-popover z-50 overflow-hidden"
                align="start"
                side="bottom"
                sideOffset={8}
            >
                <div
                    className="flex max-h-80 overflow-hidden bg-popover"
                    role="tree"
                    aria-label="文件夹选择器"
                >
                    {panels.map((panel, index) => (
                        <div
                            key={panel.level}
                            className={cn(
                                "w-52 border-r border-border/10 last:border-r-0",
                                "flex-shrink-0 flex flex-col py-2"
                            )}
                            style={{ maxHeight: '320px' }}
                        >
                            <ScrollArea className="h-full w-full">
                                <div className="px-2 space-y-1">
                                    {panel.folders.map((folder) => {
                                        const isSelected = folder.id === selectedId;
                                        const isActive = activePath.includes(folder.id);
                                        const hasChildren = (folder.children?.length ?? 0) > 0;

                                        return (
                                            <div
                                                key={folder.id}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 ease-md-emphasized text-sm rounded-full",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                                        : isActive
                                                            ? "bg-secondary-container text-on-secondary-container font-medium"
                                                            : "hover:bg-on-surface/5 text-foreground/80 hover:text-foreground"
                                                )}
                                                onClick={() => handleFolderClick(folder.id)}
                                                role="treeitem"
                                                aria-selected={isSelected}
                                                aria-expanded={hasChildren ? isActive : undefined}
                                            >
                                                {folder.id === 'all' ? (
                                                    <FaBookmark className={cn("h-4 w-4 flex-shrink-0 transition-colors",
                                                        isSelected ? "text-primary-foreground" :
                                                            isActive ? "text-primary" : "text-amber-500")} />
                                                ) : (
                                                    <FaFolder className={cn("h-4 w-4 flex-shrink-0 transition-colors",
                                                        isSelected ? "text-primary-foreground" :
                                                            isActive ? "text-primary" : "text-blue-500")} />
                                                )}
                                                <span className="flex-1 truncate">{folder.title}</span>
                                                {hasChildren && (
                                                    <FaChevronRight className={cn("h-3 w-3 flex-shrink-0 transition-colors",
                                                        isSelected ? "text-primary-foreground/80" :
                                                            isActive ? "text-on-secondary-container/60" : "text-muted-foreground/40")} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
