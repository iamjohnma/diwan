import { useCallback, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

function shouldToggleOnPointerDown(
  event: Pick<PointerEvent<HTMLElement>, 'button' | 'pointerType'>
): boolean {
  return event.button === 0 && event.pointerType === 'mouse';
}

function shouldToggleOnClick(
  event: Pick<MouseEvent<HTMLElement>, 'button'>,
  toggledOnPointerDown: boolean
): boolean {
  return event.button === 0 && !toggledOnPointerDown;
}

// Opens/closes a panel from a button while feeling right for both input types:
// a mouse toggles on pointer-down (snappy), while touch/pen wait for the click
// so a tap that turns into a scroll doesn't fling the panel open. The ref
// dedupes the click that trails a mouse pointer-down so mouse toggles once.
export function usePointerToggle(toggle: () => void) {
  const didToggleOnPointerDownRef = useRef(false);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!shouldToggleOnPointerDown(event)) {
        return;
      }

      didToggleOnPointerDownRef.current = true;
      toggle();
    },
    [toggle]
  );

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const toggledOnPointerDown = didToggleOnPointerDownRef.current;
      didToggleOnPointerDownRef.current = false;

      if (shouldToggleOnClick(event, toggledOnPointerDown)) {
        toggle();
      }
    },
    [toggle]
  );

  return { onPointerDown, onClick };
}
