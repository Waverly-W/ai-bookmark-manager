import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { getShortcutDisplay, type ShortcutConfig } from '@/hooks/useKeyboardShortcuts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface KeyboardShortcutsHelpProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ShortcutCategory {
    title: string;
    shortcuts: ShortcutConfig[];
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
    open,
    onOpenChange,
}) => {
    const { t } = useTranslation();

    // 定义各个分类的快捷键
    const categories: ShortcutCategory[] = [
        {
            title: t('bookmarksShortcuts'),
            shortcuts: [
                {
                    key: '/',
                    description: t('focusSearch'),
                    handler: () => { },
                },
                {
                    key: 'Escape',
                    description: t('clearSearch'),
                    handler: () => { },
                },
                {
                    key: '?',
                    description: t('showShortcuts'),
                    handler: () => { },
                },
            ],
        },
        {
            title: t('batchRenameShortcuts'),
            shortcuts: [
                {
                    key: 'Enter',
                    ctrl: true,
                    meta: true,
                    description: t('applyAllChanges'),
                    handler: () => { },
                },
            ],
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{t('keyboardShortcuts')}</DialogTitle>
                    <DialogDescription>
                        {t('bookmarks')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {categories.map((category, index) => (
                        <div key={index}>
                            <h3 className="text-lg font-semibold mb-3">{category.title}</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">{t('shortcutKey')}</TableHead>
                                        <TableHead>{t('shortcutDescription')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {category.shortcuts.map((shortcut, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                <kbd className="px-2 py-1.5 text-sm font-semibold text-foreground bg-muted border border-border rounded">
                                                    {getShortcutDisplay(shortcut)}
                                                </kbd>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {shortcut.description}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground text-center">
                    {t('hideShortcuts')}: <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">Esc</kbd> {t('or')} <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">?</kbd>
                </div>
            </DialogContent>
        </Dialog>
    );
};
