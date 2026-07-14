import { OPEN_OVERLAY_FIRST_INPUT_SELECTOR } from '@/constants/common/open-overlay-autofocus';
import {
  canAutoFocus,
  focusAutoFocusTarget
} from '@/utils/common/can-auto-focus';
import { scheduleSelectEndAfterControlledUpdate } from '@/utils/common/select-end-of-input-value';

export { OPEN_OVERLAY_FIRST_INPUT_SELECTOR } from '@/constants/common/open-overlay-autofocus';

export function getFirstOpenOverlayTextField(
  container: HTMLElement
): HTMLElement | null {
  return (
    Array.from(
      container.querySelectorAll<HTMLElement>(OPEN_OVERLAY_FIRST_INPUT_SELECTOR)
    ).find((candidate) => {
      if (candidate.matches('[disabled], [hidden], [data-no-focus]')) {
        return false;
      }
      if (candidate.matches('[contenteditable="true"]')) {
        return true;
      }

      return candidate.tabIndex >= 0;
    }) ?? null
  );
}

function focusTextField(element: HTMLElement): void {
  if (focusAutoFocusTarget(element, { preventScroll: true })) {
    scheduleSelectEndAfterControlledUpdate(element);
  }
}

function focusContainer(container: HTMLElement): void {
  if (!container.hasAttribute('tabindex')) {
    container.setAttribute('tabindex', '-1');
  }
  focusAutoFocusTarget(container, { preventScroll: true });
}

function isFocused(element: HTMLElement): boolean {
  return element.ownerDocument.activeElement === element;
}

function hasFocusedElementInsideContainer(
  container: HTMLElement,
  element: HTMLElement
): boolean {
  const activeElement = element.ownerDocument.activeElement;

  return (
    activeElement !== null &&
    activeElement !== container &&
    activeElement !== element &&
    container.contains(activeElement)
  );
}

function scheduleFocusRetry(container: HTMLElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const retry = getFirstOpenOverlayTextField(container);

      if (
        !retry ||
        isFocused(retry) ||
        hasFocusedElementInsideContainer(container, retry)
      ) {
        return;
      }

      focusTextField(retry);
    });
  });
}

export function handleOpenOverlayAutoFocus(
  event: Event,
  userOnOpenAutoFocus?: (event: Event) => void
): void {
  userOnOpenAutoFocus?.(event);

  if (event.defaultPrevented) {
    return;
  }

  const content = event.currentTarget as HTMLElement | null;
  if (!content) {
    return;
  }

  if (!canAutoFocus()) {
    event.preventDefault();

    return;
  }

  const firstInput = getFirstOpenOverlayTextField(content);

  if (firstInput) {
    event.preventDefault();
    focusTextField(firstInput);
    scheduleFocusRetry(content);

    return;
  }

  event.preventDefault();
  focusContainer(content);
  scheduleFocusRetry(content);
}
