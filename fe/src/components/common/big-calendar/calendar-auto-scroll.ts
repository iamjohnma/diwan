import { VIEWPORT_SELECTOR } from '@/constants/common/big-calendar';

export function canAutoScrollCalendarElement(
  element: Element,
  rootElement: HTMLElement | null
): boolean {
  if (!rootElement) return false;

  const ownerDocument = element.ownerDocument;
  const documentScrollingElement = ownerDocument?.scrollingElement ?? null;

  if (
    element === documentScrollingElement ||
    element === ownerDocument?.documentElement ||
    element === ownerDocument?.body
  ) {
    return false;
  }

  return rootElement.contains(element) && element.matches(VIEWPORT_SELECTOR);
}
