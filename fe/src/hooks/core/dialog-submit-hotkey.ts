import { useEffect } from 'react';
import { getHotkeyManager } from '@tanstack/hotkeys';
import { hasBlockingConnectionIssue } from '@/hooks/core/online-status';
import { useDialogsStore } from '@/stores/dialogs/store';
import { getKeyboardEventTarget } from '@/utils/common/keyboard';

const LIST_OVERLAY_SELECTOR = [
  '[role="listbox"]',
  '[role="option"]',
  '[role="menu"]',
  '[data-slot="select-content"]',
  '[data-slot="select-content-mobile"]',
  '[data-slot="menu-popup"]',
  '[data-slot="context-menu-content"]'
].join(', ');
const NATIVE_ACTIVATION_SELECTOR = [
  'button',
  'a[href]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]'
].join(', ');

function isTextLikeElement(element: HTMLElement | null) {
  return (
    !!element &&
    (element.tagName === 'TEXTAREA' ||
      element.isContentEditable ||
      !!element.closest?.('[contenteditable="true"], [role="textbox"]'))
  );
}

function isListOverlayElement(element: HTMLElement | null) {
  return !!element?.closest?.(LIST_OVERLAY_SELECTOR);
}

function isNativeActivationElement(element: HTMLElement | null) {
  return !!element?.closest?.(NATIVE_ACTIVATION_SELECTOR);
}

export function useDialogSubmitHotkey() {
  const hasSubmitHandlers = useDialogsStore(
    (state) => state.submitHandlers.size > 0
  );

  useEffect(() => {
    const clearEnterPressed = () => {
      useDialogsStore.getState().setEnterPressed(false);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Enter') clearEnterPressed();
    };

    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', clearEnterPressed);

    return () => {
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', clearEnterPressed);
    };
  }, []);

  useEffect(() => {
    if (!hasSubmitHandlers) return;

    const hotkey = getHotkeyManager().register(
      'Enter',
      (event: KeyboardEvent) => {
        if (hasBlockingConnectionIssue() || event.isComposing || event.repeat) {
          return;
        }

        if (event.defaultPrevented) {
          return;
        }

        const store = useDialogsStore.getState();
        if (store.isEnterPressed) return;

        const target = getKeyboardEventTarget(event);

        if (isNativeActivationElement(target)) {
          return;
        }

        if (isTextLikeElement(target) && !(event.ctrlKey || event.metaKey)) {
          return;
        }

        if (isListOverlayElement(target)) {
          return;
        }

        const topHandler = store.getTopSubmitHandler();
        if (!topHandler || topHandler.isDisabled?.()) return;

        if (store.triggerTopSubmit()) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { ignoreInputs: false, preventDefault: false, stopPropagation: false }
    );

    return () => {
      hotkey.unregister();
    };
  }, [hasSubmitHandlers]);
}
