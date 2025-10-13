import React from 'react';
import { FaFolder, FaBookmark } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { BookmarkFolder } from '@/lib/bookmarkUtils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface FolderSelectProps {
    folders: BookmarkFolder[];
    selectedId: string;
    onSelect: (folderId: string) => void;
    className?: string;
    placeholder?: string;
}

interface FlattenedFolder {
    id: string;
    title: string;
    level: number;
    isSpecial?: boolean; // 用于标识"所有书签"等特殊项
}

// 将树形结构扁平化为带层级的列表
const flattenFolders = (folders: BookmarkFolder[], level: number = 0): FlattenedFolder[] => {
    const result: FlattenedFolder[] = [];

    if (!folders || !Array.isArray(folders)) {
        return result;
    }

    folders.forEach(folder => {
        if (!folder) return;

        // 添加当前文件夹
        result.push({
            id: folder.id,
            title: folder.title,
            level,
            isSpecial: folder.id === 'all'
        });

        // 递归添加子文件夹
        if (folder.children && folder.children.length > 0) {
            const subFolders = flattenFolders(folder.children, level + 1);
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
    return '　'.repeat(level) + '└ '; // 使用全角空格和树形符号
};

// 获取文件夹图标
const getFolderIcon = (folder: FlattenedFolder) => {
    if (folder.isSpecial) {
        return <FaBookmark className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
    }
    return <FaFolder className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
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

export const FolderSelect: React.FC<FolderSelectProps> = ({
    folders,
    selectedId,
    onSelect,
    className,
    placeholder = "选择文件夹"
}) => {
    // 扁平化文件夹列表
    const flattenedFolders = flattenFolders(folders);
    
    // 获取当前选中的文件夹信息
    const selectedFolder = findFolderById(folders, selectedId);
    
    // 生成显示值
    const getDisplayValue = () => {
        if (!selectedFolder) return placeholder;
        return selectedFolder.title;
    };

    return (
        <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className={cn("w-full", className)}>
                <div className="flex items-center gap-2 min-w-0">
                    {selectedFolder && (
                        <>
                            {selectedFolder.id === 'all' ? (
                                <FaBookmark className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            ) : (
                                <FaFolder className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            )}
                        </>
                    )}
                    <SelectValue placeholder={placeholder}>
                        <span className="truncate">{getDisplayValue()}</span>
                    </SelectValue>
                </div>
            </SelectTrigger>
            <SelectContent className="max-h-64">
                {flattenedFolders.map((folder) => (
                    <SelectItem 
                        key={folder.id} 
                        value={folder.id}
                        className="cursor-pointer"
                    >
                        <div className="flex items-center gap-2 min-w-0 w-full">
                            {getFolderIcon(folder)}
                            <span 
                                className={cn(
                                    "truncate flex-1",
                                    folder.level > 0 && "text-sm"
                                )}
                                style={{ 
                                    fontFamily: folder.level > 0 ? 'monospace' : 'inherit'
                                }}
                            >
                                {getIndentPrefix(folder.level)}{folder.title}
                            </span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
