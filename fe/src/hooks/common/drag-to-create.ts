import { useCallback, useEffect, useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { CALENDAR_CANCEL_SLOT_DRAG_EVENT } from '@/constants/common/big-calendar';
import type { PendingVisitCreateSelection } from '@/stores/pending-visit-create';
import { MINUTES_PER_SNAP } from '@/utils/common/big-calendar';
import { hapticDragPick, hapticSnapTick } from '@/utils/common/haptics';
import {
  getDateKeyInTimeZone,
  getTimePartsInTimeZone
} from '@/utils/common/time-zone';

const TOUCH_LONG_PRESS_MS = 200;
const TOUCH_SCROLL_THRESHOLD_PX = 8;

interface DragToCreatePropsHook {
  canCreate: boolean;
  firstHour: number;
  pixelsPerHour: number;
  onRangeSelect: (startMinute: number, endMinute: number) => void;
  onClick: (hour: number, minute: number) => void;
  /**
   * Live predicate used to mark the in-progress selection as forbidden (red).
   * Returning `true` for the current [start, end] range paints the preview in
   * the destructive tone. The authoritative gate that blocks the create dialog
   * lives in the range-select handler.
   */
  checkCollision?: (startMinute: number, endMinute: number) => boolean;
}

interface PersistedDragToCreatePreviewStyleParams {
  selection: PendingVisitCreateSelection | null;
  dayKey: string;
  firstHour: number;
  pixelsPerHour: number;
  timeZone?: string;
  doctorId?: string;
}

interface DragToCreatePreviewStyle {
  top: string;
  height: string;
}

interface TouchGestureState {
  touchId: number;
  startX: number;
  startY: number;
  pending: boolean;
  isScrolling: boolean;
  activationTimer: ReturnType<typeof setTimeout> | null;
}

function getTouchById(
  touches: { readonly length: number },
  touchId: number
): Touch | null {
  const list = touches as { readonly [index: number]: Touch | undefined };

  for (let index = 0; index < touches.length; index += 1) {
    const touch = list[index];
    if (touch && touch.identifier === touchId) {
      return touch;
    }
  }

  return null;
}

function isCalendarPanSkipTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest('[data-calendar-pan-skip]') !== null;
}

function getDragToCreatePreviewStyle(
  startMinute: number,
  currentMinute: number,
  firstHour: number,
  pixelsPerHour: number
): DragToCreatePreviewStyle | null {
  const from = Math.min(startMinute, currentMinute);
  const to = Math.max(startMinute, currentMinute);
  if (to - from < MINUTES_PER_SNAP) return null;
  const pxPerMin = pixelsPerHour / 60;

  return {
    top: `${(from - firstHour * 60) * pxPerMin}px`,
    height: `${(to - from) * pxPerMin}px`
  };
}

export function getPersistedDragToCreatePreviewStyle(
  params: PersistedDragToCreatePreviewStyleParams
) {
  const { selection, dayKey, firstHour, pixelsPerHour, timeZone, doctorId } =
    params;
  if (!selection) return null;
  if (doctorId && selection.dentistId && selection.dentistId !== doctorId) {
    return null;
  }

  const startDate = new Date(selection.startDate);
  if (getDateKeyInTimeZone(startDate, timeZone) !== dayKey) return null;

  const startTimeParts = getTimePartsInTimeZone(startDate, timeZone);
  const endTimeParts = getTimePartsInTimeZone(
    new Date(selection.endDate),
    timeZone
  );
  const from = startTimeParts.hour * 60 + startTimeParts.minute;
  const to = endTimeParts.hour * 60 + endTimeParts.minute;

  return to - from < MINUTES_PER_SNAP
    ? null
    : getDragToCreatePreviewStyle(from, to, firstHour, pixelsPerHour);
}

export function useDragToCreate(props: DragToCreatePropsHook) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    startMinute: 0,
    currentMinute: 0,
    didDrag: false,
    suppressClick: false,
    previewKey: null as string | null
  });
  const touchRef = useRef<TouchGestureState | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const removeListenersRef = useRef<(() => void) | null>(null);
  const removeTouchListenersRef = useRef<(() => void) | null>(null);

  const hidePreview = useCallback(() => {
    const el = previewRef.current;
    if (el) {
      el.style.display = 'none';
      el.removeAttribute('data-collision');
    }
    containerRef.current?.removeAttribute('data-drag-to-create-active');
    dragRef.current.previewKey = null;
  }, []);

  const clearTouchGesture = useCallback(() => {
    const touch = touchRef.current;
    if (touch?.activationTimer) {
      clearTimeout(touch.activationTimer);
    }
    touchRef.current = null;
    removeTouchListenersRef.current?.();
    removeTouchListenersRef.current = null;
  }, []);

  const deactivateDrag = useCallback(() => {
    const d = dragRef.current;
    d.active = false;
    d.didDrag = false;
    removeListenersRef.current?.();
    removeListenersRef.current = null;
    clearTouchGesture();
    containerRef.current?.removeAttribute('data-drag-to-create-active');
  }, [clearTouchGesture]);

  const clearDrag = useCallback(() => {
    deactivateDrag();
    hidePreview();
  }, [deactivateDrag, hidePreview]);

  const finishRangeSelectDrag = useCallback(() => {
    deactivateDrag();
    queueMicrotask(hidePreview);
  }, [deactivateDrag, hidePreview]);

  const finishDragSelection = useCallback(
    (endMinute: number, onComplete?: () => void) => {
      const d = dragRef.current;
      if (d.didDrag) {
        d.suppressClick = true;
        const from = Math.min(d.startMinute, endMinute);
        const to = Math.max(d.startMinute, endMinute);
        if (to - from >= MINUTES_PER_SNAP) {
          propsRef.current.onRangeSelect(from, to);
          finishRangeSelectDrag();
          onComplete?.();

          return;
        }
      }
      clearDrag();
      onComplete?.();
    },
    [clearDrag, finishRangeSelectDrag]
  );

  const cancelDrag = useCallback(() => {
    if (!dragRef.current.active) {
      clearTouchGesture();

      return;
    }
    dragRef.current.suppressClick = true;
    clearDrag();
  }, [clearDrag, clearTouchGesture]);

  const getMinuteFromY = useCallback((clientY: number) => {
    const container = containerRef.current;
    if (!container) return 0;
    const { firstHour, pixelsPerHour } = propsRef.current;
    const y = clientY - container.getBoundingClientRect().top;
    const raw = firstHour * 60 + (y / pixelsPerHour) * 60;
    const snapped = Math.round(raw / MINUTES_PER_SNAP) * MINUTES_PER_SNAP;

    return Math.max(0, Math.min(24 * 60, snapped));
  }, []);

  const maybeHapticOnSnapChange = useCallback((minute: number) => {
    if (!touchRef.current || dragRef.current.currentMinute === minute) {
      return;
    }

    hapticSnapTick();
  }, []);

  const updatePreview = useCallback(
    (currentMinute: number) => {
      const el = previewRef.current;
      if (!el) return;
      const { firstHour, pixelsPerHour, checkCollision } = propsRef.current;
      const start = dragRef.current.startMinute;
      const style = getDragToCreatePreviewStyle(
        start,
        currentMinute,
        firstHour,
        pixelsPerHour
      );
      if (!style) {
        hidePreview();

        return;
      }
      const key = `${style.top}:${style.height}`;
      if (dragRef.current.previewKey !== key) {
        el.style.top = style.top;
        el.style.height = style.height;
        dragRef.current.previewKey = key;
      }
      const hasCollision =
        checkCollision?.(
          Math.min(start, currentMinute),
          Math.max(start, currentMinute)
        ) ?? false;
      if (hasCollision) {
        el.setAttribute('data-collision', 'true');
      } else {
        el.removeAttribute('data-collision');
      }
      el.style.display = 'block';
      containerRef.current?.setAttribute('data-drag-to-create-active', 'true');
    },
    [hidePreview]
  );

  const activateTouchDrag = useCallback(
    (clientY: number) => {
      const touch = touchRef.current;
      if (!touch || !touch.pending || touch.isScrolling) {
        return;
      }

      touch.pending = false;
      const minute = getMinuteFromY(clientY);
      const d = dragRef.current;
      d.active = true;
      d.startMinute = minute;
      d.currentMinute = minute;
      d.didDrag = false;
      hapticDragPick();
      updatePreview(minute);
    },
    [getMinuteFromY, updatePreview]
  );

  const attachTouchWindowListeners = useCallback(() => {
    removeTouchListenersRef.current?.();

    const onTouchMove = (event: TouchEvent) => {
      const touchState = touchRef.current;
      if (!touchState) return;

      const touch = getTouchById(event.touches, touchState.touchId);
      if (!touch) return;

      const deltaX = touch.clientX - touchState.startX;
      const deltaY = touch.clientY - touchState.startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (touchState.pending && !dragRef.current.active) {
        if (distance > TOUCH_SCROLL_THRESHOLD_PX) {
          touchState.isScrolling = true;
          if (touchState.activationTimer) {
            clearTimeout(touchState.activationTimer);
            touchState.activationTimer = null;
          }
        }

        return;
      }

      if (!dragRef.current.active) {
        return;
      }

      event.preventDefault();
      const minute = getMinuteFromY(touch.clientY);
      const d = dragRef.current;
      if (minute !== d.startMinute) {
        d.didDrag = true;
      }
      if (minute === d.currentMinute) {
        return;
      }

      maybeHapticOnSnapChange(minute);
      d.currentMinute = minute;
      updatePreview(minute);
    };

    const finishTouch = (event: TouchEvent) => {
      const touchState = touchRef.current;
      if (!touchState) return;

      const touch = getTouchById(event.changedTouches, touchState.touchId);
      if (!touch) return;

      if (!dragRef.current.active) {
        clearTouchGesture();

        return;
      }

      finishDragSelection(getMinuteFromY(touch.clientY), clearTouchGesture);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', finishTouch);
    window.addEventListener('touchcancel', finishTouch);
    removeTouchListenersRef.current = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', finishTouch);
      window.removeEventListener('touchcancel', finishTouch);
    };
  }, [
    clearTouchGesture,
    finishDragSelection,
    getMinuteFromY,
    maybeHapticOnSnapChange,
    updatePreview
  ]);

  const attachWindowListeners = useCallback(() => {
    removeListenersRef.current?.();

    const onMove = (event: MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const minute = getMinuteFromY(event.clientY);
      if (minute !== d.startMinute) d.didDrag = true;
      if (minute === d.currentMinute) return;
      d.currentMinute = minute;
      updatePreview(minute);
    };

    const onUp = (event: MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      finishDragSelection(getMinuteFromY(event.clientY));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current.active) return;
      event.preventDefault();
      event.stopPropagation();
      cancelDrag();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKeyDown, true);
    removeListenersRef.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [cancelDrag, finishDragSelection, getMinuteFromY, updatePreview]);

  useEffect(() => {
    const onCancel = () => {
      if (dragRef.current.active || touchRef.current) {
        cancelDrag();
      }
    };
    window.addEventListener(CALENDAR_CANCEL_SLOT_DRAG_EVENT, onCancel);

    return () =>
      window.removeEventListener(CALENDAR_CANCEL_SLOT_DRAG_EVENT, onCancel);
  }, [cancelDrag]);

  useEffect(() => clearDrag, [clearDrag]);

  // Mouse-only: touch drags go through the long-press touch handlers below, so
  // a touch-synthesized mouse event must never start a mouse drag session.
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const { canCreate } = propsRef.current;
      if (!canCreate || event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }
      const minute = getMinuteFromY(event.clientY);
      const d = dragRef.current;
      d.active = true;
      d.startMinute = minute;
      d.currentMinute = minute;
      d.didDrag = false;
      attachWindowListeners();
    },
    [attachWindowListeners, getMinuteFromY]
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent) => {
      const { canCreate } = propsRef.current;
      if (!canCreate) return;
      if (event.touches.length !== 1) return;
      if (isCalendarPanSkipTarget(event.target)) return;

      const touch = event.touches[0];
      if (!touch) return;

      clearTouchGesture();

      const touchState: TouchGestureState = {
        touchId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        pending: true,
        isScrolling: false,
        activationTimer: null
      };
      touchRef.current = touchState;

      attachTouchWindowListeners();

      touchState.activationTimer = setTimeout(() => {
        const currentTouch = touchRef.current;
        if (!currentTouch || currentTouch.touchId !== touch.identifier) {
          return;
        }

        activateTouchDrag(currentTouch.startY);
      }, TOUCH_LONG_PRESS_MS);
    },
    [activateTouchDrag, attachTouchWindowListeners, clearTouchGesture]
  );

  const handleTouchMove = useCallback((event: ReactTouchEvent) => {
    const touchState = touchRef.current;
    if (!touchState || !touchState.pending || dragRef.current.active) {
      return;
    }

    const touch = getTouchById(event.touches, touchState.touchId);
    if (!touch) return;

    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= TOUCH_SCROLL_THRESHOLD_PX) {
      return;
    }

    touchState.isScrolling = true;
    if (touchState.activationTimer) {
      clearTimeout(touchState.activationTimer);
      touchState.activationTimer = null;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  const handleSlotClick = useCallback((hour: number, minute: number) => {
    const d = dragRef.current;
    if (d.suppressClick) {
      d.suppressClick = false;

      return;
    }
    propsRef.current.onClick(hour, minute);
  }, []);

  return {
    containerRef,
    previewRef,
    handlePointerDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchCancel,
    handleSlotClick
  };
}
