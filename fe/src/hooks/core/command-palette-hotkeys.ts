import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useDialogsStore } from '@/stores/dialogs/store';
import { useUserPreferencesStore } from '@/stores/user-preferences';
import {
  requestOpenCommandPalette,
  requestToggleCommandPalette
} from '@/utils/core/command-palette/open';

const TYPE_KEY = /^[\p{L}\p{N}]$/u;
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]';

export function useCommandPaletteHotkeys(): void {
  const isOpen = useDialogsStore((state) => state.isOpen('commandPalette'));

  useHotkey(
    'Mod+K',
    (event: KeyboardEvent) => {
      if (!event.isComposing) flushSync(() => requestToggleCommandPalette());
    },
    { preventDefault: true, stopPropagation: true, ignoreInputs: false }
  );

  useHotkey(
    'Escape',
    () => useDialogsStore.getState().close('commandPalette'),
    {
      enabled: isOpen,
      preventDefault: true,
      stopPropagation: true,
      requireReset: false,
      ignoreInputs: false,
      conflictBehavior: 'allow'
    }
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isLocalizedModK =
        (event.ctrlKey || event.metaKey) &&
        event.code === 'KeyK' &&
        event.key.toLocaleUpperCase() !== 'K';
      if (isLocalizedModK && !event.repeat && !event.isComposing) {
        requestToggleCommandPalette();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        event.key === 'Escape' &&
        useDialogsStore.getState().isOpen('commandPalette')
      ) {
        useDialogsStore.getState().close('commandPalette');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !useUserPreferencesStore.getState().appearance
          .openCommandPaletteOnType ||
        !TYPE_KEY.test(event.key)
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(`${EDITABLE}, [data-diwan-reserved-keys]`)
      )
        return;

      let opened = false;
      flushSync(() => {
        opened = requestOpenCommandPalette({ initialQuery: event.key });
      });
      if (opened) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
