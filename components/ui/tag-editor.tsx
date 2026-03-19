import React, { useMemo, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus, Sparkles, Search } from "lucide-react";

interface TagEditorProps {
    label: string;
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
    suggestedTags?: string[];
    onAiGenerate?: () => void;
    isAiLoading?: boolean;
    placeholder?: string;
    aiButtonLabel?: string;
    suggestionMode?: 'inline' | 'match';
}

export function TagEditor({
    label,
    tags,
    onAddTag,
    onRemoveTag,
    suggestedTags = [],
    onAiGenerate,
    isAiLoading = false,
    placeholder = "Add tags...",
    aiButtonLabel = "Auto Tag",
    suggestionMode = 'inline'
}: TagEditorProps) {
    const [input, setInput] = useState("");
    const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);

    const handleAddTag = (tag: string) => {
        const normalizedTag = tag.trim();
        if (!normalizedTag || tags.includes(normalizedTag)) {
            return;
        }

        onAddTag(normalizedTag);
        setInput("");
        setIsSuggestionOpen(false);
    };

    const normalizedSuggestions = useMemo(
        () => suggestedTags.filter((tag) => !tags.includes(tag)),
        [suggestedTags, tags]
    );

    const matchedSuggestions = useMemo(() => {
        const keyword = input.trim().toLowerCase();
        if (!keyword) {
            return [];
        }

        return normalizedSuggestions
            .filter((tag) => tag.toLowerCase().includes(keyword))
            .slice(0, 8);
    }, [input, normalizedSuggestions]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag(input);
            return;
        }

        if (e.key === 'Escape') {
            setIsSuggestionOpen(false);
        }
    };

    return (
        <div className="space-y-2 relative">
            <div className="flex items-center justify-between gap-2">
                <Label className="text-[13px] font-medium text-foreground/88">
                    {label}
                </Label>
                {onAiGenerate && (
                    <Button
                        variant="subtle"
                        size="sm"
                        onClick={onAiGenerate}
                        disabled={isAiLoading}
                        className="h-8 gap-1.5 px-3 text-[11px]"
                    >
                        <Sparkles className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">{aiButtonLabel}</span>
                    </Button>
                )}
            </div>

            <div className="flex min-h-[46px] flex-wrap content-start gap-1.5 rounded-[1rem] border border-transparent bg-surface-2 p-2 transition-colors hover:bg-surface-2/90">
                {tags.map((tag) => (
                    <Badge
                        key={tag}
                        variant="secondary"
                        className="h-7 gap-1 rounded-full border border-border/50 bg-background/88 px-2.5 text-[11px] font-medium text-foreground/90 shadow-sm hover:bg-background"
                    >
                        {tag}
                        <div
                            role="button"
                            onClick={() => onRemoveTag(tag)}
                            className="hover:text-destructive transition-colors cursor-pointer p-0.5 -mr-1"
                        >
                            <X className="w-2.5 h-2.5" />
                        </div>
                    </Badge>
                ))}

                <Input
                    value={input}
                    onChange={(e) => {
                        const nextValue = e.target.value;
                        setInput(nextValue);
                        if (suggestionMode === 'match') {
                            setIsSuggestionOpen(nextValue.trim().length > 0);
                        }
                    }}
                    onFocus={() => {
                        if (suggestionMode === 'match' && input.trim().length > 0 && matchedSuggestions.length > 0) {
                            setIsSuggestionOpen(true);
                        }
                    }}
                    onBlur={() => {
                        if (suggestionMode === 'match') {
                            setTimeout(() => setIsSuggestionOpen(false), 120);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length === 0 ? placeholder : ""}
                    variant="filled"
                    className="h-7 min-w-[90px] flex-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                />
            </div>

            {suggestionMode === 'inline' && normalizedSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {normalizedSuggestions.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => handleAddTag(tag)}
                            className="flex h-7 items-center gap-1 rounded-full border border-border/50 bg-transparent px-2.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-border/70 hover:bg-surface-2 hover:text-foreground"
                        >
                            <Plus className="w-3 h-3 opacity-70" />
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {suggestionMode === 'match' && isSuggestionOpen && matchedSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[1rem] border border-border/70 bg-popover p-2 shadow-md">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                        <Search className="h-3 w-3" />
                        <span>{label}</span>
                    </div>
                    <div className="mt-1 space-y-1">
                        {matchedSuggestions.map((tag) => (
                            <button
                                key={tag}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleAddTag(tag)}
                                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-secondary"
                            >
                                <span className="truncate">{tag}</span>
                                <Plus className="h-3 w-3 text-muted-foreground" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
