export interface ScrollToNowGeometry {
  /** Minutes since midnight for "now" in the calendar's time zone (hour*60 + minute). */
  nowMinutes: number;
  /** First hour rendered at the top of the grid (0 for a full-day view). */
  earliestEventHour: number;
  pixelsPerHour: number;
  /** Visible height of the scroll viewport. */
  clientHeight: number;
  /** Total scrollable content height as currently measured in the DOM. */
  scrollHeight: number;
  /** Expected content height (hours * pixelsPerHour) â€” the source of truth for "laid out". */
  totalRowsHeight: number;
}

export interface ScrollToNowResult {
  /**
   * Whether the layout is settled enough to scroll. When false, the caller must
   * NOT scroll/lock yet â€” it should retry once the viewport is sized and the
   * grid has been laid out, otherwise the position clamps to the top.
   */
  ready: boolean;
  scrollTop: number;
}

/**
 * Computes where to scroll a day/range grid so "now" sits in the middle of the
 * viewport, and reports whether the layout is actually measurable yet.
 *
 * The readiness gate exists because the scroll is a one-shot on initial load: if
 * we scroll before the viewport has a height (flex ancestors still resolving) or
 * before the full-day grid has laid out (e.g. pixelsPerHour transiently 0 while
 * the zoom preference rehydrates), `maxScrollTop` collapses to ~0 and we'd clamp
 * to the top â€” and the one-shot lock would make that permanent. Returning
 * `ready: false` tells the caller to wait and try again instead.
 */
export function computeScrollToNow(
  geometry: ScrollToNowGeometry
): ScrollToNowResult {
  const { clientHeight, scrollHeight, totalRowsHeight } = geometry;

  const isLaidOut =
    clientHeight > 0 &&
    totalRowsHeight > 0 &&
    // +1 tolerance for sub-pixel rounding between the measured and expected height.
    scrollHeight + 1 >= totalRowsHeight;

  if (!isLaidOut) {
    return { ready: false, scrollTop: 0 };
  }

  const firstVisibleMinute = geometry.earliestEventHour * 60;
  const minutesFromTop = Math.max(0, geometry.nowMinutes - firstVisibleMinute);
  const targetScrollTop =
    (minutesFromTop / 60) * geometry.pixelsPerHour - clientHeight / 2;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  return {
    ready: true,
    scrollTop: Math.min(maxScrollTop, Math.max(0, targetScrollTop))
  };
}
