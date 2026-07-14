import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { getCalendarScrollViewport } from '@/constants/common/big-calendar';

const SCROLL_THRESHOLD_PX = 80;
const SCROLL_THROTTLE_MS = 100;

interface CalendarViewportScrollStateProps {
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  isDraggingRef: React.RefObject<boolean>;
}

export interface CalendarViewportScrollState {
  scrollTop: number;
  viewportHeight: number;
}

/**
 * Tracks the calendar scroll viewport (scrollTop + height) with RAF-coalesced
 * scroll handling and a ResizeObserver, throttling small scroll deltas while
 * not dragging. Shared by the doctor and range time-grid views to drive
 * segment virtualization.
 */
export function useCalendarViewportScrollState(
  props: CalendarViewportScrollStateProps
) {
  const [viewportElement, setViewportElement] = useState<HTMLElement | null>(
    null
  );
  const [scrollState, setScrollState] = useState<CalendarViewportScrollState>({
    scrollTop: 0,
    viewportHeight: 0
  });
  const scrollStateRef = useRef(scrollState);

  const commitScrollState = useCallback((next: CalendarViewportScrollState) => {
    const prev = scrollStateRef.current;
    if (
      prev.scrollTop === next.scrollTop &&
      prev.viewportHeight === next.viewportHeight
    ) {
      return;
    }
    scrollStateRef.current = next;
    setScrollState(next);
  }, []);

  useLayoutEffect(() => {
    const viewport = getCalendarScrollViewport(props.scrollAreaRef.current);
    setViewportElement(viewport);
    if (!viewport) return;

    let lastScrollUpdate = 0;
    const runScrollUpdate = () => {
      const next = {
        scrollTop: viewport.scrollTop,
        viewportHeight: viewport.clientHeight
      };
      const prev = scrollStateRef.current;
      const now = Date.now();
      if (
        !props.isDraggingRef.current &&
        Math.abs(next.scrollTop - prev.scrollTop) < SCROLL_THRESHOLD_PX &&
        prev.viewportHeight === next.viewportHeight &&
        now - lastScrollUpdate < SCROLL_THROTTLE_MS
      ) {
        return;
      }
      lastScrollUpdate = now;
      commitScrollState(next);
    };

    runScrollUpdate();

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        runScrollUpdate();
      });
    };

    const observer = new ResizeObserver(runScrollUpdate);
    observer.observe(viewport);
    viewport.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [commitScrollState, props.scrollAreaRef, props.isDraggingRef]);

  const syncScrollState = useCallback(() => {
    if (!viewportElement) return;
    commitScrollState({
      scrollTop: viewportElement.scrollTop,
      viewportHeight: viewportElement.clientHeight
    });
  }, [commitScrollState, viewportElement]);

  return {
    viewportElement,
    scrollState,
    syncScrollState
  };
}
