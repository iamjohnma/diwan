import { useDialogsStore } from '@/stores/dialogs/store';

const COMMAND_PALETTE_ROOT_SELECTOR = '[data-diwan-command-palette-root="true"]';

const COMMAND_PALETTE_BLOCKING_OVERLAY_SELECTOR = [
  '[data-dms-dialog-open="true"]',
  '[data-slot="steps-dialog-content"]',
  '[data-dms-floating-overlay]',
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  '[data-slot="select-content-mobile"]',
  '[data-slot="menu-popup"][data-open]',
  '[data-slot="menu-sub-content"][data-open]',
  '[data-slot="context-menu-content"][data-state="open"]',
  '[data-slot="drawer-content"]',
  COMMAND_PALETTE_ROOT_SELECTOR
].join(',');

function isVisibleBlockingOverlay(element: HTMLElement): boolean {
  if (element.closest(COMMAND_PALETTE_ROOT_SELECTOR)) {
    return false;
  }

  if (element.getClientRects().length === 0) {
    return false;
  }

  const style = window.getComputedStyle(element);

  return style.visibility !== 'hidden' && style.pointerEvents !== 'none';
}

function hasOpenCommandPaletteBlockingOverlayInDom() {
  if (typeof document === 'undefined') {
    return false;
  }

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      COMMAND_PALETTE_BLOCKING_OVERLAY_SELECTOR
    )
  );

  return elements.some(isVisibleBlockingOverlay);
}

export function requestOpenCommandPalette(options?: {
  initialQuery?: string;
}): boolean {
  const dialogsStore = useDialogsStore.getState();

  if (
    dialogsStore.isOpen('commandPalette') ||
    dialogsStore.hasOpenDialogs() ||
    hasOpenCommandPaletteBlockingOverlayInDom()
  ) {
    return false;
  }

  dialogsStore.open('commandPalette', options);

  return true;
}

export function requestToggleCommandPalette(): boolean {
  const dialogsStore = useDialogsStore.getState();

  if (dialogsStore.isOpen('commandPalette')) {
    dialogsStore.close('commandPalette');

    return true;
  }

  return requestOpenCommandPalette();
}

export function isCommandPaletteRoot(element: EventTarget | null): boolean {
  return (
    element instanceof Element &&
    element.closest(COMMAND_PALETTE_ROOT_SELECTOR) !== null
  );
}
