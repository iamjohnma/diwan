import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchState } from '@/@types/common/components/big-calendar/dnd/draggable-event-badge/use-touch-scroll-passthrough';
import {
  CALENDAR_TOUCH_DRAG_ACTIVATION_DELAY_MS,
  CALENDAR_TOUCH_DRAG_HOLD_TOLERANCE_PX,
  CALENDAR_TOUCH_HOLD_FEEDBACK_LEAD_MS,
  CALENDAR_TOUCH_SCROLL_ACTIVATION_THRESHOLD_PX,
  CALENDAR_TOUCH_SCROLL_INTENT_WINDOW_MS
} from '@/constants/common/big-calendar';

const HOLD_FEEDBACK_DELAY_MS = Math.max(
  0,
  CALENDAR_TOUCH_DRAG_ACTIVATION_DELAY_MS - CALENDAR_TOUCH_HOLD_FEEDBACK_LEAD_MS
);

// dnd-kit's touch sensor keeps its delay timer running while this hook takes
// over scrolling â€” if the finger then slows down, the timer would still fire
// and hijack the scroll into a drag. The sensor attaches its listeners
// directly to the touchstart target, so a synthetic non-bubbling `touchcancel`
// dispatched at that node reaches its handleCancel (which reads no event data)
// without ever hitting our own React onTouchCancel handler up the tree â€” the
// passthrough scroll state stays alive for the rest of the gesture.
function cancelPendingDndTouchSensor(gestureTarget: EventTarget | null) {
  gestureTarget?.dispatchEvent(new Event('touchcancel'));
}

function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
  let current = element;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }

    if (current.getAttribute('data-slot') === 'scroll-area-viewport') {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

interface UseTouchScrollPassthroughOptions {
  shouldIgnoreTouch?: (target: EventTarget | null) => boolean;
}

export function useTouchScrollPassthrough(
  nodeRef: React.RefObject<HTMLDivElement | null>,
  canDrag: boolean,
  isMoveDragging: boolean,
  options?: UseTouchScrollPassthroughOptions
) {
  const touchStateRef = useRef<TouchState | null>(null);
  const holdFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [isTouchHoldFeedback, setIsTouchHoldFeedback] = useState(false);
  const shouldIgnoreTouch = options?.shouldIgnoreTouch;

  const clearHoldFeedback = useCallback(() => {
    if (holdFeedbackTimerRef.current !== null) {
      clearTimeout(holdFeedbackTimerRef.current);
      holdFeedbackTimerRef.current = null;
    }
    setIsTouchHoldFeedback(false);
  }, []);

  const scheduleHoldFeedback = useCallback(() => {
    if (holdFeedbackTimerRef.current !== null) {
      clearTimeout(holdFeedbackTimerRef.current);
    }
    holdFeedbackTimerRef.current = setTimeout(() => {
      holdFeedbackTimerRef.current = null;
      const state = touchStateRef.current;
      if (state && !state.isScrolling) {
        setIsTouchHoldFeedback(true);
      }
    }, HOLD_FEEDBACK_DELAY_MS);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!canDrag || shouldIgnoreTouch?.(e.target)) return;
      const touch = e.touches[0];
      if (!touch) return;

      clearHoldFeedback();
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isScrolling: false,
        lastX: touch.clientX,
        lastY: touch.clientY,
        gestureTarget: e.target
      };
      scheduleHoldFeedback();
    },
    [canDrag, clearHoldFeedback, scheduleHoldFeedback, shouldIgnoreTouch]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const state = touchStateRef.current;
      if (!state || !canDrag || shouldIgnoreTouch?.(e.target)) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const elapsed = Date.now() - state.startTime;
      const holdDistance = Math.hypot(deltaX, deltaY);

      if (holdDistance > CALENDAR_TOUCH_DRAG_HOLD_TOLERANCE_PX) {
        clearHoldFeedback();
      }

      if (
        !state.isScrolling &&
        elapsed < CALENDAR_TOUCH_SCROLL_INTENT_WINDOW_MS &&
        holdDistance > CALENDAR_TOUCH_SCROLL_ACTIVATION_THRESHOLD_PX
      ) {
        state.isScrolling = true;
        clearHoldFeedback();
        cancelPendingDndTouchSensor(state.gestureTarget);
      }

      if (state.isScrolling) {
        const scrollDeltaX = state.lastX - touch.clientX;
        const scrollDeltaY = state.lastY - touch.clientY;
        state.lastX = touch.clientX;
        state.lastY = touch.clientY;

        const scrollable = findScrollableParent(nodeRef.current);
        if (scrollable) {
          if (scrollDeltaX !== 0) scrollable.scrollLeft += scrollDeltaX;
          if (scrollDeltaY !== 0) scrollable.scrollTop += scrollDeltaY;
        }
      }
    },
    [canDrag, clearHoldFeedback, nodeRef, shouldIgnoreTouch]
  );

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = null;
    clearHoldFeedback();
  }, [clearHoldFeedback]);

  useEffect(() => {
    if (isMoveDragging) {
      touchStateRef.current = null;
      if (holdFeedbackTimerRef.current !== null) {
        clearTimeout(holdFeedbackTimerRef.current);
        holdFeedbackTimerRef.current = null;
      }
      setIsTouchHoldFeedback(true);
    } else {
      setIsTouchHoldFeedback(false);
    }
  }, [isMoveDragging]);

  useEffect(() => () => clearHoldFeedback(), [clearHoldFeedback]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isTouchHoldFeedback
  };
}
