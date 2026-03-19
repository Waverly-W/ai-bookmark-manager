import React from 'react';
import { TagEditor } from "@/components/ui/tag-editor";
import { useTranslation } from 'react-i18next';

interface SmartTagInputProps {
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
    suggestedTags?: string[];
    onAiGenerate?: () => void;
    isAiLoading?: boolean;
}

export function SmartTagInput({
    tags,
    onAddTag,
    onRemoveTag,
    suggestedTags = [],
    onAiGenerate,
    isAiLoading
}: SmartTagInputProps) {
    const { t } = useTranslation('popup');

    return (
        <TagEditor
            label={t('tags')}
            tags={tags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            suggestedTags={suggestedTags}
            onAiGenerate={onAiGenerate}
            isAiLoading={isAiLoading}
            placeholder={t('addTagsPlaceholder')}
            aiButtonLabel={t('autoTag')}
            suggestionMode="match"
        />
    );
}
