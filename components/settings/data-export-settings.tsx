import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { exportBookmarks, type ExportFormat } from '@/lib/exportUtils';
import { FileCode, FileJson, FileText, Download, Loader2 } from 'lucide-react';

interface ExportCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    loading?: boolean;
}

const ExportCard: React.FC<ExportCardProps> = ({ title, description, icon, onClick, loading }) => (
    <Card className="cursor-pointer hover:border-primary transition-colors" onClick={loading ? undefined : onClick}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                {title}
            </CardTitle>
            <div className="h-4 w-4 text-muted-foreground">
                {icon}
            </div>
        </CardHeader>
        <CardContent>
            <CardDescription className="mb-4 text-xs">
                {description}
            </CardDescription>
            <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={loading}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
            >
                {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                ) : (
                    <Download className="h-3 w-3 mr-2" />
                )}
                Export
            </Button>
        </CardContent>
    </Card>
);

export function DataExportSettings() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

    const handleExport = async (format: ExportFormat) => {
        setExportingFormat(format);
        try {
            await exportBookmarks({ format });
            toast({
                title: t('exportSuccess'),
                description: t('exportSuccessDesc', { format: format.toUpperCase() }),
            });
        } catch (error) {
            console.error('Export failed:', error);
            toast({
                title: t('exportFailed'),
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setExportingFormat(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2 pb-4 border-b border-border/50">
                <h3 className="font-semibold text-lg">{t('dataExport')}</h3>
                <p className="text-sm text-muted-foreground">{t('dataExportDescription')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* HTML 导出 */}
                <ExportCard
                    title="HTML"
                    description={t('exportHtmlDesc')}
                    icon={<FileCode />}
                    onClick={() => handleExport('html')}
                    loading={exportingFormat === 'html'}
                />

                {/* JSON 导出 */}
                <ExportCard
                    title="JSON"
                    description={t('exportJsonDesc')}
                    icon={<FileJson />}
                    onClick={() => handleExport('json')}
                    loading={exportingFormat === 'json'}
                />

                {/* Markdown 导出 */}
                <ExportCard
                    title="Markdown"
                    description={t('exportMarkdownDesc')}
                    icon={<FileText />}
                    onClick={() => handleExport('markdown')}
                    loading={exportingFormat === 'markdown'}
                />
            </div>
        </div>
    );
}
