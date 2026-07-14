import * as React from 'react';
import {
  type FloatingSlabState,
  getFloatingSlabLayout
} from '@/components/ui/floating-list-slab';
import { scrollItemToContainerCenter } from '@/utils/common/center-item-scroll';

export const FLOATING_LIST_HIGHLIGHT_ITEM_ATTR =
  'data-floating-list-highlight-item';

export type FloatingListHighlightScrollReason =
  'initial' | 'keyboard' | 'reset';

interface UseFloatingListHighlightProps<T> {
  isOpen: boolean;
  items: T[];
  getItemKey: (item: T) => string | number;
  listContainerElement: HTMLElement | null;
  resetKey?: string | number | boolean | null;
  initialIndex?: number;
  itemAttribute?: string;
  onScrollToItem?: (
    item: T,
    index: number,
    reason: FloatingListHighlightScrollReason
  ) => void;
}

const clampIndex = (index: number, length: number) =>
  length <= 0 ? -1 : Math.max(0, Math.min(index, length - 1));

const getInitialIndex = (initialIndex: number | undefined, length: number) =>
  length <= 0
    ? -1
    : initialIndex == null || initialIndex < 0
      ? 0
      : clampIndex(initialIndex, length);

/**
 * Shared pointer-intent tracking used to tell genuine cursor movement apart
 * from scroll-induced synthetic pointer events.
 *
 * When navigation scrolls a new item under a stationary cursor, the browser
 * fires `pointerenter`/`pointermove` on that item with the *same* client
 * coordinates as before. Without this guard those events hijack the keyboard
 * highlight, snapping it to whatever item slid under the mouse (typically near
 * the top of the viewport) instead of advancing to the intended item.
 */
const pointerIntent = {
  lastX: null as number | null,
  lastY: null as number | null,
  keyboardActive: false
};

/** Suspend pointer-driven highlighting until the cursor genuinely moves. */
function suspendPointerHighlightUntilMove() {
  pointerIntent.keyboardActive = true;
}

/**
 * Whether a pointer event represents genuine cursor movement that should drive
 * the highlight. Scroll-induced events (unchanged coordinates) are ignored, and
 * while navigation is active only measurable movement hands control back to the
 * pointer.
 */
export function shouldHighlightFromPointer(
  clientX: number,
  clientY: number
): boolean {
  const { lastX, lastY, keyboardActive } = pointerIntent;
  pointerIntent.lastX = clientX;
  pointerIntent.lastY = clientY;

  if (keyboardActive) {
    if (lastX === null || (clientX === lastX && clientY === lastY)) {
      return false;
    }
    pointerIntent.keyboardActive = false;

    return true;
  }

  return lastX === null || clientX !== lastX || clientY !== lastY;
}

export function useFloatingListHighlight<T>(
  props: UseFloatingListHighlightProps<T>
) {
  const {
    isOpen,
    items,
    getItemKey,
    listContainerElement,
    resetKey = null,
    initialIndex,
    itemAttribute = FLOATING_LIST_HIGHLIGHT_ITEM_ATTR,
    onScrollToItem
  } = props;

  const length = items.length;
  const [highlightedIndex, setHighlightedIndexState] = React.useState(-1);
  const [slabHighlight, setSlabHighlight] =
    React.useState<FloatingSlabState | null>(null);

  const highlightedIndexRef = React.useRef(-1);
  const itemsRef = React.useRef(items);
  const getItemKeyRef = React.useRef(getItemKey);
  const onScrollToItemRef = React.useRef(onScrollToItem);
  const pendingScrollReasonRef =
    React.useRef<FloatingListHighlightScrollReason | null>(null);
  const prevOpenRef = React.useRef(false);
  const prevResetKeyRef = React.useRef(resetKey);
  const prevListContainerElementRef = React.useRef<HTMLElement | null>(null);

  itemsRef.current = items;
  getItemKeyRef.current = getItemKey;
  onScrollToItemRef.current = onScrollToItem;

  const scrollToHighlightedItem = React.useCallback(
    (index: number, reason: FloatingListHighlightScrollReason) => {
      const item = itemsRef.current[index];
      if (!item) return;
      suspendPointerHighlightUntilMove();
      pendingScrollReasonRef.current = reason;
      onScrollToItemRef.current?.(item, index, reason);
    },
    []
  );

  const requestHighlightForIndex = React.useCallback(
    (
      index: number,
      options?: {
        scroll?: boolean;
        reason?: FloatingListHighlightScrollReason;
      }
    ) => {
      const nextIndex = clampIndex(index, length);
      if (nextIndex < 0) {
        setHighlightedIndexState(-1);

        return;
      }
      if (options?.scroll) {
        scrollToHighlightedItem(nextIndex, options.reason ?? 'keyboard');
      }
      setHighlightedIndexState(nextIndex);
    },
    [length, scrollToHighlightedItem]
  );

  React.useLayoutEffect(() => {
    const containerChanged =
      prevListContainerElementRef.current !== listContainerElement;
    prevListContainerElementRef.current = listContainerElement;

    if (!isOpen || length === 0) {
      prevOpenRef.current = isOpen;
      prevResetKeyRef.current = resetKey;
      setHighlightedIndexState(-1);

      return;
    }

    const opened = !prevOpenRef.current && isOpen;
    const resetChanged = !Object.is(prevResetKeyRef.current, resetKey);
    prevOpenRef.current = isOpen;
    prevResetKeyRef.current = resetKey;

    if (opened || resetChanged || (containerChanged && listContainerElement)) {
      const current = highlightedIndexRef.current;
      const nextIndex =
        opened || resetChanged || current < 0
          ? getInitialIndex(initialIndex, length)
          : clampIndex(current, length);
      scrollToHighlightedItem(
        nextIndex,
        opened ? 'initial' : resetChanged ? 'reset' : 'initial'
      );
      setHighlightedIndexState(nextIndex);

      return;
    }

    setHighlightedIndexState((prev) =>
      prev < 0
        ? getInitialIndex(initialIndex, length)
        : clampIndex(prev, length)
    );
  }, [
    initialIndex,
    isOpen,
    length,
    listContainerElement,
    resetKey,
    scrollToHighlightedItem
  ]);

  const effectiveIndex =
    !isOpen || length === 0 ? -1 : clampIndex(highlightedIndex, length);
  highlightedIndexRef.current = effectiveIndex;

  const stepHighlight = React.useCallback(
    (index: number) => {
      if (!isOpen || length === 0) return;
      requestHighlightForIndex(index, { scroll: true, reason: 'keyboard' });
    },
    [isOpen, length, requestHighlightForIndex]
  );

  const onArrowDown = React.useCallback(
    () => stepHighlight(highlightedIndexRef.current + 1),
    [stepHighlight]
  );

  const onArrowUp = React.useCallback(
    () => stepHighlight(Math.max(0, highlightedIndexRef.current - 1)),
    [stepHighlight]
  );

  React.useLayoutEffect(() => {
    if (
      effectiveIndex < 0 ||
      !isOpen ||
      length === 0 ||
      !listContainerElement
    ) {
      setSlabHighlight(null);

      return;
    }

    const container = listContainerElement;
    let cancelled = false;
    let rafChain = 0;
    let scrollSyncRaf = 0;
    let doubleRafOuter = 0;
    let doubleRafInner = 0;
    let attempts = 0;

    const applySlab = (): boolean => {
      if (cancelled) return false;

      const idx = highlightedIndexRef.current;
      if (idx < 0 || !isOpen) {
        setSlabHighlight(null);

        return false;
      }

      const item = itemsRef.current[idx];
      const listEl = listContainerElement;
      if (!item || !listEl) {
        setSlabHighlight(null);

        return false;
      }

      const key = getItemKeyRef.current(item);
      const el = listEl.querySelector(
        `[${itemAttribute}="${CSS.escape(String(key))}"]`
      );
      if (!(el instanceof HTMLElement)) return false;
      if (listEl.clientWidth === 0 || el.getBoundingClientRect().height === 0) {
        return false;
      }

      const pendingReason = pendingScrollReasonRef.current;
      const shouldScroll = pendingReason !== null;
      let scrollChanged = false;
      if (shouldScroll) {
        pendingScrollReasonRef.current = null;
        const scrollBefore = listEl.scrollTop;
        // Opening the list (or resetting after a search change) centers the
        // active/selected row so it lands in the middle instead of pinned to
        // the bottom edge. Keyboard steps keep `nearest` so arrowing only
        // nudges by the minimum amount rather than re-centering every press.
        if (pendingReason === 'keyboard') {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
          scrollItemToContainerCenter(el, listEl);
        }
        scrollChanged = Math.abs(listEl.scrollTop - scrollBefore) > 0.5;
      }

      setSlabHighlight({
        layout: getFloatingSlabLayout(el, listEl),
        itemKey: String(key),
        instantTransition: shouldScroll && scrollChanged
      });

      return true;
    };

    const scheduleApply = () => {
      if (!cancelled) applySlab();
    };

    const tryApplySlab = () => {
      if (cancelled || applySlab() || ++attempts >= 64) return;
      rafChain = requestAnimationFrame(tryApplySlab);
    };

    tryApplySlab();
    queueMicrotask(scheduleApply);
    const timeout0Id = window.setTimeout(scheduleApply, 0);
    doubleRafOuter = requestAnimationFrame(() => {
      doubleRafInner = requestAnimationFrame(scheduleApply);
    });

    const onScroll = () => {
      if (scrollSyncRaf) return;
      scrollSyncRaf = requestAnimationFrame(() => {
        scrollSyncRaf = 0;
        scheduleApply();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleApply)
        : null;
    resizeObserver?.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafChain);
      cancelAnimationFrame(doubleRafOuter);
      cancelAnimationFrame(doubleRafInner);
      window.clearTimeout(timeout0Id);
      if (scrollSyncRaf) cancelAnimationFrame(scrollSyncRaf);
      container.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
    };
  }, [
    effectiveIndex,
    highlightedIndex,
    isOpen,
    itemAttribute,
    length,
    listContainerElement,
    resetKey
  ]);

  return React.useMemo(
    () => ({
      highlightedIndex: effectiveIndex,
      highlightedIndexRef,
      slabHighlight,
      requestHighlightForIndex,
      onArrowDown,
      onArrowUp
    }),
    [
      effectiveIndex,
      slabHighlight,
      requestHighlightForIndex,
      onArrowDown,
      onArrowUp
    ]
  );
}
