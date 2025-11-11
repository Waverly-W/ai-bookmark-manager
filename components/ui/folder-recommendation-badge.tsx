import React from 'react';
import { Sparkles } from 'lucide-react';
import { FolderRecommendation } from '@/lib/folderRecommendation';

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
        if (confidence >= 0.8) return 'text-blue-600 bg-blue-50';
        if (confidence >= 0.5) return 'text-blue-500 bg-blue-50/70';
        return 'text-gray-500 bg-gray-50';
    };

    const confidenceColor = getConfidenceColor(recommendation.confidence);

    return (
        <div className={`flex items-start gap-2 ${className}`}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${confidenceColor}`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium">AI 推荐</span>
                {recommendation.confidence > 0 && (
                    <span className="text-xs opacity-75">
                        ({Math.round(recommendation.confidence * 100)}%)
                    </span>
                )}
            </div>
            
            {showReason && recommendation.reason && (
                <div className="flex-1 text-sm text-gray-600 py-1">
                    {recommendation.reason}
                </div>
            )}
        </div>
    );
}

