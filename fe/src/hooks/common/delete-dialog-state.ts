import { useCallback, useState } from 'react';

interface DeleteDialogState<T> {
  isOpen: boolean;
  isConfirming: boolean;
  items: T[];
  open: (items: T[]) => void;
  close: () => void;
  confirm: () => void;
}

const EMPTY_ARRAY: never[] = [];

export function useDeleteDialogState<T>(
  onDelete: (items: T[]) => void | Promise<void>
): DeleteDialogState<T> {
  const [pendingItems, setPendingItems] = useState<T[]>(EMPTY_ARRAY);
  const [isConfirming, setIsConfirming] = useState(false);

  const reset = useCallback(() => {
    setPendingItems(EMPTY_ARRAY);
    setIsConfirming(false);
  }, []);

  const open = useCallback((items: T[]) => {
    if (items.length) setPendingItems(items);
  }, []);

  const confirm = useCallback(() => {
    if (!pendingItems.length || isConfirming) return;
    const batch = pendingItems;
    setIsConfirming(true);
    void (async () => {
      try {
        await onDelete(batch);
        reset();
      } finally {
        setIsConfirming(false);
      }
    })();
  }, [isConfirming, onDelete, pendingItems, reset]);

  return {
    isOpen: pendingItems.length > 0,
    isConfirming,
    items: pendingItems,
    open,
    close: reset,
    confirm
  };
}
