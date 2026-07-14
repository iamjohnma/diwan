import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import type {
  ColumnOverflowPropsHook,
  ColumnOverflowState,
  HorizontalColumnOverflowPropsHook,
  HorizontalOverflowState
} from '@/@types/common/components/big-calendar/shared/overflow-indicators';
import { VIEWPORT_SELECTOR } from '@/constants/common/big-calendar';
import { DEFAULT_PIXELS_PER_HOUR } from '@/utils/common/big-calendar';
import type { TimeGridMinuteBounds } from '@/utils/common/big-calendar-segments';
import {
  SCROLL_EDGE_EPSILON,
  getNormalizedScrollLeft
} from '@/utils/common/rtl-scroll';

function getScrollViewport(
  scrollAreaRef: RefObject<HTMLDivElement | null>
): HTMLElement | null {
  return (
    scrollAreaRef.current?.querySelector<HTMLElement>(VIEWPORT_SELECTOR) ?? null
  );
}

function createThrottledCallback(callback: () => void, wait: number) {
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    const now = Date.now();
    const elapsed = now - lastRun;
    if (elapsed >= wait || lastRun === 0) {
      lastRun = now;
      callback();
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      return;
    }

    timeoutId ??= setTimeout(() => {
      timeoutId = null;
      lastRun = Date.now();
      callback();
    }, wait - elapsed);
  };

  return {
    run,
    cancel: () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}

function useViewportScrollObserver(
  enabled: boolean,
  getViewport: () => HTMLElement | null,
  update: () => void
) {
  useEffect(() => {
    if (!enabled) return;

    const viewport = getViewport();
    if (!viewport) return;

    update();

    const scroll = createThrottledCallback(update, 100);
    const resize = createThrottledCallback(update, 150);

    viewport.addEventListener('scroll', scroll.run, { passive: true });

    const resizeObserver = new ResizeObserver(resize.run);
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener('scroll', scroll.run);
      resizeObserver.disconnect();
      scroll.cancel();
      resize.cancel();
    };
  }, [enabled, getViewport, update]);
}

function getEventPixelBounds(
  event: TimeGridMinuteBounds,
  earliestEventHour: number,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR
): { topPixels: number; bottomPixels: number } {
  const firstHourMinutes = earliestEventHour * 60;

  const topPixels =
    ((event.startMinutes - firstHourMinutes) / 60) * pixelsPerHour;
  const bottomPixels =
    ((event.endMinutes - firstHourMinutes) / 60) * pixelsPerHour;

  return { topPixels, bottomPixels };
}

const EMPTY_STATE: ColumnOverflowState = {
  hasAnyAbove: false,
  hasAnyBelow: false
};

export function useColumnOverflow(
  props: ColumnOverflowPropsHook
): ColumnOverflowState {
  const {
    scrollAreaRef,
    eventsByColumnId,
    earliestEventHour,
    headerOffset = 0,
    pixelsPerHour = DEFAULT_PIXELS_PER_HOUR,
    scrollState: externalScrollState
  } = props;

  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    viewportHeight: 0
  });

  const getViewport = useCallback(
    () => getScrollViewport(scrollAreaRef),
    [scrollAreaRef]
  );

  const updateScrollState = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    setScrollState((prev) => {
      const nextScrollTop = viewport.scrollTop;
      const nextViewportHeight = viewport.clientHeight;
      if (
        prev.scrollTop === nextScrollTop &&
        prev.viewportHeight === nextViewportHeight
      ) {
        return prev;
      }

      return { scrollTop: nextScrollTop, viewportHeight: nextViewportHeight };
    });
  }, [getViewport]);

  useViewportScrollObserver(
    externalScrollState === undefined,
    getViewport,
    updateScrollState
  );

  const pixelBoundsByColumn = useMemo(() => {
    const result = new Map<
      string,
      Array<{ topPixels: number; bottomPixels: number }>
    >();
    for (const [columnId, events] of eventsByColumnId) {
      result.set(
        columnId,
        events.map((event) =>
          getEventPixelBounds(event, earliestEventHour, pixelsPerHour)
        )
      );
    }

    return result;
  }, [eventsByColumnId, earliestEventHour, pixelsPerHour]);

  return useMemo(() => {
    const activeScrollState = externalScrollState ?? scrollState;
    const { scrollTop, viewportHeight } = activeScrollState;
    if (viewportHeight === 0 || pixelBoundsByColumn.size === 0) {
      return EMPTY_STATE;
    }

    const safeHeaderOffset = Math.max(0, headerOffset);
    const effectiveScrollTop = Math.max(0, scrollTop);
    const effectiveBottom = Math.max(
      effectiveScrollTop,
      scrollTop + viewportHeight - safeHeaderOffset
    );

    let hasAnyAbove = false;
    let hasAnyBelow = false;

    for (const positions of pixelBoundsByColumn.values()) {
      let columnHasAbove = false;
      let columnHasBelow = false;

      for (const { topPixels, bottomPixels } of positions) {
        if (!columnHasAbove && bottomPixels <= effectiveScrollTop) {
          columnHasAbove = true;
        }
        if (!columnHasBelow && topPixels >= effectiveBottom) {
          columnHasBelow = true;
        }
        if (columnHasAbove && columnHasBelow) break;
      }

      if (columnHasAbove) hasAnyAbove = true;
      if (columnHasBelow) hasAnyBelow = true;
      if (hasAnyAbove && hasAnyBelow) break;
    }

    return {
      hasAnyAbove,
      hasAnyBelow
    };
  }, [pixelBoundsByColumn, scrollState, externalScrollState, headerOffset]);
}

function hasEventsInPhysicalRange(
  physicalStart: number,
  physicalCount: number,
  doctorCount: number,
  isRtl: boolean,
  doctors: Array<{ id: string }>,
  eventsByColumnId: Map<string, CalendarEvent[]>
): boolean {
  for (let j = physicalStart; j < physicalStart + physicalCount; j++) {
    const doctorIndex = isRtl ? doctorCount - 1 - j : j;
    const doctor = doctors[doctorIndex];
    if (!doctor) continue;
    const events = eventsByColumnId.get(doctor.id);
    if (events && events.length > 0) return true;
  }

  return false;
}

const EMPTY_HORIZONTAL_STATE: HorizontalOverflowState = {
  hasAnyLeft: false,
  hasAnyRight: false
};

export function useHorizontalColumnOverflow(
  props: HorizontalColumnOverflowPropsHook
): HorizontalOverflowState {
  const {
    scrollAreaRef,
    doctors,
    eventsByColumnId,
    columnWidth,
    stickyColumnWidth,
    isRtl,
    scrollState: externalScrollState
  } = props;

  const [scrollState, setScrollState] = useState({
    normalizedScrollLeft: 0,
    viewportWidth: 0,
    maxScrollLeft: 0
  });

  const getViewport = useCallback(
    () => getScrollViewport(scrollAreaRef),
    [scrollAreaRef]
  );

  const updateHorizontalScroll = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    setScrollState((prev) => {
      const normalized = getNormalizedScrollLeft(viewport);
      const width = viewport.clientWidth;
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

      if (
        Math.abs(prev.normalizedScrollLeft - normalized) < 1 &&
        prev.viewportWidth === width &&
        prev.maxScrollLeft === max
      ) {
        return prev;
      }

      return {
        normalizedScrollLeft: normalized,
        viewportWidth: width,
        maxScrollLeft: max
      };
    });
  }, [getViewport]);

  useViewportScrollObserver(
    externalScrollState === undefined,
    getViewport,
    updateHorizontalScroll
  );

  return useMemo(() => {
    const viewport = getViewport();
    const normalizedScrollLeft =
      externalScrollState?.scrollLeft ?? scrollState.normalizedScrollLeft;
    const viewportWidth =
      externalScrollState?.viewportWidth ?? scrollState.viewportWidth;
    const maxScrollLeft =
      viewport !== null
        ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        : scrollState.maxScrollLeft;
    if (
      viewportWidth === 0 ||
      maxScrollLeft <= 0 ||
      doctors.length === 0 ||
      columnWidth <= 0
    ) {
      return EMPTY_HORIZONTAL_STATE;
    }

    const hasScrollLeft = normalizedScrollLeft > SCROLL_EDGE_EPSILON;
    const hasScrollRight =
      normalizedScrollLeft < maxScrollLeft - SCROLL_EDGE_EPSILON;

    if (!hasScrollLeft && !hasScrollRight) {
      return EMPTY_HORIZONTAL_STATE;
    }

    const visibleWidth = Math.max(0, viewportWidth - stickyColumnWidth);
    const physicalColumnsOffLeft = Math.max(
      0,
      Math.floor(normalizedScrollLeft / columnWidth)
    );
    const firstOffRightIndex = Math.ceil(
      (normalizedScrollLeft + visibleWidth) / columnWidth
    );
    const physicalColumnsOffRight = Math.max(
      0,
      doctors.length - firstOffRightIndex
    );

    const doctorCount = doctors.length;
    const hasEventsLeft =
      hasScrollLeft &&
      physicalColumnsOffLeft > 0 &&
      hasEventsInPhysicalRange(
        0,
        physicalColumnsOffLeft,
        doctorCount,
        isRtl,
        doctors,
        eventsByColumnId
      );
    const hasEventsRight =
      hasScrollRight &&
      physicalColumnsOffRight > 0 &&
      hasEventsInPhysicalRange(
        doctorCount - physicalColumnsOffRight,
        physicalColumnsOffRight,
        doctorCount,
        isRtl,
        doctors,
        eventsByColumnId
      );

    return {
      hasAnyLeft: hasEventsLeft,
      hasAnyRight: hasEventsRight
    };
  }, [
    getViewport,
    scrollState,
    externalScrollState,
    doctors,
    eventsByColumnId,
    columnWidth,
    stickyColumnWidth,
    isRtl
  ]);
}
