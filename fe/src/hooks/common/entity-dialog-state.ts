import { useCallback, useState } from 'react';

interface EntityDialogState<T> {
  isOpen: boolean;
  item: T | null;
  open: (item: T) => void;
  close: () => void;
}

export function useEntityDialogState<T>(): EntityDialogState<T> {
  const [item, setItem] = useState<T | null>(null);
  const open = useCallback((nextItem: T) => setItem(nextItem), []);
  const close = useCallback(() => setItem(null), []);

  return { isOpen: item !== null, item, open, close };
}
