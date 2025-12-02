import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { configSyncManager, SyncStatus } from '@/lib/configSyncManager';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export function SyncSettings() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
    const [rawSyncData, setRawSyncData] = useState<string>('');
    const [loadingData, setLoadingData] = useState(false);

    // 初始化和定期更新同步状态
    useEffect(() => {
        const updateStatus = async () => {
            try {
                const status = configSyncManager.getSyncStatus();
                setSyncStatus(status);
                setLastUpdateTime(new Date());
            } catch (error) {
                console.error('Failed to update sync status:', error);
            }
        };

        // 立即更新一次
        updateStatus();
        refreshRawData();

        // 每秒更新一次
        const interval = setInterval(updateStatus, 1000);

        // 监听同步变更
        const handleSyncChange = () => {
            updateStatus();
            refreshRawData();
        };

        configSyncManager.onSyncChange(handleSyncChange);

        return () => {
            clearInterval(interval);
            configSyncManager.offSyncChange(handleSyncChange);
        };
    }, []);

    // 刷新原始数据
    const refreshRawData = async () => {
        setLoadingData(true);
        try {
            const data = await configSyncManager.getRawSyncData();
            setRawSyncData(JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to get raw sync data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    // 手动同步
    const handleManualSync = async () => {
        setSyncing(true);
        try {
            await configSyncManager.manualSync();
            const status = configSyncManager.getSyncStatus();
            setSyncStatus(status);
            setLastUpdateTime(new Date());
            await refreshRawData();
            toast({
                title: t('syncSuccess'),
                description: t('syncSuccessDescription'),
            });
        } catch (error) {
            console.error('Manual sync failed:', error);
            const status = configSyncManager.getSyncStatus();
            setSyncStatus(status);
            toast({
                title: t('syncFailed'),
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: "destructive"
            });
        } finally {
            setSyncing(false);
        }
    };

    // 复制原始数据
    const handleCopyData = () => {
        navigator.clipboard.writeText(rawSyncData);
        toast({
            title: t('copied'),
            description: t('syncDataCopied'),
        });
    };

    // 格式化时间
    const formatTime = (timestamp: number | null): string => {
        if (!timestamp) {
            return t('never');
        }
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // 获取同步状态显示文本
    const getSyncStatusText = (): string => {
        if (!syncStatus) {
            return t('loading');
        }

        if (syncStatus.isSyncing) {
            return t('syncing');
        }

        if (syncStatus.lastError) {
            return t('syncFailed');
        }

        if (syncStatus.lastSyncTime) {
            return t('synced');
        }

        return t('notSynced');
    };

    // 获取同步状态图标
    const getSyncStatusIcon = () => {
        if (!syncStatus) {
            return <Loader2 className="h-4 w-4 animate-spin" />;
        }

        if (syncStatus.isSyncing) {
            return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        }

        if (syncStatus.lastError) {
            return <AlertCircle className="h-4 w-4 text-red-500" />;
        }

        if (syncStatus.lastSyncTime) {
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        }

        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    };

    return (
        <div className="space-y-6">
            {/* 标题和描述 */}
            <div className="space-y-2 pb-4 border-b border-border">
                <h3 className="font-semibold text-left text-lg">{t('syncSettings')}</h3>
                <p className="text-sm text-muted-foreground max-w-prose">{t('syncSettingsDescription')}</p>
            </div>

            {/* 同步状态卡片 */}
            <div className="space-y-4">
                <h4 className="font-medium text-sm">{t('syncStatus')}</h4>
                <div className="space-y-3 rounded-lg border border-border p-4">
                    {/* 状态指示器 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {getSyncStatusIcon()}
                            <span className="text-sm font-medium">{getSyncStatusText()}</span>
                        </div>
                        <Button
                            onClick={handleManualSync}
                            disabled={syncing || syncStatus?.isSyncing}
                            size="sm"
                            variant="outline"
                        >
                            {syncing || syncStatus?.isSyncing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('syncing')}...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    {t('manualSync')}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* 最后同步时间 */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('lastSyncTime')}:</span>
                        <span className="font-mono text-xs">
                            {formatTime(syncStatus?.lastSyncTime || null)}
                        </span>
                    </div>

                    {/* 错误提示 */}
                    {syncStatus?.lastError && (
                        <div className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                            <p className="font-medium">{t('syncError')}:</p>
                            <p className="mt-1 break-words">{syncStatus.lastError}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 原始数据查看器 */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{t('syncDataViewer')}</h4>
                    <div className="flex gap-2">
                        <Button
                            onClick={refreshRawData}
                            disabled={loadingData}
                            size="sm"
                            variant="ghost"
                            title={t('refresh')}
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            onClick={handleCopyData}
                            size="sm"
                            variant="ghost"
                            title={t('copy')}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="relative">
                    <Textarea
                        value={rawSyncData}
                        readOnly
                        className="font-mono text-xs h-64 bg-muted resize-y"
                    />
                </div>
                <p className="text-xs text-muted-foreground">
                    {t('syncDataViewerDescription')}
                </p>
            </div>
        </div>
    );
}
