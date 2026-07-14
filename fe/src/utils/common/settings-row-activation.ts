const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [role="combobox"], [role="slider"], [role="switch"], label';

const FORWARD_TARGET_SELECTOR =
  '[data-slot="select-trigger"], button:not([data-row-activate-skip])';

export const SETTINGS_ROW_INTERACTIVE_CLASS = 'cursor-pointer';

export function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
  );
}

export function activateRowControl(container: HTMLElement | null): void {
  if (!container) return;

  const tabsList = container.querySelector('[data-slot="tabs-list"]');
  if (tabsList) {
    activateNextTab(tabsList);

    return;
  }

  const control = container.querySelector<HTMLElement>(FORWARD_TARGET_SELECTOR);
  control?.click();
}

function activateNextTab(tabsList: Element): void {
  const triggers = Array.from(
    tabsList.querySelectorAll<HTMLElement>(
      '[data-slot="tabs-trigger"]:not([data-disabled])'
    )
  );
  if (triggers.length === 0) return;

  const activeIndex = triggers.findIndex((trigger) =>
    trigger.hasAttribute('data-active')
  );
  const nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % triggers.length;
  triggers[nextIndex]?.click();
}
