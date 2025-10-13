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

interface BookmarkDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookmark: BookmarkCardItem | null;
    onConfirm: () => void;
    isDeleting?: boolean;
}

export const BookmarkDeleteDialog: React.FC<BookmarkDeleteDialogProps> = ({
    open,
    onOpenChange,
    bookmark,
    onConfirm,
    isDeleting = false
}) => {
    const { t } = useTranslation();

    if (!bookmark) return null;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteBookmark')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('deleteBookmarkConfirm')}
                        <br />
                        <strong>"{bookmark.title}"</strong>
                        <br />
                        <span className="text-xs text-muted-foreground">
                            {t('deleteBookmarkDescription')}
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
