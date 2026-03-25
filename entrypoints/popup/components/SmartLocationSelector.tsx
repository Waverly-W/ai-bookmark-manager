import { BookmarkFolder } from "@/lib/bookmarkUtils";
import { DrillDownFolderSelect } from "@/components/ui/drill-down-folder-select";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider.tsx";

interface SmartLocationSelectorProps {
    folders: BookmarkFolder[];
    selectedFolder: string;
    onSelect: (id: string) => void;
    onAiRecommend?: () => void;
    isAiLoading?: boolean;
}

export function SmartLocationSelector({
    folders,
    selectedFolder,
    onSelect,
    onAiRecommend,
    isAiLoading
}: SmartLocationSelectorProps) {
    const { t } = useTranslation('popup');
    const { themeId } = useTheme();

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label className={cn(
                    "text-[13px] font-medium text-foreground/88",
                    themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]"
                )}>
                    {t('location')}
                </Label>
                {onAiRecommend && (
                    <Button
                        variant="subtle"
                        size="sm"
                        onClick={onAiRecommend}
                        disabled={isAiLoading}
                        className={cn(
                            "h-8 gap-1.5 px-3 text-[11px]",
                            themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]"
                        )}
                    >
                        <Sparkles className={`h-3 w-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">{t('aiRecommend')}</span>
                    </Button>
                )}
            </div>

            <DrillDownFolderSelect
                folders={folders}
                selectedId={selectedFolder}
                onSelect={onSelect}
                placeholder={t('selectFolder')}
                className={cn(
                    "w-full justify-between rounded-[1rem] bg-surface-2 px-3.5 text-sm font-normal shadow-none",
                    themeId === 'blueprint' && "rounded-[var(--input-radius)]"
                )}
            />
        </div>
    );
}
