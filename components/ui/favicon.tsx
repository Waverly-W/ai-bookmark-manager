import React, { useState, useEffect } from 'react';
import { FaBookmark } from 'react-icons/fa';
import { getFavicon } from '@/lib/faviconUtils';
import { cn } from '@/lib/utils';

interface FaviconProps {
    url?: string;
    className?: string;
    size?: number;
    fallbackIcon?: React.ReactNode;
}

/**
 * Favicon 组件
 *
 * 优化说明：
 * - 使用 Chrome Favicon API 获取图标，无需加载状态
 * - 直接从浏览器内部缓存读取，毫秒级响应
 * - 移除了加载动画，提升用户体验
 *
 * @example
 * <Favicon url="https://www.google.com" size={24} />
 */

export const Favicon: React.FC<FaviconProps> = ({
    url,
    className,
    size = 24,
    fallbackIcon
}) => {
    const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (!url) {
            setFaviconUrl(null);
            setHasError(false);
            return;
        }

        let isMounted = true;

        const loadFavicon = async () => {
            setHasError(false);

            try {
                const favicon = await getFavicon(url);
                if (isMounted) {
                    if (favicon) {
                        setFaviconUrl(favicon);
                        setHasError(false);
                    } else {
                        setFaviconUrl(null);
                        setHasError(true);
                    }
                }
            } catch (error) {
                console.error('Error loading favicon:', error);
                if (isMounted) {
                    setFaviconUrl(null);
                    setHasError(true);
                }
            }
        };

        loadFavicon();

        return () => {
            isMounted = false;
        };
    }, [url]);

    const handleImageError = () => {
        setFaviconUrl(null);
        setHasError(true);
    };

    // 如果没有URL，显示默认图标
    if (!url) {
        return (
            <div className={cn(
                "flex items-center justify-center",
                "w-8 h-8 rounded-lg",
                "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20",
                "border border-amber-200/50 dark:border-amber-700/50",
                "shadow-sm",
                className
            )}>
                {fallbackIcon || <FaBookmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            </div>
        );
    }

    // 如果有favicon且没有错误，显示favicon
    if (faviconUrl && !hasError) {
        return (
            <div className={cn(
                "flex items-center justify-center",
                "w-8 h-8 rounded-lg overflow-hidden",
                "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
                "border border-gray-200/50 dark:border-gray-700/50",
                "shadow-sm",
                className
            )}>
                <img
                    src={faviconUrl}
                    alt="Favicon"
                    width={size}
                    height={size}
                    className={cn(
                        "object-contain",
                        "filter drop-shadow-sm",
                        "transition-all duration-200",
                        "hover:scale-110"
                    )}
                    onError={handleImageError}
                />
            </div>
        );
    }

    // 出错或没有favicon，显示默认图标
    return (
        <div className={cn(
            "flex items-center justify-center",
            "w-8 h-8 rounded-lg",
            "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20",
            "border border-amber-200/50 dark:border-amber-700/50",
            "shadow-sm",
            className
        )}>
            {fallbackIcon || <FaBookmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        </div>
    );
};
