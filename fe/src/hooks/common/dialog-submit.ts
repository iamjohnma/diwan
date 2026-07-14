import { useId, useLayoutEffect, useRef } from 'react';
import { useDialogsStore } from '@/stores/dialogs/store';

interface DialogSubmitPropsHook {
  open: boolean;
  onSubmit?: () => void;
  isDisabled?: () => boolean;
  priority?: number;
}

let globalPriorityCounter = 0;

export function useDialogSubmit(props: DialogSubmitPropsHook) {
  const id = useId();
  const priorityRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const { registerSubmit, unregisterSubmit } = useDialogsStore.getState();

    if (!props.open || !props.onSubmit) {
      unregisterSubmit(id);
      priorityRef.current = null;

      return;
    }

    priorityRef.current ??= props.priority ?? ++globalPriorityCounter;

    registerSubmit({
      id,
      priority: priorityRef.current,
      onSubmit: props.onSubmit,
      isDisabled: props.isDisabled
    });

    return () => unregisterSubmit(id);
  }, [id, props.open, props.onSubmit, props.isDisabled, props.priority]);
}
