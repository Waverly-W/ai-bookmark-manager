import React, { ReactNode } from 'react';

interface PopupLayoutProps {
    children: ReactNode;
}

export function PopupLayout({ children }: PopupLayoutProps) {
    return (
        <div className="w-[320px] h-auto min-h-[fit-content] bg-background text-foreground font-sans antialiased overflow-hidden flex flex-col relative tracking-normal">
            {/* MD3 Surface Container Low as subtle background tint if desired, but sticking to clean background for now */}

            {/* Content Container */}
            <div className="relative z-10 flex flex-col h-full p-3 gap-2.5">
                {children}
            </div>
        </div>
    );
}
