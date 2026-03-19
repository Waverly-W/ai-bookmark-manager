import React from 'react';
import { Sparkles } from 'lucide-react';
import { FolderRecommendation } from '@/lib/folderRecommendation';
import { cn } from '@/lib/utils';

interface FolderRecommendationBadgeProps {
    recommendation: FolderRecommendation;
    showReason?: boolean;
    className?: string;
}

/**
 * 文件夹推荐标识组件
 * 显示 AI 推荐的文件夹和推荐理由
 */
export function FolderRecommendationBadge({
    recommendation,
    showReason = true,
    className = ''
}: FolderRecommendationBadgeProps) {
    // 根据置信度决定显示样式
    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'border border-primary/20 bg-primary/10 text-primary';
        if (confidence >= 0.5) return 'border border-accent/20 bg-accent/10 text-accent';
        return 'border border-border/70 bg-surface-2 text-muted-foreground';
    };

    const confidenceColor = getConfidenceColor(recommendation.confidence);

    return (
        <div className={cn("flex items-start gap-2", className)}>
            <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm shadow-sm", confidenceColor)}>
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium">AI 推荐</span>
                {recommendation.confidence > 0 && (
                    <span className="text-xs opacity-75">
                        ({Math.round(recommendation.confidence * 100)}%)
                    </span>
                )}
            </div>
            
            {showReason && recommendation.reason && (
                <div className="flex-1 py-1 text-sm text-muted-foreground">
                    {recommendation.reason}
                </div>
            )}
        </div>
    );
}
