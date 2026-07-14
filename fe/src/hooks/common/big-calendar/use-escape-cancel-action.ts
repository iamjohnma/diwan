import { useCallback, useRef, useState } from 'react';

export function useEscapeCancelAction() {
  const escapeCancelActionRef = useRef<(() => void) | null>(null);
  const [hasEscapeCancelAction, setHasEscapeCancelAction] = useState(false);

  const setEscapeCancelAction = useCallback(
    (cancelAction: (() => void) | null) => {
      escapeCancelActionRef.current = cancelAction;
      setHasEscapeCancelAction(!!cancelAction);
    },
    []
  );

  const cancelEscapeCancelAction = useCallback(() => {
    const cancelAction = escapeCancelActionRef.current;
    if (!cancelAction) {
      return false;
    }

    escapeCancelActionRef.current = null;
    setHasEscapeCancelAction(false);
    cancelAction();

    return true;
  }, []);

  return {
    hasEscapeCancelAction,
    setEscapeCancelAction,
    cancelEscapeCancelAction
  };
}
