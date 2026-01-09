import React, { useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onAiRegenerate?: () => void;
    isAiLoading?: boolean;
    className?: string;
    autoFocus?: boolean;
}

export function SmartInput({
    id,
    label,
    value,
    onChange,
    placeholder,
    onAiRegenerate,
    isAiLoading,
    className,
    autoFocus
}: SmartInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            // Small delay to ensure mount
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [autoFocus]);

    return (
        <div className={cn("space-y-1", className)}>
            <div className="flex items-center justify-between px-1">
                {/* MD3 Label Medium: font-medium, text-sm, tracking-wide */}
                <Label htmlFor={id} className="text-xs font-medium text-muted-foreground/90">
                    {label}
                </Label>
                {onAiRegenerate && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/10 -mr-1.5 gap-1 rounded-full"
                        onClick={onAiRegenerate}
                        disabled={isAiLoading || !value}
                    >
                        {isAiLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Sparkles className="w-3 h-3" />
                        )}
                        <span className="font-medium">AI Rename</span>
                    </Button>
                )}
            </div>

            <div className="relative group">
                <Input
                    ref={inputRef}
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="bg-secondary/40 border-transparent hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-transparent h-9 text-sm px-3 rounded-lg transition-all shadow-none placeholder:text-muted-foreground/40"
                    disabled={isAiLoading}
                />
            </div>
        </div>
    );
}
