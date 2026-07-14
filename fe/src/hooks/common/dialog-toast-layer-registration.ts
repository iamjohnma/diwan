import { useLayoutEffect, useRef } from 'react';
import { useDialogsStore } from '@/stores/dialogs/store';

export function useDialogToastLayerRegistration(
  isOpen: boolean,
  dialogId: string,
  closeDialog: () => void
) {
  // Keep the latest close handler in a ref so the registration effect does not
  // depend on its identity. Dialogs frequently receive an inline `onOpenChange`
  // (so `closeDialog` is a new function every render); if it were an effect dep
  // the registration would unregister→register on every render, momentarily
  // dropping the dialog-layer count to 0 and back to 1. Other subscribers read
  // that bounce as "a new dialog opened on top" — most visibly an open desktop
  // `Select` dropdown auto-closes mid-interaction, so a hovered option can't be
  // clicked. Registering once per open keeps the layer count stable.
  const closeDialogRef = useRef(closeDialog);
  closeDialogRef.current = closeDialog;

  useLayoutEffect(() => {
    const { registerDialog, unregisterDialog } = useDialogsStore.getState();
    if (isOpen) registerDialog(dialogId, () => closeDialogRef.current());
    else unregisterDialog(dialogId);

    return () => unregisterDialog(dialogId);
  }, [isOpen, dialogId]);
}
