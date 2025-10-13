import React, { useState } from 'react';
import { FaFolder, FaFolderOpen, FaBookmark, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { BookmarkFolder } from '@/lib/bookmarkUtils';

interface TreeSelectorProps {
    folders: BookmarkFolder[];
    selectedId: string;
    onSelect: (folderId: string) => void;
    className?: string;
}

interface TreeNodeProps {
    folder: BookmarkFolder;
    selectedId: string;
    onSelect: (folderId: string) => void;
    level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ folder, selectedId, onSelect, level }) => {
    const [isExpanded, setIsExpanded] = useState(level === 0); // 顶级文件夹默认展开
    const hasChildren = folder.children && folder.children.length > 0;
    const isSelected = folder.id === selectedId;
    const paddingLeft = level * 20;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren) {
            setIsExpanded(!isExpanded);
        }
    };

    const handleSelect = () => {
        onSelect(folder.id);
    };

    const getIcon = () => {
        if (folder.id === 'all') {
            return <FaBookmark className="h-4 w-4 text-amber-500" />;
        }
        if (hasChildren) {
            return isExpanded ? 
                <FaFolderOpen className="h-4 w-4 text-blue-500" /> : 
                <FaFolder className="h-4 w-4 text-blue-500" />;
        }
        return <FaFolder className="h-4 w-4 text-blue-500" />;
    };

    const getExpandIcon = () => {
        if (!hasChildren) return null;
        return isExpanded ? 
            <FaChevronDown className="h-3 w-3 text-muted-foreground" /> : 
            <FaChevronRight className="h-3 w-3 text-muted-foreground" />;
    };

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                    "hover:bg-muted",
                    isSelected && "bg-primary/10 border border-primary/20",
                    "group"
                )}
                style={{ paddingLeft: `${paddingLeft + 8}px` }}
                onClick={handleSelect}
            >
                {/* 展开/收起图标 */}
                <div 
                    className="flex items-center justify-center w-4 h-4"
                    onClick={handleToggle}
                >
                    {getExpandIcon()}
                </div>
                
                {/* 文件夹图标 */}
                {getIcon()}
                
                {/* 文件夹名称 */}
                <span className={cn(
                    "text-sm font-medium truncate flex-1",
                    isSelected && "text-primary font-semibold"
                )}>
                    {folder.title}
                </span>
                
                {/* 选中标识 */}
                {isSelected && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                )}
            </div>
            
            {/* 子文件夹 */}
            {hasChildren && isExpanded && (
                <div className="ml-2">
                    {folder.children!.map((child) => (
                        <TreeNode
                            key={child.id}
                            folder={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const TreeSelector: React.FC<TreeSelectorProps> = ({ 
    folders, 
    selectedId, 
    onSelect, 
    className 
}) => {
    return (
        <div className={cn(
            "border rounded-md bg-background",
            "max-h-64 overflow-y-auto",
            className
        )}>
            <div className="p-2 space-y-1">
                {folders.map((folder) => (
                    <TreeNode
                        key={folder.id}
                        folder={folder}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        level={0}
                    />
                ))}
            </div>
        </div>
    );
};
