import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookmarkCardItem } from '@/components/ui/bookmark-card';

interface FolderDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: BookmarkCardItem | null;
    onConfirm: () => void;
    isDeleting?: boolean;
}

export const FolderDeleteDialog: React.FC<FolderDeleteDialogProps> = ({
    open,
    onOpenChange,
    folder,
    onConfirm,
    isDeleting = false
}) => {
    const { t } = useTranslation('common');

    if (!folder) return null;

    const childrenCount = folder.children?.length || 0;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteFolder')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('deleteFolderConfirm')}
                        <br />
                        <strong>"{folder.title}"</strong>
                        <br />
                        {childrenCount > 0 && (
                            <>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    {t('folderContains')} {childrenCount} {t('itemsText')}
                                </span>
                                <br />
                            </>
                        )}
                        <span className="text-xs text-muted-foreground">
                            {t('deleteFolderDescription')}
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                        {t('cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? t('processing') + '...' : t('delete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
