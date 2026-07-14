import { type ReactNode, useCallback, useEffect, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { type VirtualItem, useVirtualizer } from '@tanstack/react-virtual';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import {
  DialogWrapperActions,
  DialogWrapperHeader
} from '@/components/dialogts/common/dialog-wrapper/dialog-wrapper';
import { Dialog, DialogContent } from '@/components/dialogts/dialog';
import { FloatingListSlabLayer } from '@/components/ui/floating-list-slab';
import { Input } from '@/components/ui/input';
import {
  FLOATING_LIST_HIGHLIGHT_ITEM_ATTR,
  shouldHighlightFromPointer,
  useFloatingListHighlight
} from '@/hooks/common/floating-list-highlight';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { cn } from '@/utils/common/cn';

interface DialogListWrapperProps<T extends { id: string }> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleExtra?: ReactNode;
  icon: Icon;
  items: T[];
  renderItem: (props: {
    item: T;
    isPendingItem: boolean;
    isDisabledItem: boolean;
  }) => ReactNode;
  renderRow?: (props: {
    item: T;
    style: React.CSSProperties;
    children: ReactNode;
  }) => ReactNode;
  onItemSelect: (item: T) => void;
  getItemDisabled?: (item: T) => boolean;
  isLoading: boolean;
  isFetching?: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  emptyMessage?: string;
  emptyState?: ReactNode;
  searchPlaceholder?: string;
  estimateSize?: number;
  maxWidth?: string;
  action?: ReactNode;
  searchRowExtra?: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  /**
   * Enables keyboard navigation of the list: the first item is highlighted and
   * re-highlighted whenever the search term changes, ArrowUp/ArrowDown move the
   * highlight, and Enter selects the highlighted item.
   */
  enableKeyboardNavigation?: boolean;
}

interface DialogListContentProps<T extends { id: string }> extends Omit<
  DialogListWrapperProps<T>,
  'onItemSelect' | 'enableKeyboardNavigation'
> {
  enableKeyboardNavigation: boolean;
  pendingItemId: string | null;
  onSelect: (item: T) => void;
}

const LOAD_MORE_SCROLL_THRESHOLD_PX = 160;
const LOAD_MORE_ROW_THRESHOLD = 6;

function getVirtualRowStyle(virtualItem: VirtualItem): React.CSSProperties {
  return {
    height: `${virtualItem.size}px`,
    transform: `translateY(${virtualItem.start}px)`
  };
}

function DialogListContent<T extends { id: string }>(
  props: DialogListContentProps<T>
) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );

  const maxWidth = props.maxWidth ?? 'md:max-w-[480px]';
  const estimateSize = props.estimateSize ?? 56;
  const hasFooter = !!(props.cancelLabel && props.confirmLabel);

  // Render each row through its own component instance. `renderItem` may call
  // hooks (e.g. useTranslation), so invoking it as a plain function inline
  // would fold those hooks into this component's hook list — and since the
  // number of visible rows changes as the list loads/filters/scrolls, the
  // hook count would vary between renders and violate the Rules of Hooks.
  const RenderItem = props.renderItem;

  const virtualizer = useVirtualizer({
    count: props.items.length + (props.hasNextPage ? 1 : 0),
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    overscan: 5,
    paddingStart: 8,
    paddingEnd: 8
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = props;
  const isFetching = props.isFetching ?? false;
  const showLoadingOverlay =
    !props.isLoading && isFetching && !props.isFetchingNextPage;
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItemIndex = virtualItems.at(-1)?.index ?? -1;

  // Keyboard navigation with the shared sliding highlight slab. `resetKey` ties
  // the highlight back to the first item whenever the search term changes; the
  // slab (rendered below, inside the scroll container) measures the highlighted
  // row's DOM node and springs between rows like the rest of the app's lists.
  const keyboardNavEnabled = props.enableKeyboardNavigation;
  // The sliding highlight slab tracks the mouse and arrow keys. On primary-touch
  // devices (phones/tablets) there's no cursor, so it would just slide under the
  // finger as you tap/scroll — drop it there entirely. Mouse/keyboard devices
  // (incl. touch laptops) keep it; touch pointers are also ignored below.
  const touchScreen = useTouchScreen();
  const highlightEnabled = keyboardNavEnabled && !touchScreen.isPrimaryTouch;
  const listNavigation = useFloatingListHighlight<T>({
    isOpen: props.open && highlightEnabled,
    items: props.items,
    getItemKey: (item) => item.id,
    listContainerElement: scrollElement,
    resetKey: props.searchQuery,
    initialIndex: 0,
    // Keyboard steps let the slab scroll itself (so it can tell a smooth slide
    // from an instant jump); only the initial/reset jumps go through the
    // virtualizer, which renders an otherwise off-screen first row so the slab
    // has a DOM node to measure.
    onScrollToItem: (_item, index, reason) => {
      if (reason !== 'keyboard') {
        virtualizer.scrollToIndex(index, { align: 'auto' });
      }
    }
  });
  const {
    highlightedIndex,
    highlightedIndexRef,
    requestHighlightForIndex,
    slabHighlight
  } = listNavigation;

  const keyboardNavActive =
    props.open &&
    highlightEnabled &&
    !props.isLoading &&
    props.items.length > 0 &&
    props.pendingItemId === null;

  useHotkey(
    'Enter',
    (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || event.defaultPrevented) {
        return;
      }

      const index = highlightedIndexRef.current;
      const item = index >= 0 ? props.items[index] : props.items[0];
      if (
        !item ||
        props.pendingItemId !== null ||
        (props.getItemDisabled?.(item) ?? false)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      props.onSelect(item);
    },
    {
      enabled: keyboardNavActive && !isFetching,
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false
    }
  );

  useHotkey(
    'ArrowDown',
    (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      listNavigation.onArrowDown();
    },
    {
      enabled: keyboardNavActive,
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false
    }
  );

  useHotkey(
    'ArrowUp',
    (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      listNavigation.onArrowUp();
    },
    {
      enabled: keyboardNavActive,
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false
    }
  );

  const itemCount = props.items.length;

  const maybeFetchNextPage = useCallback(
    (remainingScrollPx?: number) => {
      if (!hasNextPage || isFetching || isFetchingNextPage || itemCount === 0) {
        return;
      }

      const isNearEnd =
        lastVirtualItemIndex >= itemCount - LOAD_MORE_ROW_THRESHOLD ||
        (remainingScrollPx !== undefined &&
          remainingScrollPx <= LOAD_MORE_SCROLL_THRESHOLD_PX);

      if (isNearEnd) {
        void fetchNextPage();
      }
    },
    [
      fetchNextPage,
      hasNextPage,
      isFetching,
      isFetchingNextPage,
      lastVirtualItemIndex,
      itemCount
    ]
  );

  useEffect(() => {
    maybeFetchNextPage();
  }, [maybeFetchNextPage]);

  const handleScroll = useCallback(() => {
    if (!scrollElement) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const remainingScrollPx = scrollHeight - scrollTop - clientHeight;

    maybeFetchNextPage(remainingScrollPx);
  }, [scrollElement, maybeFetchNextPage]);

  useEffect(() => {
    if (!scrollElement) return;
    scrollElement.addEventListener('scroll', handleScroll);

    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [scrollElement, handleScroll]);

  return (
    <DialogContent
      className={cn(maxWidth, 'gap-0 p-0 overflow-hidden')}
      showCloseButton
    >
      <DialogWrapperHeader
        title={props.title}
        icon={props.icon}
        titleExtra={props.titleExtra}
      />
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        <Input
          className="flex-1 min-w-0"
          value={props.searchQuery}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={props.searchPlaceholder}
          prefixIcon={
            <MagnifyingGlassIcon className="size-5" weight="regular" />
          }
          autoFocus
        />
        {props.searchRowExtra}
        {props.action}
      </div>
      <div className="relative min-h-0 h-[min(408px,calc(100svh_-_180px))] overflow-hidden">
        <div
          ref={setScrollElement}
          className={cn(
            'relative h-full overflow-x-hidden overflow-y-auto overscroll-contain px-1 transition-opacity duration-150',
            showLoadingOverlay && 'opacity-45'
          )}
        >
          {highlightEnabled && (
            <FloatingListSlabLayer
              slab={slabHighlight}
              show
              motionKey="dialog-list-highlight"
              roundedClassName="rounded-lg"
            />
          )}
          {props.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner removePadding className="size-5" />
            </div>
          ) : props.items.length === 0 ? (
            props.emptyState ? (
              <div className="flex items-center justify-center py-12 px-6">
                {props.emptyState}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-text-secondary">
                {props.emptyMessage}
              </div>
            )
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualItem) => {
                const itemStyle = getVirtualRowStyle(virtualItem);

                if (virtualItem.index >= props.items.length) {
                  return (
                    <div
                      key="dialog-list-loader"
                      style={itemStyle}
                      className="absolute inset-x-0 top-0 flex items-center justify-center"
                    >
                      {props.isFetchingNextPage ? (
                        <LoadingSpinner removePadding className="size-4" />
                      ) : null}
                    </div>
                  );
                }

                const item = props.items[virtualItem.index];
                if (!item) return null;
                const isPendingItem = props.pendingItemId === item.id;
                const isDisabledItem = props.getItemDisabled?.(item) ?? false;
                const itemContent = (
                  <RenderItem
                    item={item}
                    isPendingItem={isPendingItem}
                    isDisabledItem={isDisabledItem}
                  />
                );

                if (props.renderRow) {
                  return (
                    <div key={item.id}>
                      {props.renderRow({
                        item,
                        style: itemStyle,
                        children: itemContent
                      })}
                    </div>
                  );
                }

                const isActiveItem =
                  highlightEnabled && highlightedIndex === virtualItem.index;

                return (
                  <button
                    key={item.id}
                    type="button"
                    {...{ [FLOATING_LIST_HIGHLIGHT_ITEM_ATTR]: item.id }}
                    onClick={() => props.onSelect(item)}
                    onPointerMove={
                      highlightEnabled && !isDisabledItem
                        ? (event) => {
                            // Mouse-only: touch pointermove (tap/scroll) must not
                            // drag the highlight slab under the finger.
                            if (event.pointerType !== 'mouse') {
                              return;
                            }
                            if (
                              shouldHighlightFromPointer(
                                event.clientX,
                                event.clientY
                              )
                            ) {
                              requestHighlightForIndex(virtualItem.index);
                            }
                          }
                        : undefined
                    }
                    disabled={props.pendingItemId !== null || isDisabledItem}
                    data-active-item={isActiveItem ? 'true' : undefined}
                    style={itemStyle}
                    className={cn(
                      'absolute inset-x-0 top-0 z-10 flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg px-3 py-2 transition-colors disabled:cursor-default disabled:opacity-60',
                      !keyboardNavEnabled && 'hover:bg-secondary/40'
                    )}
                  >
                    {itemContent}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {showLoadingOverlay && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <LoadingSpinner removePadding className="size-5 text-primary" />
          </div>
        )}
      </div>
      {hasFooter && (
        <DialogWrapperActions
          cancelLabel={props.cancelLabel}
          confirmLabel={props.confirmLabel}
          onConfirm={props.onConfirm}
          confirmDisabled={props.confirmDisabled}
        />
      )}
    </DialogContent>
  );
}

export function DialogListWrapper<T extends { id: string }>(
  props: DialogListWrapperProps<T>
) {
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const { onItemSelect, enableKeyboardNavigation, ...contentProps } = props;

  useEffect(() => {
    if (props.open) {
      setPendingItemId(null);
    }
  }, [props.open]);

  const getItemDisabled = props.getItemDisabled;
  const handleSelect = useCallback(
    (item: T) => {
      if (getItemDisabled?.(item)) return;
      setPendingItemId(item.id);
      onItemSelect(item);
    },
    [getItemDisabled, onItemSelect]
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogListContent
        {...contentProps}
        enableKeyboardNavigation={enableKeyboardNavigation ?? false}
        pendingItemId={pendingItemId}
        onSelect={handleSelect}
      />
    </Dialog>
  );
}
