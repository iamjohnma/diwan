import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

interface UseTruncateTextOptions {
  children: ReactNode;
  title?: string;
}

function getTruncatedTitle(
  element: HTMLElement,
  titleOverride?: string
): string | undefined {
  // Height overflow covers the multiline (line-clamp) mode; the 1px slack
  // absorbs line-height rounding so an unclamped element never reads as
  // overflowing.
  if (
    element.scrollWidth <= element.clientWidth &&
    element.scrollHeight <= element.clientHeight + 1
  ) {
    return undefined;
  }

  const text = titleOverride ?? element.textContent?.trim();

  return text || undefined;
}

export function useTruncateText(options: UseTruncateTextOptions) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const rafId = useRef<number | null>(null);

  const sync = useCallback(() => {
    const element = elementRef.current;
    if (!element) {
      setTitle(undefined);

      return;
    }

    const nextTitle = getTruncatedTitle(element, options.title);
    setTitle((previous) => (previous === nextTitle ? previous : nextTitle));
  }, [options.title]);

  const schedule = useCallback(() => {
    if (rafId.current !== null) {
      return;
    }

    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      sync();
    });
  }, [sync]);

  useEffect(() => {
    sync();
  }, [options.children, sync]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(schedule)
        : null;
    resizeObserver?.observe(element);

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [options.children, schedule, sync]);

  return {
    elementRef: elementRef as RefObject<HTMLElement | null>,
    title
  };
}
