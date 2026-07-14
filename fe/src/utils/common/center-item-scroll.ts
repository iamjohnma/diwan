interface CenteredScrollTopParams {
  /** The item's top offset within the container's scrollable content. */
  itemOffsetTop: number;
  itemHeight: number;
  containerClientHeight: number;
  containerScrollHeight: number;
}

/**
 * The `scrollTop` that places an item's vertical center at the container's
 * vertical center, clamped to the scrollable range. Items too close to an edge
 * to fully center clamp to that edge (a top-most item stays at 0; a bottom-most
 * item stays pinned to the bottom), and a list that doesn't overflow never
 * scrolls. Pure math so it can be unit-tested without a DOM.
 */
function computeCenteredScrollTop(params: CenteredScrollTopParams): number {
  const centeredScrollTop =
    params.itemOffsetTop -
    (params.containerClientHeight - params.itemHeight) / 2;
  const maxScrollTop = Math.max(
    0,
    params.containerScrollHeight - params.containerClientHeight
  );

  return Math.max(0, Math.min(centeredScrollTop, maxScrollTop));
}

/**
 * Scroll a container so the given item sits in its vertical middle.
 *
 * Operates purely on the container's own `scrollTop` rather than
 * `Element.scrollIntoView` — `scrollIntoView` also pans every scrollable
 * ancestor, which would let an open dropdown/popover nudge the page behind it.
 */
export function scrollItemToContainerCenter(
  itemEl: HTMLElement,
  containerEl: HTMLElement
): void {
  const itemRect = itemEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  const itemOffsetTop =
    itemRect.top - containerRect.top + containerEl.scrollTop;

  containerEl.scrollTop = computeCenteredScrollTop({
    itemOffsetTop,
    itemHeight: itemRect.height,
    containerClientHeight: containerEl.clientHeight,
    containerScrollHeight: containerEl.scrollHeight
  });
}
