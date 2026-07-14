import { type MouseEvent, type PointerEvent, useCallback, useRef } from 'react';
import { useTouchScreen } from '@/hooks/common';

function noopPointerHandler<E extends Element>(_event: PointerEvent<E>): void {}

const pointerNoops = {
  onPointerDown: noopPointerHandler,
  onPointerUp: noopPointerHandler,
  onPointerCancel: noopPointerHandler
} as const;

export type MouseImmediatePressEvent<T extends Element = Element> =
  | PointerEvent<T>
  | MouseEvent<T>;

// Mouse fires on pointer-down (snappy navigation); touch/pen wait for the
// committed click so a press that becomes a scroll does not navigate. The
// trailing mouse click is swallowed so a single press only acts once.
export function useMouseImmediatePress() {
  const touchScreen = useTouchScreen();
  const skipNextClickRef = useRef(false);
  const pointerUpCleanupTimeoutRef = useRef<number | null>(null);

  const clearPointerUpCleanup = useCallback(() => {
    const id = pointerUpCleanupTimeoutRef.current;
    if (id === null) return;
    window.clearTimeout(id);
    pointerUpCleanupTimeoutRef.current = null;
  }, []);

  const bindPress = useCallback(
    (
      onPress: (event: MouseImmediatePressEvent<Element>) => void,
      canHandleMouseImmediatePress?: (event: PointerEvent<Element>) => boolean
    ) => {
      if (touchScreen.isPrimaryTouch) {
        return { ...pointerNoops, onClick: onPress };
      }

      return {
        onPointerDown: (event: PointerEvent<Element>) => {
          if (
            event.pointerType !== 'mouse' ||
            event.button !== 0 ||
            (canHandleMouseImmediatePress &&
              !canHandleMouseImmediatePress(event))
          ) {
            return;
          }
          clearPointerUpCleanup();
          skipNextClickRef.current = true;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture unsupported */
          }
          onPress(event);
        },
        onPointerUp: (event: PointerEvent<Element>) => {
          if (event.pointerType !== 'mouse' || !skipNextClickRef.current)
            return;
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          clearPointerUpCleanup();
          pointerUpCleanupTimeoutRef.current = window.setTimeout(() => {
            pointerUpCleanupTimeoutRef.current = null;
            skipNextClickRef.current = false;
          }, 0);
        },
        onPointerCancel: (event: PointerEvent<Element>) => {
          if (
            event.pointerType === 'mouse' &&
            event.currentTarget.hasPointerCapture?.(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          clearPointerUpCleanup();
          skipNextClickRef.current = false;
        },
        onClick: (event: MouseEvent<Element>) => {
          if (!skipNextClickRef.current) {
            onPress(event);

            return;
          }
          skipNextClickRef.current = false;
          clearPointerUpCleanup();
          event.preventDefault();
          event.stopPropagation();
        }
      };
    },
    [clearPointerUpCleanup, touchScreen.isPrimaryTouch]
  );

  return { bindPress };
}
