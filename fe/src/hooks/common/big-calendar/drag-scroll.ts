import { useEffect } from 'react';
import { VIEWPORT_SELECTOR } from '@/constants/common/big-calendar';

const EDGE_ZONE = 40;
const MAX_SPEED = 10;

function pointInRect(x: number, y: number, rect: DOMRect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

interface DragScrollStateControls {
  subscribeDragState: (listener: () => void) => () => void;
  getIsDraggingEvent: () => boolean;
}

export function useDragScroll(
  dragStateControls: DragScrollStateControls,
  rootRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    let cleanupActiveDragListeners: (() => void) | null = null;

    const handleWheel = (event: WheelEvent) => {
      if (!dragStateControls.getIsDraggingEvent()) return;

      const root = rootRef.current;
      if (!root) return;

      let viewport: HTMLElement | null = null;
      for (const candidate of root.querySelectorAll<HTMLElement>(
        VIEWPORT_SELECTOR
      )) {
        if (
          pointInRect(
            event.clientX,
            event.clientY,
            candidate.getBoundingClientRect()
          )
        ) {
          viewport = candidate;
          break;
        }
      }
      if (!viewport) return;

      const canScrollY = viewport.scrollHeight > viewport.clientHeight;
      const canScrollX = viewport.scrollWidth > viewport.clientWidth;
      if (!canScrollY && !canScrollX) return;

      if (canScrollY && event.deltaY !== 0) viewport.scrollTop += event.deltaY;
      if (canScrollX) {
        const dx =
          event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;
        if (dx !== 0) viewport.scrollLeft += dx;
      }
      event.preventDefault();
    };

    const startDragScrollListeners = () => {
      if (cleanupActiveDragListeners) return;

      let lastTouchX = -1;
      let lastTouchY = -1;
      let rafId: number | null = null;

      const onTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (touch) {
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        }
      };

      const tick = () => {
        if (!dragStateControls.getIsDraggingEvent()) return;
        if (lastTouchX >= 0 && lastTouchY >= 0) {
          const root = rootRef.current;
          if (root) {
            for (const viewport of root.querySelectorAll<HTMLElement>(
              VIEWPORT_SELECTOR
            )) {
              if (viewport.scrollWidth <= viewport.clientWidth) continue;
              const rect = viewport.getBoundingClientRect();
              if (lastTouchY < rect.top || lastTouchY > rect.bottom) continue;

              const distLeft = lastTouchX - rect.left;
              const distRight = rect.right - lastTouchX;
              if (distLeft >= 0 && distLeft < EDGE_ZONE) {
                viewport.scrollBy({
                  left: -Math.ceil(MAX_SPEED * (1 - distLeft / EDGE_ZONE))
                });
              } else if (distRight >= 0 && distRight < EDGE_ZONE) {
                viewport.scrollBy({
                  left: Math.ceil(MAX_SPEED * (1 - distRight / EDGE_ZONE))
                });
              }
            }
          }
        }
        rafId = requestAnimationFrame(tick);
      };

      window.addEventListener('wheel', handleWheel, {
        capture: true,
        passive: false
      });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      rafId = requestAnimationFrame(tick);

      cleanupActiveDragListeners = () => {
        window.removeEventListener('wheel', handleWheel, true);
        window.removeEventListener('touchmove', onTouchMove);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    };

    const stopDragScrollListeners = () => {
      cleanupActiveDragListeners?.();
      cleanupActiveDragListeners = null;
    };

    const syncDragScrollListeners = () => {
      if (dragStateControls.getIsDraggingEvent()) {
        startDragScrollListeners();

        return;
      }

      stopDragScrollListeners();
    };

    syncDragScrollListeners();
    const unsubscribe = dragStateControls.subscribeDragState(
      syncDragScrollListeners
    );

    return () => {
      unsubscribe();
      stopDragScrollListeners();
    };
  }, [dragStateControls, rootRef]);
}
