import { useEffect, useRef } from 'react';
import { computeScrollToNow } from '@/utils/common/big-calendar-scroll';
import { getTimePartsInTimeZone } from '@/utils/common/time-zone';

interface UseScrollToNowOptions {
  viewportElement: HTMLElement | null;
  selectedTimeZone: string;
  earliestEventHour: number;
  pixelsPerHour: number;
  /** Expected content height (hours * pixelsPerHour); used to know the grid is laid out. */
  totalRowsHeight: number;
  scrollKey?: string | number;
  enabled?: boolean;
}

export function useScrollToNow(options: UseScrollToNowOptions) {
  const hasScrolledRef = useRef(false);
  const lastTargetRef = useRef<{
    key: string | number | undefined;
    timeZone: string;
  } | null>(null);

  useEffect(() => {
    const target = {
      key: options.scrollKey,
      timeZone: options.selectedTimeZone
    };
    const lastTarget = lastTargetRef.current;
    if (
      lastTarget?.key !== target.key ||
      lastTarget?.timeZone !== target.timeZone
    ) {
      hasScrolledRef.current = false;
      lastTargetRef.current = target;
    }
  }, [options.scrollKey, options.selectedTimeZone]);

  useEffect(() => {
    if (options.enabled === false) return;
    if (hasScrolledRef.current) return;

    const viewport = options.viewportElement;
    if (!viewport || !options.selectedTimeZone) return;

    // Attempt to center "now" once the layout is measurable. Returns true when
    // it has scrolled (and locked); false when the layout isn't settled yet.
    const attempt = (): boolean => {
      if (hasScrolledRef.current) return true;

      const nowParts = getTimePartsInTimeZone(
        new Date(),
        options.selectedTimeZone
      );
      const result = computeScrollToNow({
        nowMinutes: nowParts.hour * 60 + nowParts.minute,
        earliestEventHour: options.earliestEventHour,
        pixelsPerHour: options.pixelsPerHour,
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        totalRowsHeight: options.totalRowsHeight
      });

      if (!result.ready) return false;

      viewport.scrollTop = result.scrollTop;
      hasScrolledRef.current = true;

      return true;
    };

    // Fast path: layout already settled (warm cache / instant render).
    if (attempt()) return;

    // On refresh the viewport may not be sized yet (flex ancestors still
    // resolving) or the full-day grid may not be laid out (zoom preference
    // rehydrating â†’ pixelsPerHour briefly 0). Scrolling now would clamp to the
    // top and the one-shot lock would make it permanent. Instead, retry after
    // the next paint and whenever the viewport resizes, locking in only once we
    // can center against a real layout.
    let rafId: number | null = null;
    let observer: ResizeObserver | null = null;

    const stop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      observer?.disconnect();
      observer = null;
    };

    const retry = () => {
      if (attempt()) stop();
    };

    rafId = requestAnimationFrame(() => {
      rafId = null;
      retry();
    });

    observer = new ResizeObserver(retry);
    observer.observe(viewport);

    return stop;
  }, [
    options.enabled,
    options.earliestEventHour,
    options.pixelsPerHour,
    options.selectedTimeZone,
    options.viewportElement,
    options.totalRowsHeight
  ]);
}
