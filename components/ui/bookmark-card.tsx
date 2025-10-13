import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FaFolder, FaBookmark, FaExternalLinkAlt } from 'react-icons/fa';
import { Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Favicon } from '@/components/ui/favicon';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';

export interface BookmarkCardItem {
    id: string;
    title: string;
    url?: string; // 如果有URL则是书签，否则是文件夹
    children?: BookmarkCardItem[];
}

interface BookmarkCardProps {
    item: BookmarkCardItem;
    onClick: (item: BookmarkCardItem) => void;
    onEdit?: (item: BookmarkCardItem) => void;
    onDelete?: (item: BookmarkCardItem) => void;
    className?: string;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
    item,
    onClick,
    onEdit,
    onDelete,
    className
}) => {
    const { t } = useTranslation();
    const isFolder = !item.url;
    const childrenCount = item.children?.length || 0;

    const handleClick = () => {
        onClick(item);
    };

    const handleEdit = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log('Edit clicked for:', isFolder ? 'folder' : 'bookmark', item.title);
        if (onEdit) {
            onEdit(item);
        }
    };

    const handleDelete = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log('Delete clicked for:', isFolder ? 'folder' : 'bookmark', item.title);
        if (onDelete) {
            onDelete(item);
        }
    };

    const getIcon = () => {
        if (isFolder) {
            return (
                <div className={cn(
                    "flex items-center justify-center",
                    "w-8 h-8 rounded-lg",
                    "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
                    "border border-blue-200/50 dark:border-blue-700/50",
                    "shadow-sm"
                )}>
                    <FaFolder className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
            );
        }
        return (
            <Favicon
                url={item.url}
                size={20}
                fallbackIcon={<FaBookmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            />
        );
    };

    const getItemCount = () => {
        if (isFolder && childrenCount > 0) {
            return `${childrenCount} ${t('items')}`;
        }
        return null;
    };

    const cardContent = (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
                "group border-border/50 hover:border-border",
                className
            )}
            onClick={handleClick}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* 图标 */}
                    <div className="flex-shrink-0">
                        {getIcon()}
                    </div>

                    {/* 名称 */}
                    <div className="flex-1 min-w-0">
                        <h3 className={cn(
                            "font-medium text-sm truncate",
                            "group-hover:text-primary transition-colors"
                        )}>
                            {item.title}
                        </h3>
                    </div>

                    {/* 文件夹项目数量 */}
                    {isFolder && getItemCount() && (
                        <div className="flex-shrink-0 text-xs text-muted-foreground">
                            {getItemCount()}
                        </div>
                    )}

                    {/* 书签外链图标 */}
                    {!isFolder && (
                        <FaExternalLinkAlt className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    )}
                </div>
            </CardContent>
        </Card>
    );

    // 如果有编辑或删除功能，显示右键菜单（支持书签和文件夹）
    if (onEdit || onDelete) {
        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    {cardContent}
                </ContextMenuTrigger>
                <ContextMenuContent>
                    {onEdit && (
                        <ContextMenuItem onClick={(e) => handleEdit(e)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {isFolder ? t('renameFolder') : t('edit')}
                        </ContextMenuItem>
                    )}
                    {onEdit && onDelete && <ContextMenuSeparator />}
                    {onDelete && (
                        <ContextMenuItem
                            onClick={(e) => handleDelete(e)}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {isFolder ? t('deleteFolder') : t('delete')}
                        </ContextMenuItem>
                    )}
                </ContextMenuContent>
            </ContextMenu>
        );
    }

    return cardContent;
};
