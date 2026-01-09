import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus, Sparkles, Tag as TagIcon } from "lucide-react";

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
    const [input, setInput] = useState("");

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.trim()) {
                onAddTag(input.trim());
                setInput("");
            }
        }
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-medium text-muted-foreground/90">
                    Tags
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
                        <span className="font-medium">Auto Tag</span>
                    </Button>
                )}
            </div>

            {/* Active Tags & Input Area */}
            <div className="bg-secondary/40 hover:bg-secondary/60 transition-colors rounded-lg p-2 min-h-[42px] flex flex-wrap content-start gap-1.5">
                {tags.map(tag => (
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
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length === 0 ? "Add tags..." : ""}
                    className="flex-1 min-w-[80px] border-0 bg-transparent focus-visible:ring-0 px-1 per-0 text-sm placeholder:text-muted-foreground/50 h-6"
                />
            </div>

            {/* AI Suggested Tags (Assist Chips) */}
            {suggestedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                    {/* <span className="text-[10px] text-muted-foreground/50 py-1">Suggestions:</span> */}
                    {suggestedTags.filter(t => !tags.includes(t)).map(tag => (
                        <button
                            key={tag}
                            onClick={() => onAddTag(tag)}
                            className="
                                flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium 
                                border border-border/40 bg-transparent text-muted-foreground 
                                hover:bg-secondary/50 hover:text-foreground hover:border-border/60 transition-all
                            "
                        >
                            <Plus className="w-3 h-3 opacity-70" />
                            {tag}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
