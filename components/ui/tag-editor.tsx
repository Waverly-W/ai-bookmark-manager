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
            return normalizedSuggestions.slice(0, 8);
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
        <div className="space-y-1 relative">
            <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-medium text-muted-foreground/90">
                    {label}
                </Label>
                {onAiGenerate && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAiGenerate}
                        disabled={isAiLoading}
                        className="h-5 px-1.5 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/10 -mr-1.5 gap-1 rounded-full"
                    >
                        <Sparkles className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">{aiButtonLabel}</span>
                    </Button>
                )}
            </div>

            <div className="bg-secondary/40 hover:bg-secondary/60 transition-colors rounded-lg p-2 min-h-[42px] flex flex-wrap content-start gap-1.5">
                {tags.map((tag) => (
                    <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-background/80 backdrop-blur-sm border border-border/20 text-foreground/90 hover:bg-background font-medium h-6 px-2 gap-1 rounded-md shadow-sm text-[11px]"
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
                        if (suggestionMode === 'match' && matchedSuggestions.length > 0) {
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
                    className="flex-1 min-w-[80px] border-0 bg-transparent focus-visible:ring-0 px-1 py-0 text-sm placeholder:text-muted-foreground/50 h-6"
                />
            </div>

            {suggestionMode === 'inline' && normalizedSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                    {normalizedSuggestions.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => handleAddTag(tag)}
                            className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium border border-border/40 bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:border-border/60 transition-all"
                        >
                            <Plus className="w-3 h-3 opacity-70" />
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {suggestionMode === 'match' && isSuggestionOpen && matchedSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border bg-popover p-2 shadow-lg">
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
