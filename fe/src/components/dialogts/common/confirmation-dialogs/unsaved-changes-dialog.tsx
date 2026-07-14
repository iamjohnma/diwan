import { WarningCircleIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { DialogWrapper } from '@/components/dialogts/common/dialog-wrapper/dialog-wrapper';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function UnsavedChangesDialog(props: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  return (
    <DialogWrapper
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          props.onStay();
        }
      }}
      title={t('common.dialog.unsavedChanges.title')}
      description={t('common.dialog.unsavedChanges.description')}
      icon={WarningCircleIcon}
      cancelLabel={t('common.dialog.unsavedChanges.stayButton')}
      confirmLabel={t('common.dialog.unsavedChanges.leaveButton')}
      confirmVariant="destructive"
      onConfirm={props.onLeave}
    />
  );
}
