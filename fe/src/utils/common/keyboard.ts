export function getKeyboardEventTarget(
  event: KeyboardEvent
): HTMLElement | null {
  if (event.target instanceof HTMLElement) {
    return event.target;
  }

  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}
