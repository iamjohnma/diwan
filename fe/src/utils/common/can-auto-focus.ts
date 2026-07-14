import { selectEndOfInputValue } from '@/utils/common/select-end-of-input-value';
import { hasTouchScreenCapability } from '@/utils/common/touch-screen';

interface AutoFocusTargetOptions extends FocusOptions {
  selection?: 'all' | 'end';
  /**
   * Bypass the touch-screen autofocus gate. Use for keyboard-driven overlays
   * (e.g. Ctrl+K command palette) that must receive arrow keys immediately.
   */
  force?: boolean;
}

export function canAutoFocus(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return !hasTouchScreenCapability();
}

export function resolveAutoFocus(autoFocus: boolean): boolean {
  return autoFocus && canAutoFocus();
}

function selectAllTextValue(element: HTMLElement): void {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  try {
    element.select();
  } catch {
    void 0;
  }
}

export function focusAutoFocusTarget(
  element: HTMLElement | null | undefined,
  options: AutoFocusTargetOptions = {}
): boolean {
  const { selection, force, ...focusOptions } = options;
  if (!element || (!force && !canAutoFocus())) {
    return false;
  }

  try {
    element.focus(focusOptions);
  } catch {
    return false;
  }

  if (selection === 'all') {
    selectAllTextValue(element);
  } else if (selection === 'end') {
    selectEndOfInputValue(element);
  }

  return true;
}
