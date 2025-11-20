import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FaFolder, FaBookmark, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { BookmarkFolder } from '@/lib/bookmarkUtils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

const FolderItem: React.FC<FolderItemProps> = ({
    folder,
    isSelected,
    isHovered,
    hasChildren,
    onHover,
    onClick,
    level
}) => {
    const handleMouseEnter = () => {
        onHover(folder.id);
    };

    const handleMouseLeave = () => {
        onHover(null);
    };

    const handleClick = () => {
        onClick(folder.id);
    };

    const getIcon = () => {
        if (folder.id === 'all') {
            return <FaBookmark className="h-4 w-4 text-amber-500 flex-shrink-0" />;
        }
        return <FaFolder className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    };

    return (
        <div
            className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm",
                "hover:bg-muted/50",
                isSelected && "bg-primary/10 text-primary font-medium",
                isHovered && !isSelected && "bg-muted/30"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={hasChildren ? isHovered : undefined}
            aria-level={level + 1}
        >
            {getIcon()}
            <span className="flex-1 truncate">{folder.title}</span>
            {hasChildren && (
                <FaChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
        </div>
    );
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
                // 如果当前层级找不到对应的文件夹（理论上不应该发生，除非数据不一致），则停止
                break;
            }
        }

        return result;
    }, [folders, activePath]);

    // 处理文件夹点击
    const handleFolderClick = useCallback((folderId: string) => {
        onSelect(folderId);
        // 点击即选中，不需要关闭 popover，用户可能想继续浏览子文件夹
        // 如果是叶子节点，或者用户想关闭，可以点击外部
        // 但为了体验，如果点击的是已选中的且没有子文件夹的，可以关闭？
        // 现在的需求是：点击那个文件夹作为选中的文件夹。
        // 保持 popover 打开让用户确认或继续选择子文件夹是比较好的 column view 体验。
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
                        "flex items-center justify-between gap-2 px-3 py-2 text-sm",
                        "border border-input rounded-md bg-background cursor-pointer",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="tree"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {selectedFolder && (
                            <>
                                {selectedFolder.id === 'all' ? (
                                    <FaBookmark className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                ) : (
                                    <FaFolder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                )}
                            </>
                        )}
                        <span className="truncate">{getDisplayValue()}</span>
                    </div>
                    <FaChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 max-w-none"
                align="start"
                side="bottom"
                sideOffset={4}
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
                                "w-48 border-r border-border last:border-r-0",
                                "overflow-y-auto flex-shrink-0"
                            )}
                            style={{ maxHeight: '320px' }}
                        >
                            <div className="py-1">
                                {panel.folders.map((folder) => {
                                    const isSelected = folder.id === selectedId;
                                    // 路径中的文件夹也应该高亮（作为父级激活状态）
                                    const isActive = activePath.includes(folder.id);
                                    const hasChildren = (folder.children?.length ?? 0) > 0;

                                    return (
                                        <div
                                            key={folder.id}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm mx-1 rounded-sm",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground font-medium"
                                                    : isActive
                                                        ? "bg-muted text-foreground"
                                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                            )}
                                            onClick={() => handleFolderClick(folder.id)}
                                            role="treeitem"
                                            aria-selected={isSelected}
                                            aria-expanded={hasChildren ? isActive : undefined}
                                        >
                                            {folder.id === 'all' ? (
                                                <FaBookmark className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-primary-foreground" : "text-amber-500")} />
                                            ) : (
                                                <FaFolder className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-primary-foreground" : "text-blue-500")} />
                                            )}
                                            <span className="flex-1 truncate">{folder.title}</span>
                                            {hasChildren && (
                                                <FaChevronRight className={cn("h-3 w-3 flex-shrink-0", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
