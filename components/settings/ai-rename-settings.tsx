import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getAIRenameConfig, saveAIRenameConfig, AIRenameConfig } from '@/lib/aiRenameConfig';
import { useTranslation } from 'react-i18next';

export function AIRenameSettings() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [config, setConfig] = useState<AIRenameConfig>({
        useReferenceNaming: true
    });
    const [loading, setLoading] = useState(true);

    // 加载配置
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const savedConfig = await getAIRenameConfig();
                setConfig(savedConfig);
            } catch (error) {
                console.error('Failed to load AI rename config:', error);
                toast({
                    title: t('error'),
                    description: t('failedToLoadConfig'),
                    variant: 'destructive'
                });
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [toast, t]);

    // 处理配置变更
    const handleConfigChange = async (key: keyof AIRenameConfig, value: boolean) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);

        try {
            await saveAIRenameConfig(newConfig);
            toast({
                title: t('success'),
                description: t('configSaved')
            });
        } catch (error) {
            console.error('Failed to save AI rename config:', error);
            toast({
                title: t('error'),
                description: t('failedToSaveConfig'),
                variant: 'destructive'
            });
        }
    };

    if (loading) {
        return <div className="text-sm text-muted-foreground">{t('loading')}...</div>;
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">{t('aiRenameSettings')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('aiRenameSettingsDescription')}
                </p>
            </div>

            <div className="space-y-4">
                {/* 参考文件夹命名格式 */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="useReferenceNaming">{t('useReferenceNaming')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('useReferenceNamingDescription')}
                        </p>
                    </div>
                    <Switch
                        id="useReferenceNaming"
                        checked={config.useReferenceNaming}
                        onCheckedChange={(checked) => handleConfigChange('useReferenceNaming', checked)}
                    />
                </div>
            </div>
        </div>
    );
}

