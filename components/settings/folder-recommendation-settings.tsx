import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
    FolderRecommendationConfig,
    getFolderRecommendationConfig,
    saveFolderRecommendationConfig,
    resetFolderRecommendationConfig
} from "@/lib/folderRecommendationConfig";
import {
    getCurrentFolderRecommendationPrompt,
    saveCustomFolderRecommendationPrompt,
    restoreDefaultFolderRecommendationPrompt
} from "@/lib/aiPromptUtils";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";

export function FolderRecommendationSettings() {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    const [config, setConfig] = useState<FolderRecommendationConfig>({
        enabled: true,
        showReason: true,
        autoApply: true,
        fallbackToDefault: true,
        timeoutMs: 10000
    });

    const [customPrompt, setCustomPrompt] = useState('');
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [hasCustomPrompt, setHasCustomPrompt] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingPrompt, setSavingPrompt] = useState(false);

    // 加载配置
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const savedConfig = await getFolderRecommendationConfig();
                setConfig(savedConfig);

                // 加载 Prompt
                const locale = i18n.language || 'zh_CN';
                const prompt = await getCurrentFolderRecommendationPrompt(locale, savedConfig.showReason);
                setCustomPrompt(prompt);

                // 检查是否有自定义 Prompt（简单判断：如果不是默认的开头，就认为是自定义的）
                const isCustom = !prompt.startsWith('你是一个专业的书签管理助手') &&
                    !prompt.startsWith('You are a professional bookmark management assistant');
                setHasCustomPrompt(isCustom);
            } catch (error) {
                console.error('Failed to load folder recommendation config:', error);
                toast({
                    title: t('error'),
                    description: t('failedToLoadRecommendationConfig'),
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [i18n.language, t, toast]);

    // 处理配置变化
    const handleConfigChange = (field: keyof FolderRecommendationConfig, value: boolean | number) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // 保存配置
    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await saveFolderRecommendationConfig(config);
            toast({
                title: t('configSaved'),
                description: t('recommendationConfigSaved'),
            });
        } catch (error) {
            console.error('Failed to save folder recommendation config:', error);
            toast({
                title: t('saveFailed'),
                description: t('failedToSaveRecommendationConfig'),
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    // 重置配置
    const handleResetConfig = async () => {
        try {
            const defaultConfig = await resetFolderRecommendationConfig();
            setConfig(defaultConfig);
            toast({
                title: t('configReset'),
                description: t('recommendationConfigReset'),
            });
        } catch (error) {
            console.error('Failed to reset folder recommendation config:', error);
            toast({
                title: t('error'),
                description: t('failedToResetRecommendationConfig'),
                variant: "destructive"
            });
        }
    };

    // 保存自定义 Prompt
    const handleSavePrompt = async () => {
        setSavingPrompt(true);
        try {
            await saveCustomFolderRecommendationPrompt(customPrompt);
            setHasCustomPrompt(true);
            setIsEditingPrompt(false);
            toast({
                title: t('templateSaved'),
                description: t('recommendationPromptSaved'),
            });
        } catch (error) {
            console.error('Failed to save custom prompt:', error);
            toast({
                title: t('saveFailed'),
                description: t('failedToSavePrompt'),
                variant: "destructive"
            });
        } finally {
            setSavingPrompt(false);
        }
    };

    // 恢复默认 Prompt
    const handleRestoreDefaultPrompt = async () => {
        try {
            await restoreDefaultFolderRecommendationPrompt();
            const locale = i18n.language || 'zh_CN';
            const defaultPrompt = await getCurrentFolderRecommendationPrompt(locale, config.showReason);
            setCustomPrompt(defaultPrompt);
            setHasCustomPrompt(false);
            setIsEditingPrompt(false);
            toast({
                title: t('templateRestored'),
                description: t('recommendationPromptRestored'),
            });
        } catch (error) {
            console.error('Failed to restore default prompt:', error);
            toast({
                title: t('error'),
                description: t('failedToRestorePrompt'),
                variant: "destructive"
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div className="space-y-2 pb-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    <h2 className="text-xl font-semibold">{t('folderRecommendationSettings')}</h2>
                </div>
                <p className="text-sm text-muted-foreground max-w-prose">
                    {t('folderRecommendationDescription')}
                </p>
            </div>

            {/* 基本配置 */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('basicSettings')}</h3>

                {/* 启用推荐 */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="enabled">{t('enableRecommendation')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('enableRecommendationDescription')}
                        </p>
                    </div>
                    <Switch
                        id="enabled"
                        checked={config.enabled}
                        onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                    />
                </div>

                {/* 显示推荐理由 */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="showReason">{t('showRecommendationReason')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('showRecommendationReasonDescription')}
                        </p>
                    </div>
                    <Switch
                        id="showReason"
                        checked={config.showReason}
                        onCheckedChange={(checked) => handleConfigChange('showReason', checked)}
                        disabled={!config.enabled}
                    />
                </div>

                {/* 自动应用推荐 */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="autoApply">{t('autoApplyRecommendation')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('autoApplyRecommendationDescription')}
                        </p>
                    </div>
                    <Switch
                        id="autoApply"
                        checked={config.autoApply}
                        onCheckedChange={(checked) => handleConfigChange('autoApply', checked)}
                        disabled={!config.enabled}
                    />
                </div>

                {/* 降级到默认文件夹 */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="fallbackToDefault">{t('fallbackToDefault')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('fallbackToDefaultDescription')}
                        </p>
                    </div>
                    <Switch
                        id="fallbackToDefault"
                        checked={config.fallbackToDefault}
                        onCheckedChange={(checked) => handleConfigChange('fallbackToDefault', checked)}
                        disabled={!config.enabled}
                    />
                </div>

                {/* 最大推荐数量 */}
                <div className="space-y-2">
                    <Label htmlFor="maxRecommendations">{t('maxRecommendations')}</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="maxRecommendations"
                            type="number"
                            min="1"
                            max="10"
                            step="1"
                            value={config.maxRecommendations}
                            onChange={(e) => handleConfigChange('maxRecommendations', parseInt(e.target.value) || 3)}
                            disabled={!config.enabled}
                            className="max-w-xs"
                        />
                        <span className="text-sm text-muted-foreground">{t('recommendations')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('maxRecommendationsDescription')}
                    </p>
                </div>

                {/* 超时时间 */}
                <div className="space-y-2">
                    <Label htmlFor="timeoutMs">{t('recommendationTimeout')}</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="timeoutMs"
                            type="number"
                            min="1000"
                            max="60000"
                            step="1000"
                            value={config.timeoutMs}
                            onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 10000)}
                            disabled={!config.enabled}
                            className="max-w-xs"
                        />
                        <span className="text-sm text-muted-foreground">{t('milliseconds')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('recommendationTimeoutDescription')}
                    </p>
                </div>
            </div>

            {/* 保存和重置按钮 */}
            <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving || !config.enabled}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('saveConfig')}
                </Button>
                <Button variant="outline" onClick={handleResetConfig}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t('resetToDefault')}
                </Button>
            </div>

            {/* Prompt 配置 */}
            <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <h3 className="text-sm font-medium">{t('recommendationPromptSettings')}</h3>
                        <p className="text-sm text-muted-foreground">
                            {hasCustomPrompt ? t('usingCustomTemplate') : t('usingDefaultTemplate')}
                        </p>
                    </div>
                    {!isEditingPrompt && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingPrompt(true)}
                            disabled={!config.enabled}
                        >
                            {t('edit')}
                        </Button>
                    )}
                </div>

                {isEditingPrompt && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="customPrompt">{t('promptTemplate')}</Label>
                            <Textarea
                                id="customPrompt"
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                rows={8}
                                className="font-mono text-sm"
                                placeholder={t('promptPlaceholder')}
                            />
                            <p className="text-sm text-muted-foreground">
                                {t('recommendationPromptHint')}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleSavePrompt} disabled={savingPrompt}>
                                {savingPrompt && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {t('saveTemplate')}
                            </Button>
                            <Button variant="outline" onClick={handleRestoreDefaultPrompt}>
                                {t('restoreDefault')}
                            </Button>
                            <Button variant="ghost" onClick={() => setIsEditingPrompt(false)}>
                                {t('cancel')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

