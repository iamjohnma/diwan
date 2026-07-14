import { useCallback, useState } from 'react';

interface DialogOpenState {
  isOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

export function useDialogOpenState(initialOpen = false): DialogOpenState {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const openDialog = useCallback(() => setIsOpen(true), []);
  const closeDialog = useCallback(() => setIsOpen(false), []);

  return { isOpen, openDialog, closeDialog };
}
