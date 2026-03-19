import React, { ReactNode } from 'react';

interface PopupLayoutProps {
    children: ReactNode;
}

export function PopupLayout({ children }: PopupLayoutProps) {
    return (
        <div className="relative min-h-[100%] w-full max-w-full overflow-hidden text-foreground antialiased">
            <div className="relative z-10 m-2 flex min-h-[calc(100%-1rem)] flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-card/96 p-3.5 shadow-panel backdrop-blur-xl">
                {children}
            </div>
        </div>
    );
}
