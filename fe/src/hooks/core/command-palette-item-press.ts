import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef
} from 'react';

export function useCommandPaletteItemPress(onSelect: () => void) {
  const suppressClick = useRef(false);
  const timeout = useRef<number | null>(null);
  const clear = useCallback(() => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = null;
    suppressClick.current = false;
  }, []);
  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.pointerType !== 'mouse' ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      suppressClick.current = true;
      event.preventDefault();
      onSelect();
    },
    [onSelect]
  );
  const onPointerUp = useCallback(() => {
    if (suppressClick.current) timeout.current = window.setTimeout(clear, 0);
  }, [clear]);
  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!suppressClick.current) return;
      clear();
      event.preventDefault();
      event.stopPropagation();
    },
    [clear]
  );

  return { onPointerDown, onPointerUp, onClickCapture };
}
