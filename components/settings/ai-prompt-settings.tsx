import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
    getCurrentPrompt,
    saveCustomPrompt,
    restoreDefaultPrompt,
    isUsingCustomPrompt,
    getDefaultPrompt,
    validatePrompt
} from "@/lib/aiPromptUtils";
import { Loader2, RotateCcw, Save, Info } from "lucide-react";

import { bookmarkRenameScenario } from "@/lib/ai/scenarios/bookmarkRename";

export function AIPromptSettings() {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [isCustom, setIsCustom] = useState(false);

    // 加载当前Prompt
    useEffect(() => {
        const loadPrompt = async () => {
            try {
                const currentPrompt = await getCurrentPrompt(i18n.language);
                const usingCustom = await isUsingCustomPrompt();
                setPrompt(currentPrompt);
                setIsCustom(usingCustom);
            } catch (error) {
                console.error('Failed to load prompt:', error);
                toast({
                    title: t('error'),
                    description: 'Failed to load prompt template',
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        loadPrompt();
    }, [i18n.language, t, toast]);

    // 处理Prompt变化
    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
    };

    // 保存自定义Prompt
    const handleSavePrompt = async () => {
        // 验证Prompt
        const validation = validatePrompt(prompt);
        if (!validation.valid) {
            toast({
                title: 'Invalid Prompt',
                description: validation.errors.join(', '),
                variant: "destructive"
            });
            return;
        }

        setSaving(true);

        try {
            await saveCustomPrompt(prompt);
            setIsCustom(true);
            toast({
                title: t('templateSaved'),
                description: 'Your custom prompt template has been saved',
            });
        } catch (error) {
            console.error('Save prompt error:', error);
            toast({
                title: 'Save Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    // 恢复默认Prompt
    const handleRestoreDefault = async () => {
        setRestoring(true);

        try {
            await restoreDefaultPrompt();
            const defaultPrompt = getDefaultPrompt(i18n.language);
            setPrompt(defaultPrompt);
            setIsCustom(false);
            toast({
                title: t('templateRestored'),
                description: 'Default prompt template has been restored',
            });
        } catch (error) {
            console.error('Restore default error:', error);
            toast({
                title: 'Restore Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: "destructive"
            });
        } finally {
            setRestoring(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 标题和描述 */}
            <div className="space-y-2 pb-4 border-b border-border/50">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-left text-lg">{t('aiPromptSettings')}</h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {isCustom ? t('usingCustomTemplate') : t('usingDefaultTemplate')}
                    </span>
                </div>
                <p className="text-sm text-muted-foreground max-w-prose">{t('aiPromptDescription')}</p>
            </div>

            {/* System Prompt (Read-only) */}
            <div className="space-y-2">
                <Label className="text-muted-foreground">{t('systemPrompt')}</Label>
                <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {bookmarkRenameScenario.getSystemPrompt(i18n.language)}
                </div>
                <p className="text-xs text-muted-foreground">
                    {t('systemPromptDescription')}
                </p>
            </div>

            {/* User Prompt (Editable) */}
            <div className="space-y-2">
                <Label htmlFor="promptTemplate">{t('userPrompt')}</Label>
                <textarea
                    id="promptTemplate"
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y font-mono"
                    placeholder={t('promptPlaceholder')}
                    value={prompt}
                    onChange={handlePromptChange}
                />
            </div>

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                    {t('userPromptDescription')}
                </p>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-3">
                <Button
                    onClick={handleRestoreDefault}
                    disabled={saving || restoring || !isCustom}
                    variant="outline"
                    className="flex-1"
                >
                    {restoring ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Restoring...
                        </>
                    ) : (
                        <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {t('restoreDefault')}
                        </>
                    )}
                </Button>

                <Button
                    onClick={handleSavePrompt}
                    disabled={saving || restoring}
                    className="flex-1"
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('saving')}...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            {t('saveTemplate')}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
