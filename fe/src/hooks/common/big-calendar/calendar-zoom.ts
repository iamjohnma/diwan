import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import type { CalendarView } from '@/@types/common/big-calendar';
import { VIEWPORT_SELECTOR } from '@/constants/common/big-calendar';
import {
  buildAppearancePreferencesUpdate,
  scheduleUserPreferencesUpdate
} from '@/lib/convex/user-preferences-sync';
import { useUserPreferencesStore } from '@/stores/user-preferences';
import { getPixelsPerHour } from '@/utils/common/big-calendar';
import { getAdjacentCalendarZoom } from '@/utils/common/calendar-zoom';
import { clamp } from '@/utils/common/math';

const ZOOM_CONTENT_SELECTOR = '[data-calendar-zoom-content]';
const ZOOM_CORRECTION_DURATION_MS = 260;

interface CalendarZoomPropsHook {
  view: CalendarView;
  getIsDraggingEvent: () => boolean;
  pixelsPerHour: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

interface ZoomContentMetrics {
  offsetPixels: number;
  heightPixels: number;
}

interface CalendarZoomAnchor {
  anchorOffsetPixels: number;
  correctionEndsAt: number;
  frameId: number | null;
  hoursFromContentTop: number;
  viewport: HTMLElement;
}

type CalendarZoomWheelEvent = React.WheelEvent<HTMLDivElement> | WheelEvent;

function cancelAnchorFrame(anchor: CalendarZoomAnchor | null) {
  if (anchor?.frameId != null) {
    cancelAnimationFrame(anchor.frameId);
  }
}

function contentStartPixels(
  viewport: HTMLElement,
  metrics: ZoomContentMetrics
) {
  return Math.min(viewport.clientHeight, Math.max(0, metrics.offsetPixels));
}

function getZoomContentMetrics(viewport: HTMLElement): ZoomContentMetrics {
  const zoomContent = viewport.querySelector<HTMLElement>(
    ZOOM_CONTENT_SELECTOR
  );
  if (!zoomContent) {
    return {
      offsetPixels: 0,
      heightPixels: Math.max(1, viewport.scrollHeight)
    };
  }

  const viewportRect = viewport.getBoundingClientRect();
  const zoomContentRect = zoomContent.getBoundingClientRect();

  return {
    offsetPixels: zoomContentRect.top - viewportRect.top + viewport.scrollTop,
    heightPixels: Math.max(1, zoomContentRect.height)
  };
}

function getZoomAnchorOffsetPixels(
  viewport: HTMLElement,
  metrics: ZoomContentMetrics,
  preferredOffsetPixels: number
) {
  const start = contentStartPixels(viewport, metrics);
  const end = Math.min(
    viewport.clientHeight,
    Math.max(
      start,
      metrics.offsetPixels + metrics.heightPixels - viewport.scrollTop
    )
  );

  return clamp(preferredOffsetPixels, start, end);
}

function getZoomPointerOffsetPixels(
  event: CalendarZoomWheelEvent,
  viewport: HTMLElement,
  metrics: ZoomContentMetrics
) {
  const start = contentStartPixels(viewport, metrics);
  const pointerOffsetPixels =
    event.clientY - viewport.getBoundingClientRect().top;
  const preferredOffsetPixels = Number.isFinite(pointerOffsetPixels)
    ? pointerOffsetPixels
    : start + (viewport.clientHeight - start) / 2;

  return getZoomAnchorOffsetPixels(viewport, metrics, preferredOffsetPixels);
}

export function useCalendarZoom(props: CalendarZoomPropsHook) {
  const setAppearance = useUserPreferencesStore((state) => state.setAppearance);
  const [isZooming, setIsZooming] = useState(false);
  const zoomAnchorRef = useRef<CalendarZoomAnchor | null>(null);

  const correctZoomAnchor = useCallback(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;

    const metrics = getZoomContentMetrics(anchor.viewport);
    const anchorOffsetPixels = getZoomAnchorOffsetPixels(
      anchor.viewport,
      metrics,
      anchor.anchorOffsetPixels
    );
    const maxScrollTop = Math.max(
      0,
      anchor.viewport.scrollHeight - anchor.viewport.clientHeight
    );
    anchor.viewport.scrollTop = clamp(
      metrics.offsetPixels +
        anchor.hoursFromContentTop * props.pixelsPerHour -
        anchorOffsetPixels,
      0,
      maxScrollTop
    );
  }, [props.pixelsPerHour]);

  const handleCalendarZoomWheelEvent = useCallback(
    (event: CalendarZoomWheelEvent) => {
      if (event.defaultPrevented) return;
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (props.getIsDraggingEvent()) return;
      if (props.view !== 'range' && props.view !== 'doctor') return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const viewport = target.closest(VIEWPORT_SELECTOR) as HTMLElement | null;
      const rootElement = props.rootRef.current;
      if (!viewport || !rootElement || !rootElement.contains(viewport)) {
        return;
      }

      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (delta === 0) return;

      const currentZoom =
        useUserPreferencesStore.getState().appearance.calendarZoom;
      const nextZoom = getAdjacentCalendarZoom(
        currentZoom,
        delta < 0 ? 'in' : 'out'
      );
      if (nextZoom === currentZoom) {
        event.preventDefault();

        return;
      }

      cancelAnchorFrame(zoomAnchorRef.current);

      const metrics = getZoomContentMetrics(viewport);
      const anchorOffsetPixels = getZoomPointerOffsetPixels(
        event,
        viewport,
        metrics
      );
      const anchorGridPixels =
        viewport.scrollTop + anchorOffsetPixels - metrics.offsetPixels;

      zoomAnchorRef.current = {
        anchorOffsetPixels,
        correctionEndsAt: 0,
        frameId: null,
        hoursFromContentTop: anchorGridPixels / getPixelsPerHour(currentZoom),
        viewport
      };

      event.preventDefault();
      setIsZooming(true);
      setAppearance({ calendarZoom: nextZoom });
      scheduleUserPreferencesUpdate(
        buildAppearancePreferencesUpdate(
          useUserPreferencesStore.getState().appearance
        )
      );
    },
    [props.getIsDraggingEvent, props.view, props.rootRef, setAppearance]
  );

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;

    cancelAnchorFrame(anchor);
    anchor.correctionEndsAt = performance.now() + ZOOM_CORRECTION_DURATION_MS;

    const tick = () => {
      const current = zoomAnchorRef.current;
      if (!current) return;

      correctZoomAnchor();

      if (performance.now() < current.correctionEndsAt) {
        current.frameId = requestAnimationFrame(tick);

        return;
      }

      current.frameId = null;
      zoomAnchorRef.current = null;
      setIsZooming(false);
    };

    tick();
  }, [correctZoomAnchor, props.pixelsPerHour]);

  useEffect(() => {
    const rootElement = props.rootRef.current;
    if (!rootElement) return;

    const handleNativeWheel = (event: WheelEvent) => {
      handleCalendarZoomWheelEvent(event);
    };

    rootElement.addEventListener('wheel', handleNativeWheel, {
      capture: true,
      passive: false
    });

    return () => {
      rootElement.removeEventListener('wheel', handleNativeWheel, true);
      cancelAnchorFrame(zoomAnchorRef.current);
    };
  }, [handleCalendarZoomWheelEvent, props.rootRef]);

  return {
    handleCalendarZoomWheel: handleCalendarZoomWheelEvent,
    isZooming
  };
}
