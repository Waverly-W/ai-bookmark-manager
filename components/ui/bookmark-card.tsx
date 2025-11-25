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
    highlight?: string;
    selectable?: boolean;
    selected?: boolean;
    onSelect?: (item: BookmarkCardItem, selected: boolean) => void;
}

const HighlightedText = ({ text, highlight }: { text: string; highlight?: string }) => {
    if (!highlight || !highlight.trim()) return <>{text}</>;

    try {
        // Escape special characters in highlight string
        const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlight.toLowerCase() ?
                        <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground rounded-[2px] px-0.5">{part}</span> : part
                )}
            </span>
        );
    } catch (e) {
        return <>{text}</>;
    }
};

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
    item,
    onClick,
    onEdit,
    onDelete,
    className,
    highlight,
    selectable = false,
    selected = false,
    onSelect
}) => {
    const { t } = useTranslation();
    const isFolder = !item.url;
    const childrenCount = item.children?.length || 0;

    const handleClick = (e: React.MouseEvent) => {
        if (selectable && onSelect) {
            e.preventDefault();
            onSelect(item, !selected);
        } else {
            onClick(item);
        }
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
                    "bg-primary/10 dark:bg-primary/20",
                    "border border-primary/20 dark:border-primary/30",
                    "shadow-sm"
                )}>
                    <FaFolder className="h-5 w-5 text-primary" />
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
                "group border-border/50 hover:border-border relative",
                selected && "ring-2 ring-primary border-primary bg-primary/5",
                className
            )}
            onClick={handleClick}
        >
            {selectable && (
                <div className="absolute top-2 right-2 z-10">
                    <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        selected ? "bg-primary border-primary" : "bg-background/80 border-muted-foreground/50 hover:border-primary"
                    )}>
                        {selected && <div className="w-2.5 h-1.5 border-l-2 border-b-2 border-primary-foreground -rotate-45 mb-0.5" />}
                    </div>
                </div>
            )}
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
                        )}
                            title={item.title}
                        >
                            <HighlightedText text={item.title} highlight={highlight} />
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
