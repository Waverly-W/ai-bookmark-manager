import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AI_PRESETS, applyPreset, type AIPreset } from '@/lib/ai-presets';
import { AIConfig, saveAIConfig } from '@/lib/aiConfigUtils';
import { testAIConnection } from '@/lib/aiService';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface AIConfigWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete?: () => void;
}

export const AIConfigWizard: React.FC<AIConfigWizardProps> = ({
    open,
    onOpenChange,
    onComplete,
}) => {
    const { t } = useTranslation();
    const { toast } = useToast();

    // 向导状态
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [config, setConfig] = useState<AIConfig>({
        apiUrl: '',
        apiKey: '',
        modelId: ''
    });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    // 重置向导状态
    const resetWizard = () => {
        setCurrentStep(1);
        setSelectedPreset(null);
        setConfig({ apiUrl: '', apiKey: '', modelId: '' });
        setTestResult(null);
    };

    // 处理预设选择
    const handlePresetSelect = (presetId: string) => {
        setSelectedPreset(presetId);

        if (presetId === 'custom') {
            // 自定义配置，清空预填
            setConfig({ apiUrl: '', apiKey: '', modelId: '' });
        } else {
            // 应用预设配置
            const preset = AI_PRESETS.find(p => p.id === presetId);
            if (preset) {
                setConfig({
                    apiUrl: preset.config.apiUrl,
                    apiKey: config.apiKey, // 保留已输入的API Key
                    modelId: preset.config.modelId
                });
            }
        }
    };

    // 测试连接
    const handleTestConnection = async () => {
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
                    variant: 'destructive'
                });
            }
        } catch (error) {
            console.error('Test connection error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setTestResult({
                success: false,
                message: errorMessage
            });
            toast({
                title: t('connectionFailed'),
                description: errorMessage,
                variant: 'destructive'
            });
        } finally {
            setTesting(false);
        }
    };

    // 完成向导
    const handleFinish = async () => {
        try {
            await saveAIConfig(config);
            toast({
                title: t('wizardComplete'),
                description: t('wizardCompleteDesc'),
            });
            resetWizard();
            onOpenChange(false);
            onComplete?.();
        } catch (error) {
            console.error('Save config error:', error);
            toast({
                title: t('configSaveFailed'),
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive'
            });
        }
    };

    // 步骤验证
    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return selectedPreset !== null;
            case 2:
                return config.apiKey.trim() !== '' &&
                    config.apiUrl.trim() !== '' &&
                    config.modelId.trim() !== '';
            case 3:
                return testResult?.success === true;
            default:
                return false;
        }
    };

    // 获取当前选中的预设
    const getCurrentPreset = (): AIPreset | null => {
        if (!selectedPreset || selectedPreset === 'custom') return null;
        return AI_PRESETS.find(p => p.id === selectedPreset) || null;
    };

    // 渲染步骤指示器
    const renderStepIndicator = () => {
        return (
            <div className="flex items-center justify-center mb-8">
                {[1, 2, 3].map((step, index) => (
                    <React.Fragment key={step}>
                        <div
                            className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold
                transition-colors
                ${step === currentStep
                                    ? 'bg-primary text-primary-foreground'
                                    : step < currentStep
                                        ? 'bg-green-500 text-white'
                                        : 'bg-muted text-muted-foreground'}
              `}
                        >
                            {step < currentStep ? '✓' : step}
                        </div>
                        {index < 2 && (
                            <div
                                className={`w-16 h-1 mx-2 transition-colors ${step < currentStep ? 'bg-green-500' : 'bg-muted'
                                    }`}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    // 渲染步骤1: 选择服务商
    const renderStep1 = () => {
        const allOptions = [
            ...AI_PRESETS,
            {
                id: 'custom',
                name: t('customConfig'),
                description: t('customConfigDesc'),
                icon: '⚙️',
                config: { apiUrl: '', modelId: '' },
                helpUrl: ''
            }
        ];

        return (
            <div className="space-y-6">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">{t('selectAIProvider')}</h3>
                    <p className="text-sm text-muted-foreground">{t('chooseProvider')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allOptions.map((option) => (
                        <Card
                            key={option.id}
                            className={`cursor-pointer transition-all hover:border-primary ${selectedPreset === option.id
                                ? 'border-primary ring-2 ring-primary ring-opacity-50'
                                : ''
                                }`}
                            onClick={() => handlePresetSelect(option.id)}
                        >
                            <CardContent className="p-6 text-center">
                                <div className="text-4xl mb-3">{option.icon}</div>
                                <h4 className="font-semibold mb-2">{option.name}</h4>
                                <p className="text-sm text-muted-foreground">{option.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };

    // 渲染步骤2: 输入凭证
    const renderStep2 = () => {
        const preset = getCurrentPreset();

        return (
            <div className="space-y-6">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">{t('enterAPIKey')}</h3>
                    {preset && (
                        <p className="text-sm text-muted-foreground">
                            {preset.name}
                        </p>
                    )}
                </div>

                <div className="space-y-4">
                    {/* API Key */}
                    <div className="space-y-2">
                        <Label htmlFor="wizard-apiKey">{t('apiKey')}</Label>
                        <Input
                            id="wizard-apiKey"
                            type="password"
                            placeholder={t('apiKeyPlaceholder')}
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            className="rounded-full border-0 bg-secondary/10 focus-visible:bg-secondary/20 h-12"
                        />
                        {preset && (
                            <div className="flex items-center gap-2 text-sm">
                                <a
                                    href={preset.helpUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                >
                                    {t('getAPIKeyHelp')}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                                {preset.docsUrl && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <a
                                            href={preset.docsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1"
                                        >
                                            {t('viewDocs')}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 自定义配置时显示的额外字段 */}
                    {selectedPreset === 'custom' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="wizard-apiUrl">{t('apiUrl')}</Label>
                                <Input
                                    id="wizard-apiUrl"
                                    type="text"
                                    placeholder={t('apiUrlPlaceholder')}
                                    value={config.apiUrl}
                                    onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                                    className="rounded-full border-0 bg-secondary/10 focus-visible:bg-secondary/20 h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="wizard-modelId">{t('modelId')}</Label>
                                <Input
                                    id="wizard-modelId"
                                    type="text"
                                    placeholder={t('modelIdPlaceholder')}
                                    value={config.modelId}
                                    onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
                                    className="rounded-full border-0 bg-secondary/10 focus-visible:bg-secondary/20 h-12"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // 渲染步骤3: 测试连接
    const renderStep3 = () => {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">{t('testAndFinish')}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t('testConnection')} {t('aiConfig').toLowerCase()}
                    </p>
                </div>

                {/* 配置摘要 */}
                <Card>
                    <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('apiUrl')}:</span>
                            <span className="font-mono text-xs">{config.apiUrl}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('modelId')}:</span>
                            <span className="font-mono text-xs">{config.modelId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('apiKey')}:</span>
                            <span className="font-mono text-xs">••••••••</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 测试结果 */}
                {testResult && (
                    <div
                        className={`flex items-center gap-2 p-4 rounded-md ${testResult.success
                            ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                            }`}
                    >
                        {testResult.success ? (
                            <CheckCircle2 className="h-5 w-5" />
                        ) : (
                            <XCircle className="h-5 w-5" />
                        )}
                        <span className="text-sm">{testResult.message}</span>
                    </div>
                )}

                {/* 测试按钮 */}
                {!testResult?.success && (
                    <Button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="w-full"
                        variant="outline"
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
                )}
            </div>
        );
    };

    // 渲染当前步骤内容
    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return renderStep1();
            case 2:
                return renderStep2();
            case 3:
                return renderStep3();
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-center">
                        {t('aiConfigWizard')}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {t('step')} {currentStep} / 3
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    {renderStepIndicator()}
                    {renderStepContent()}
                </div>

                {/* 导航按钮 */}
                <div className="flex justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (currentStep === 1) {
                                onOpenChange(false);
                                resetWizard();
                            } else {
                                setCurrentStep(currentStep - 1);
                                setTestResult(null);
                            }
                        }}
                    >
                        {currentStep === 1 ? t('skipWizard') : t('previous')}
                    </Button>

                    <Button
                        onClick={() => {
                            if (currentStep === 3) {
                                handleFinish();
                            } else {
                                setCurrentStep(currentStep + 1);
                            }
                        }}
                        disabled={!canProceed()}
                    >
                        {currentStep === 3 ? t('finish') : t('next')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
