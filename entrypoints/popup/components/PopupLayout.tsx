import React, { ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider.tsx";

interface PopupLayoutProps {
    children: ReactNode;
}

export function PopupLayout({ children }: PopupLayoutProps) {
    const { themeId } = useTheme();

    return (
        <div className={cn(
            "relative min-h-[100%] w-full max-w-full overflow-hidden text-foreground antialiased",
            themeId === 'blueprint' && "font-mono"
        )}>
            <div className={cn(
                "relative z-10 m-2 flex min-h-[calc(100%-1rem)] flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-card/96 p-3.5 shadow-panel backdrop-blur-xl",
                themeId === 'blueprint' && "rounded-[var(--card-radius)] border-dashed"
            )}>
                {children}
            </div>
        </div>
    );
}
