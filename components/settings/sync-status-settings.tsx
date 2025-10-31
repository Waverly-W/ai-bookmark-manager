import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { configSyncManager, SyncStatus } from '@/lib/configSyncManager';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function SyncStatusSettings() {
    const { t } = useTranslation();
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

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

        // 每秒更新一次
        const interval = setInterval(updateStatus, 1000);

        // 监听同步变更
        const handleSyncChange = () => {
            updateStatus();
        };

        configSyncManager.onSyncChange(handleSyncChange);

        return () => {
            clearInterval(interval);
            configSyncManager.offSyncChange(handleSyncChange);
        };
    }, []);

    // 手动同步
    const handleManualSync = async () => {
        setSyncing(true);
        try {
            await configSyncManager.manualSync();
            const status = configSyncManager.getSyncStatus();
            setSyncStatus(status);
            setLastUpdateTime(new Date());
        } catch (error) {
            console.error('Manual sync failed:', error);
            const status = configSyncManager.getSyncStatus();
            setSyncStatus(status);
        } finally {
            setSyncing(false);
        }
    };

    // 格式化时间
    const formatTime = (timestamp: number | null): string => {
        if (!timestamp) {
            return t('never') || 'Never';
        }
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // 获取同步状态显示文本
    const getSyncStatusText = (): string => {
        if (!syncStatus) {
            return t('loading') || 'Loading...';
        }

        if (syncStatus.isSyncing) {
            return t('syncing') || 'Syncing...';
        }

        if (syncStatus.lastError) {
            return t('syncFailed') || 'Sync Failed';
        }

        if (syncStatus.lastSyncTime) {
            return t('synced') || 'Synced';
        }

        return t('notSynced') || 'Not Synced';
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
        <div className="space-y-4">
            {/* 标题和描述 */}
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('syncStatus') || 'Sync Status'}</h4>
                <p className="text-xs text-muted-foreground">
                    {t('syncStatusDescription') || 'Manage configuration synchronization across devices'}
                </p>
            </div>

            {/* 同步状态显示 */}
            <div className="space-y-3 rounded-lg border border-border/50 p-3">
                {/* 状态指示器 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getSyncStatusIcon()}
                        <span className="text-sm font-medium">{getSyncStatusText()}</span>
                    </div>
                </div>

                {/* 最后同步时间 */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('lastSyncTime') || 'Last Sync'}:</span>
                    <span className="font-mono text-xs">
                        {formatTime(syncStatus?.lastSyncTime || null)}
                    </span>
                </div>

                {/* 待同步变更数 */}
                {syncStatus && syncStatus.pendingChanges > 0 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('pendingChanges') || 'Pending Changes'}:</span>
                        <span className="font-mono text-xs">{syncStatus.pendingChanges}</span>
                    </div>
                )}

                {/* 错误提示 */}
                {syncStatus?.lastError && (
                    <div className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        <p className="font-medium">{t('syncError') || 'Sync Error'}:</p>
                        <p className="mt-1 break-words">{syncStatus.lastError}</p>
                    </div>
                )}
            </div>

            {/* 手动同步按钮 */}
            <Button
                onClick={handleManualSync}
                disabled={syncing || syncStatus?.isSyncing}
                className="w-full"
                variant="outline"
            >
                {syncing || syncStatus?.isSyncing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('syncing') || 'Syncing...'}
                    </>
                ) : (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t('manualSync') || 'Manual Sync'}
                    </>
                )}
            </Button>

            {/* 信息提示 */}
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <p>
                    {t('syncInfo') || 'Your configuration will automatically sync across all devices logged in with the same Google account.'}
                </p>
            </div>
        </div>
    );
}

