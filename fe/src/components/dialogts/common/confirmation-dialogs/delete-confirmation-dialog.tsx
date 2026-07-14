import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { TrashIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { DialogWrapper } from '@/components/dialogts/common/dialog-wrapper/dialog-wrapper';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  icon?: Icon;
  isLoading?: boolean;
  showCloseButton?: boolean;
  maxWidth?: string;
  contentClassName?: string;
  children?: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  confirmDisabled?: boolean;
  closeOnConfirm?: boolean;
}

export function DeleteConfirmationDialog(props: DeleteConfirmationDialogProps) {
  const { t } = useTranslation();
  const isLoading = props.isLoading ?? false;
  const showCloseButton = props.showCloseButton ?? !isLoading;
  const closeOnConfirm = props.closeOnConfirm ?? true;
  const handleConfirm = () => {
    void Promise.resolve()
      .then(props.onConfirm)
      .catch(() => undefined);
    if (closeOnConfirm) {
      props.onOpenChange(false);
    }
  };

  return (
    <DialogWrapper
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      description={props.description}
      icon={props.icon ?? TrashIcon}
      isLoading={isLoading}
      showCloseButton={showCloseButton}
      maxWidth={props.maxWidth}
      contentClassName={props.contentClassName}
      cancelLabel={props.cancelLabel ?? t('common.dialog.cancel')}
      confirmLabel={props.confirmLabel ?? t('common.dialog.delete')}
      confirmVariant={props.confirmVariant ?? 'destructive'}
      confirmDisabled={props.confirmDisabled}
      onConfirm={handleConfirm}
      submitBehavior={closeOnConfirm ? undefined : 'await'}
    >
      {props.children}
    </DialogWrapper>
  );
}
