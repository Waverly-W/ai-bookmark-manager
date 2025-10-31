import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { AIConfig, saveAIConfig, getAIConfig, validateAIConfig } from "@/lib/aiConfigUtils";
import { testAIConnection } from "@/lib/aiService";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function AIConfigSettings() {
    const { t } = useTranslation();
    const { toast } = useToast();

    const [config, setConfig] = useState<AIConfig>({
        apiUrl: '',
        apiKey: '',
        modelId: ''
    });

    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    // 加载配置
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const savedConfig = await getAIConfig();
                setConfig(savedConfig);
            } catch (error) {
                console.error('Failed to load AI config:', error);
                toast({
                    title: t('error'),
                    description: t('failedToLoadAIConfig'),
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [t, toast]);

    // 处理输入变化
    const handleInputChange = (field: keyof AIConfig, value: string) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
        // 清除测试结果
        setTestResult(null);
    };

    // 测试连接
    const handleTestConnection = async () => {
        // 验证配置
        const validation = validateAIConfig(config);
        if (!validation.valid) {
            toast({
                title: t('connectionFailed'),
                description: validation.errors.map(e => t(e)).join(', '),
                variant: "destructive"
            });
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const result = await testAIConnection(config);
            setTestResult(result);

            if (result.success) {
                toast({
                    title: t('connectionSuccess'),
                    description: result.message,
                });
            } else {
                toast({
                    title: t('connectionFailed'),
                    description: result.error || result.message,
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Test connection error:', error);
            toast({
                title: t('connectionFailed'),
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: "destructive"
            });
        } finally {
            setTesting(false);
        }
    };

    // 保存配置
    const handleSaveConfig = async () => {
        // 验证配置
        const validation = validateAIConfig(config);
        if (!validation.valid) {
            toast({
                title: t('configSaveFailed'),
                description: validation.errors.map(e => t(e)).join(', '),
                variant: "destructive"
            });
            return;
        }

        setSaving(true);

        try {
            await saveAIConfig(config);
            toast({
                title: t('configSaved'),
                description: 'AI configuration has been saved successfully',
            });
        } catch (error) {
            console.error('Save config error:', error);
            toast({
                title: t('configSaveFailed'),
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: "destructive"
            });
        } finally {
            setSaving(false);
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
                <h3 className="font-semibold text-left text-lg">{t('aiConfig')}</h3>
                <p className="text-sm text-muted-foreground max-w-prose">{t('aiConfigDescription')}</p>
            </div>

            {/* API URL */}
            <div className="space-y-2">
                <Label htmlFor="apiUrl">{t('apiUrl')}</Label>
                <Input
                    id="apiUrl"
                    type="text"
                    placeholder={t('apiUrlPlaceholder')}
                    value={config.apiUrl}
                    onChange={(e) => handleInputChange('apiUrl', e.target.value)}
                />
            </div>

            {/* API Key */}
            <div className="space-y-2">
                <Label htmlFor="apiKey">{t('apiKey')}</Label>
                <Input
                    id="apiKey"
                    type="password"
                    placeholder={t('apiKeyPlaceholder')}
                    value={config.apiKey}
                    onChange={(e) => handleInputChange('apiKey', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    {t('apiKeySecureStorage')}
                </p>
            </div>

            {/* Model ID */}
            <div className="space-y-2">
                <Label htmlFor="modelId">{t('modelId')}</Label>
                <Input
                    id="modelId"
                    type="text"
                    placeholder={t('modelIdPlaceholder')}
                    value={config.modelId}
                    onChange={(e) => handleInputChange('modelId', e.target.value)}
                />
            </div>

            {/* 测试结果显示 */}
            {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-md ${testResult.success
                    ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                    }`}>
                    {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                    ) : (
                        <XCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm">{testResult.message}</span>
                </div>
            )}

            {/* 按钮组 */}
            <div className="flex gap-3">
                <Button
                    onClick={handleTestConnection}
                    disabled={testing || saving}
                    variant="outline"
                    className="flex-1"
                >
                    {testing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('testing')}
                        </>
                    ) : (
                        t('testConnection')
                    )}
                </Button>

                <Button
                    onClick={handleSaveConfig}
                    disabled={testing || saving}
                    className="flex-1"
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('saving')}...
                        </>
                    ) : (
                        t('saveConfig')
                    )}
                </Button>
            </div>
        </div>
    );
}
