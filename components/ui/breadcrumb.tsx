import React from 'react';
import { FaChevronRight, FaArrowLeft } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
    id: string;
    title: string;
    isLast?: boolean;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    onNavigate: (itemId: string) => void;
    onBack?: () => void;
    className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
    items, 
    onNavigate, 
    onBack,
    className 
}) => {
    return (
        <div className={cn(
            "flex items-center gap-3 px-1 py-2",
            className
        )}>
            {/* 返回按钮 */}
            {onBack && items.length > 1 && (
                <button
                    onClick={onBack}
                    className={cn(
                        "flex items-center justify-center",
                        "p-1.5",
                        "text-gray-500 dark:text-gray-400",
                        "hover:text-gray-700 dark:hover:text-gray-200",
                        "transition-colors duration-200",
                        "opacity-80 hover:opacity-100"
                    )}
                >
                    <FaArrowLeft className="h-3.5 w-3.5" />
                </button>
            )}

            {/* 面包屑路径 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {items.map((item, index) => (
                    <React.Fragment key={item.id}>
                        {/* 路径项 */}
                        <button
                            onClick={() => onNavigate(item.id)}
                            className={cn(
                                "text-sm font-medium px-1 py-0.5 transition-colors duration-200 truncate",
                                item.isLast
                                    ? "text-gray-900 dark:text-gray-100 cursor-default"
                                    : cn(
                                        "text-gray-500 dark:text-gray-400",
                                        "hover:text-gray-700 dark:hover:text-gray-200",
                                        "opacity-80 hover:opacity-100"
                                    )
                            )}
                            disabled={item.isLast}
                        >
                            {item.title}
                        </button>

                        {/* 分隔符 */}
                        {index < items.length - 1 && (
                            <FaChevronRight className="h-3 w-3 text-gray-400 dark:text-gray-500 opacity-60" />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
