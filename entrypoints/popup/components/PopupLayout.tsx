import React, { ReactNode } from 'react';
import { cn } from "@/lib/utils";

interface PopupLayoutProps {
    children: ReactNode;
}

export function PopupLayout({ children }: PopupLayoutProps) {

    return (
        <div className={cn(
            "relative min-h-[100%] w-full max-w-full overflow-hidden text-foreground antialiased",
            "blueprint:font-mono"
        )}>
            <div className={cn(
                "panel-shell relative z-10 m-2 flex min-h-[calc(100%-1rem)] flex-col gap-3 p-3.5",
                "classic:surface-subtle blueprint:blueprint-panel blueprint:border-dashed"
            )}>
                {children}
            </div>
        </div>
    );
}
