import { useEffect, useReducer, useRef } from 'react';
import { useDndMonitor } from '@dnd-kit/core';

interface UseDropOverlayForceRenderOptions {
  hasDragStateChanged: () => boolean;
  onDragComplete?: () => void;
}

export function useDropOverlayForceRender(
  options: UseDropOverlayForceRenderOptions
) {
  const [, forceRender] = useReducer((state: number) => state + 1, 0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const frameRef = useRef<number | null>(null);

  const cancelScheduledCheck = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useDndMonitor({
    onDragMove() {
      // The drag refs this reads (snapped delta, day/doctor target) are mutated
      // by the *view's* drag monitor on this same pointer event. Both monitors
      // subscribe to one DndContext and fire in subscription order, which churns
      // every render (each passes a fresh listener), so the two can run in either
      // order. Reading the refs synchronously here can therefore see pre-update
      // values, report "no change", and skip the render â€” leaving the drop
      // indicator a step behind, or stuck at the origin on a short drag.
      //
      // Defer the check to the next frame: by then this pointer event's dispatch
      // is complete and every monitor has updated its refs, so we read the latest
      // values regardless of order. This also coalesces bursts of move events
      // into at most one render per frame.
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (optionsRef.current.hasDragStateChanged()) {
          forceRender();
        }
      });
    },
    onDragStart() {
      forceRender();
    },
    onDragEnd() {
      cancelScheduledCheck();
      optionsRef.current.onDragComplete?.();
      forceRender();
    },
    onDragCancel() {
      cancelScheduledCheck();
      optionsRef.current.onDragComplete?.();
      forceRender();
    }
  });
}
