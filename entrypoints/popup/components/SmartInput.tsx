import React, { useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('popup');

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            // Small delay to ensure mount
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [autoFocus]);

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id} className="text-[13px] font-medium text-foreground/88">
                    {label}
                </Label>
                {onAiRegenerate && (
                    <Button
                        variant="subtle"
                        size="sm"
                        className="h-8 gap-1.5 px-3 text-[11px]"
                        onClick={onAiRegenerate}
                        disabled={isAiLoading || !value}
                    >
                        {isAiLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Sparkles className="h-3 w-3" />
                        )}
                        <span className="font-medium">{t('aiRefine')}</span>
                    </Button>
                )}
            </div>
            <Input
                ref={inputRef}
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                variant="filled"
                size="default"
                className="h-11 rounded-[1rem] border-transparent bg-surface-2 px-3.5 text-sm shadow-none placeholder:text-muted-foreground/55 focus-visible:border-border/80 focus-visible:ring-primary/25"
            />
        </div>
    );
}
