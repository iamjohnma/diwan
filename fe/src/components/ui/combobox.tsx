import * as React from 'react';
import { searchTextIncludes } from '@diwan/shared/search-text';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { type VirtualItem, useVirtualizer } from '@tanstack/react-virtual';
import { Slot as SlotPrimitive } from 'radix-ui';
import {
  FloatingListHighlightItem,
  FloatingListHighlightLayer
} from '@/components/common/floating-list-highlight';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { TruncateText } from '@/components/common/truncate-text';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopoverMode
} from '@/components/ui/popover';
import { SearchField } from '@/components/ui/search-field';
import { useDropdownListNavigation } from '@/hooks/common/dropdown-list-navigation';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { assignRef } from '@/utils/common/assign-ref';
import {
  focusAutoFocusTarget,
  resolveAutoFocus
} from '@/utils/common/can-auto-focus';
import { cn } from '@/utils/common/cn';
import { handleFloatingOverlayWheelScroll } from '@/utils/common/floating-overlay-wheel-scroll';
import { hapticFromPointerEvent } from '@/utils/common/haptics';

const Slot = SlotPrimitive.Root;

type ComboboxMode = 'popover' | 'inline';
type ComboboxSelectionMode = 'single' | 'multiple';

type ComboboxContentProps = React.ComponentProps<typeof PopoverContent>;

interface ComboboxSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  isLoading?: boolean;
  showClearButton?: boolean;
  clearLabel?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  containerClassName?: string;
  inputClassName?: string;
}

interface ComboboxRenderTriggerContext<T> {
  open: boolean;
  disabled: boolean;
  selectedItem: T | undefined;
  selectedLabel: string | undefined;
  placeholder: string | undefined;
}

interface ComboboxRenderOptionContext {
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
  value: string;
  label: string;
  search: string;
}

interface ComboboxSectionHeaderContext<T> {
  sectionKey: string;
  sectionIndex: number;
  firstItem: T;
}

interface ComboboxVirtualizationProps {
  /** Estimated height of one option row, in pixels. */
  estimateItemSize: number;
  /** Estimated height added by a section header that precedes an option. */
  estimateSectionHeaderSize?: number;
  overscan?: number;
}

interface ComboboxProps<T> {
  items: T[];
  getItemValue: (item: T) => string;
  getItemLabel?: (item: T) => string;
  getItemSearchValue?: (item: T) => string;
  getItemDisabled?: (item: T) => boolean;
  getItemSectionKey?: (item: T) => string | null | undefined;

  value?: string | null;
  selectedValues?: Iterable<string>;
  onValueChange?: (value: string, item: T) => void;
  onItemSelect?: (item: T) => void;

  mode?: ComboboxMode;
  /** Multiple-selection lists open from their first row, not a selected row. */
  selectionMode?: ComboboxSelectionMode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnSelect?: boolean;
  openOnClick?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Marks the default trigger invalid (`data-invalid` + error border). */
  hasError?: boolean;

  search?: ComboboxSearchProps;
  filterItems?: boolean;
  isLoading?: boolean;
  loadingLabel?: React.ReactNode;
  emptyLabel?: React.ReactNode;
  noResultsLabel?: React.ReactNode;

  align?: ComboboxContentProps['align'];
  alignOffset?: ComboboxContentProps['alignOffset'];
  side?: ComboboxContentProps['side'];
  sideOffset?: ComboboxContentProps['sideOffset'];
  collisionPadding?: ComboboxContentProps['collisionPadding'];
  matchTriggerWidth?: boolean;

  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  panelClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  emptyClassName?: string;

  motionKey?: string;
  showHighlightSlab?: boolean;
  stopPropagation?: boolean;
  triggerAriaLabel?: string;

  renderTrigger?: (
    context: ComboboxRenderTriggerContext<T>
  ) => React.ReactElement;
  renderOption?: (
    item: T,
    context: ComboboxRenderOptionContext
  ) => React.ReactNode;
  renderSectionHeader?: (
    context: ComboboxSectionHeaderContext<T>
  ) => React.ReactNode;
  /** Only mount the visible window of options. Intended for large lists. */
  virtualization?: ComboboxVirtualizationProps;
  renderEmpty?: (context: {
    search: string;
    isSearchActive: boolean;
  }) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
}

const COMBOBOX_TRIGGER_CLASS_NAME =
  'flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-lg border border-border-default bg-background-base ps-3 pe-2 text-sm outline-none transition-[background-color,border-color,color,box-shadow] duration-[var(--motion-duration-surface)] ease-[var(--motion-ease-out)] focus-visible:ring-0.4 disabled:pointer-events-none disabled:opacity-50';

const COMBOBOX_PANEL_CLASS_NAME =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

const COMBOBOX_CONTENT_CLASS_NAME =
  'flex max-h-(--radix-popover-content-available-height) flex-col gap-0 overflow-hidden p-0';

const COMBOBOX_CONTENT_DRAWER_CLASS_NAME =
  'max-h-[85dvh] min-h-0 flex-1 flex-col overflow-hidden';

const COMBOBOX_PANEL_DRAWER_CLASS_NAME = 'min-h-0 flex-1 flex-col';

const COMBOBOX_LIST_DRAWER_CLASS_NAME = 'max-h-none min-h-0 flex-1 scroll-py-1';

const COMBOBOX_LIST_CLASS_NAME =
  'relative isolate max-h-64 min-h-0 flex-1 scroll-py-2 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5';

const COMBOBOX_LIST_TOUCH_CLASS_NAME = 'scroll-py-1 p-2';

const COMBOBOX_ITEM_CLASS_NAME =
  'relative z-10 flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-sm bg-transparent px-2.5 py-2 text-sm text-text-secondary outline-hidden select-none transition-[color] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_div]:text-inherit [&_p]:text-inherit [&_span]:text-inherit [&_svg]:text-inherit';

const COMBOBOX_ITEM_TOUCH_CLASS_NAME =
  'min-h-12 rounded-md px-3 py-3 text-base';

function getDefaultItemLabel<T>(item: T): string {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item);
  }

  if (item && typeof item === 'object') {
    if ('label' in item && typeof item.label === 'string') {
      return item.label;
    }
    if ('name' in item && typeof item.name === 'string') {
      return item.name;
    }
  }

  return '';
}

function useControllableOpen(props: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(
    props.defaultOpen ?? false
  );
  const isControlled = props.open !== undefined;
  const open = (isControlled ? props.open : internalOpen) ?? false;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      props.onOpenChange?.(nextOpen);
    },
    [isControlled, props]
  );

  return [open, setOpen] as const;
}

function normalizeSelectedValues(
  value: string | null | undefined,
  selectedValues: Iterable<string> | undefined
) {
  if (selectedValues) {
    return new Set(Array.from(selectedValues, String));
  }

  if (value == null || value === '') {
    return new Set<string>();
  }

  return new Set([String(value)]);
}

function Combobox<T>(props: ComboboxProps<T>) {
  const {
    items,
    getItemValue,
    getItemLabel = getDefaultItemLabel,
    getItemSearchValue,
    getItemDisabled,
    getItemSectionKey,
    value,
    selectedValues,
    onValueChange,
    onItemSelect,
    mode = 'popover',
    selectionMode = 'single',
    closeOnSelect,
    openOnClick,
    disabled = false,
    placeholder,
    hasError = false,
    search,
    filterItems = true,
    isLoading = false,
    loadingLabel,
    emptyLabel = null,
    noResultsLabel = emptyLabel,
    align = 'start',
    alignOffset,
    side,
    sideOffset = 6,
    collisionPadding = 16,
    matchTriggerWidth = true,
    className,
    triggerClassName,
    contentClassName,
    panelClassName,
    listClassName,
    itemClassName,
    emptyClassName,
    motionKey = 'combobox-highlight',
    showHighlightSlab = true,
    stopPropagation = false,
    triggerAriaLabel,
    renderTrigger,
    renderOption,
    renderSectionHeader,
    virtualization,
    renderEmpty,
    renderLoading
  } = props;

  const touchScreen = useTouchScreen();
  const popoverMode = usePopoverMode();
  const isDrawerPopover = popoverMode === 'drawer';
  const listId = React.useId();
  const [popoverOpen, setPopoverOpen] = useControllableOpen({
    open: props.open,
    defaultOpen: props.defaultOpen,
    onOpenChange: props.onOpenChange
  });
  const open = mode === 'inline' ? true : popoverOpen;
  const [listContainerElement, setListContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const selectedValueSet = React.useMemo(
    () => normalizeSelectedValues(value, selectedValues),
    [value, selectedValues]
  );
  const searchValue = search?.value ?? '';
  const isSearchActive = searchValue.trim().length > 0;

  const itemEntries = React.useMemo(
    () =>
      items.map((item) => {
        const itemValue = getItemValue(item);
        const label = getItemLabel(item);
        const disabledValue = getItemDisabled?.(item) ?? false;
        const searchableText =
          getItemSearchValue?.(item) ?? `${label} ${itemValue}`;

        return {
          item,
          value: itemValue,
          label,
          disabled: disabledValue,
          searchableText
        };
      }),
    [items, getItemValue, getItemLabel, getItemDisabled, getItemSearchValue]
  );

  const visibleEntries = React.useMemo(() => {
    if (!search || !filterItems || !isSearchActive) {
      return itemEntries;
    }

    return itemEntries.filter((entry) =>
      searchTextIncludes(entry.searchableText, searchValue)
    );
  }, [filterItems, isSearchActive, itemEntries, search, searchValue]);

  const selectableEntries = React.useMemo(
    () => visibleEntries.filter((entry) => !entry.disabled),
    [visibleEntries]
  );

  const selectableIndexByValue = React.useMemo(
    () =>
      new Map(
        selectableEntries.map((entry, index) => [entry.value, index] as const)
      ),
    [selectableEntries]
  );

  const visibleIndexByValue = React.useMemo(
    () =>
      new Map(
        visibleEntries.map((entry, index) => [entry.value, index] as const)
      ),
    [visibleEntries]
  );

  const visibleSectionKeys = React.useMemo(() => {
    if (!getItemSectionKey || !renderSectionHeader) {
      return [];
    }

    const keys: string[] = [];
    for (const entry of visibleEntries) {
      const sectionKey = getItemSectionKey(entry.item);
      if (!sectionKey || sectionKey === keys.at(-1)) {
        continue;
      }
      keys.push(sectionKey);
    }

    return keys;
  }, [getItemSectionKey, renderSectionHeader, visibleEntries]);

  const sectionKeyByVisibleIndex = React.useMemo(
    () =>
      visibleEntries.map((entry) => getItemSectionKey?.(entry.item) ?? null),
    [getItemSectionKey, visibleEntries]
  );

  const isSectionStart = React.useCallback(
    (index: number) => {
      const sectionKey = sectionKeyByVisibleIndex[index];

      return (
        !!sectionKey &&
        (index === 0 || sectionKey !== sectionKeyByVisibleIndex[index - 1])
      );
    },
    [sectionKeyByVisibleIndex]
  );

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: visibleEntries.length,
    getScrollElement: () => listContainerElement,
    estimateSize: (index) =>
      (virtualization?.estimateItemSize ?? 1) +
      (isSectionStart(index)
        ? (virtualization?.estimateSectionHeaderSize ?? 0)
        : 0),
    getItemKey: (index) => visibleEntries[index]?.value ?? index,
    overscan: virtualization?.overscan ?? 6,
    enabled: !!virtualization && open
  });

  const selectedItem = React.useMemo(
    () =>
      itemEntries.find((entry) => selectedValueSet.has(entry.value))?.item ??
      undefined,
    [itemEntries, selectedValueSet]
  );
  const selectedLabel = selectedItem ? getItemLabel(selectedItem) : undefined;
  const selectedInitialIndex = React.useMemo(() => {
    if (selectableEntries.length === 0) {
      return -1;
    }
    if (selectionMode === 'multiple' || isSearchActive) {
      return 0;
    }

    const index = selectableEntries.findIndex((entry) =>
      selectedValueSet.has(entry.value)
    );

    return index >= 0 ? index : 0;
  }, [isSearchActive, selectableEntries, selectedValueSet, selectionMode]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (mode === 'inline') {
        return;
      }
      // A reopened popover starts a new search session. Clear before opening
      // so neither the stale query nor its filtered results can paint.
      if (nextOpen && !open && search && search.value !== '') {
        search.onValueChange('');
      }
      setPopoverOpen(nextOpen);
    },
    [mode, open, search, setPopoverOpen]
  );

  const handleClose = React.useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleSelectEntry = React.useCallback(
    (entry: (typeof itemEntries)[number]) => {
      if (entry.disabled) {
        return;
      }

      onValueChange?.(entry.value, entry.item);
      onItemSelect?.(entry.item);

      const shouldClose = closeOnSelect ?? !!onValueChange;
      if (shouldClose) {
        handleOpenChange(false);
      }
    },
    [closeOnSelect, handleOpenChange, onItemSelect, onValueChange]
  );

  const listNavigation = useDropdownListNavigation({
    // Primary-touch devices (phones/tablets) have no cursor, so the highlight
    // is meaningless: there's no hover, and on touch it just follows the finger.
    // Disable it there entirely — mouse/keyboard devices (incl. touch laptops)
    // keep it, and touch input is already ignored by the shared pointer guard.
    isOpen: open && !touchScreen.isPrimaryTouch,
    items: selectableEntries,
    getItemKey: (entry) => entry.value,
    listContainerElement,
    resetKey: searchValue,
    initialIndex: selectedInitialIndex,
    onScrollToItem: virtualization
      ? (entry, _selectableIndex, reason) => {
          const visibleIndex = visibleIndexByValue.get(entry.value);
          if (visibleIndex == null) return;
          // Always let the virtualizer mount the target first. Keyboard steps
          // normally land inside overscan, but a run of disabled rows can make
          // the next selectable option an arbitrarily large jump.
          virtualizer.scrollToIndex(visibleIndex, {
            align: reason === 'keyboard' ? 'auto' : 'center'
          });
        }
      : undefined,
    stopPropagationOnSelect: stopPropagation,
    onSelect: handleSelectEntry,
    onClose: handleClose
  });

  const handleSearchInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      searchInputRef.current = node;
      assignRef(search?.inputRef, node);
    },
    [search?.inputRef]
  );

  React.useEffect(() => {
    if (!open || !search) {
      return;
    }

    const shouldAutoFocus = search.autoFocus ?? mode === 'popover';
    if (!resolveAutoFocus(shouldAutoFocus)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      focusAutoFocusTarget(searchInputRef.current);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [mode, open, search]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!open && mode === 'popover') {
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowUp'
        ) {
          event.preventDefault();
          handleOpenChange(true);
        }

        return;
      }

      if (listNavigation.handleKeyDown(event)) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
      }
    },
    [handleOpenChange, listNavigation, mode, open]
  );

  const handleSearchKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (listNavigation.handleKeyDown(event)) {
        event.stopPropagation();

        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
      }
    },
    [listNavigation]
  );

  const handleTriggerPointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      if (disabled) {
        event.preventDefault();

        return;
      }
      if (!event.defaultPrevented) {
        hapticFromPointerEvent(event);
      }
    },
    [disabled, stopPropagation]
  );

  const handleTriggerClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      if (disabled) {
        event.preventDefault();
      }
    },
    [disabled, stopPropagation]
  );

  const handleContentClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
    },
    [stopPropagation]
  );

  const renderDefaultTrigger = (
    context: ComboboxRenderTriggerContext<T>
  ): React.ReactElement => (
    <button
      type="button"
      disabled={context.disabled}
      data-invalid={hasError ? '' : undefined}
      className={cn(COMBOBOX_TRIGGER_CLASS_NAME, hasError && 'border-error/90')}
    >
      <TruncateText
        className={cn(
          'flex-1',
          context.selectedLabel ? 'text-text-primary' : 'text-text-tertiary'
        )}
      >
        {context.selectedLabel ?? context.placeholder ?? ''}
      </TruncateText>
      <CaretDownIcon
        className={cn(
          'size-4 shrink-0 text-text-tertiary transition-transform',
          context.open && 'rotate-180'
        )}
        weight="bold"
      />
    </button>
  );

  const triggerContext: ComboboxRenderTriggerContext<T> = {
    open,
    disabled,
    selectedItem,
    selectedLabel,
    placeholder
  };

  const trigger = (renderTrigger ?? renderDefaultTrigger)(triggerContext);

  const hasTouchUi = touchScreen.hasTouchCapability;

  const searchNode = search ? (
    <SearchField
      value={search.value}
      onValueChange={search.onValueChange}
      placeholder={search.placeholder}
      inputRef={handleSearchInputRef}
      onKeyDown={handleSearchKeyDown}
      isLoading={search.isLoading}
      showClear={search.showClearButton}
      clearLabel={search.clearLabel}
      containerClassName={search.containerClassName}
      inputClassName={search.inputClassName}
    />
  ) : null;

  const emptyNode = (() => {
    if (isLoading && visibleEntries.length === 0) {
      if (renderLoading) {
        return renderLoading();
      }

      return (
        <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-text-secondary">
          <LoadingSpinner removePadding className="size-4" />
          {loadingLabel ? <span>{loadingLabel}</span> : null}
        </div>
      );
    }

    if (visibleEntries.length > 0) {
      return null;
    }

    if (renderEmpty) {
      return renderEmpty({ search: searchValue, isSearchActive });
    }

    return (
      <div
        className={cn(
          'px-3 py-5 text-center text-sm text-text-secondary',
          emptyClassName
        )}
      >
        {isSearchActive ? noResultsLabel : emptyLabel}
      </div>
    );
  })();

  const renderVisibleEntry = (
    entry: (typeof visibleEntries)[number],
    index: number
  ) => {
    const selected = selectedValueSet.has(entry.value);
    const selectableIndex = selectableIndexByValue.get(entry.value) ?? -1;
    const highlighted =
      selectableIndex >= 0 &&
      listNavigation.highlightedIndex === selectableIndex;
    const sectionKey = sectionKeyByVisibleIndex[index];
    const sectionIndex = sectionKey
      ? visibleSectionKeys.indexOf(sectionKey)
      : -1;
    const sectionHeaderNode =
      renderSectionHeader && sectionKey && isSectionStart(index)
        ? renderSectionHeader({
            sectionKey,
            sectionIndex,
            firstItem: entry.item
          })
        : null;

    return (
      <>
        {sectionHeaderNode}
        <FloatingListHighlightItem
          itemKey={entry.value}
          onRequestHighlight={() => {
            if (selectableIndex >= 0) {
              listNavigation.requestHighlightForIndex(selectableIndex);
            }
          }}
        >
          {({ isHighlighted }) => (
            <button
              type="button"
              role="option"
              aria-selected={selected}
              disabled={entry.disabled}
              className={cn(
                COMBOBOX_ITEM_CLASS_NAME,
                hasTouchUi && COMBOBOX_ITEM_TOUCH_CLASS_NAME,
                hasTouchUi &&
                  highlighted &&
                  'bg-secondary text-secondary-foreground',
                selected && 'font-medium text-text-primary',
                isHighlighted &&
                  'text-secondary-foreground data-[selected=true]:text-secondary-foreground',
                selected && isHighlighted && 'text-secondary-foreground',
                itemClassName
              )}
              data-selected={selected ? 'true' : undefined}
              onPointerDown={(event) => {
                if (stopPropagation) {
                  event.stopPropagation();
                }
                if (!event.defaultPrevented && !entry.disabled) {
                  hapticFromPointerEvent(event);
                }
              }}
              onClick={(event) => {
                if (stopPropagation) {
                  event.stopPropagation();
                }
                handleSelectEntry(entry);
              }}
            >
              {renderOption ? (
                renderOption(entry.item, {
                  selected,
                  highlighted: isHighlighted || highlighted,
                  disabled: entry.disabled,
                  value: entry.value,
                  label: entry.label,
                  search: searchValue
                })
              ) : (
                <>
                  <TruncateText className="flex-1 text-inherit">
                    {entry.label}
                  </TruncateText>
                  {selected ? (
                    <CheckIcon
                      className="size-4 shrink-0 text-current"
                      weight="bold"
                    />
                  ) : null}
                </>
              )}
            </button>
          )}
        </FloatingListHighlightItem>
      </>
    );
  };

  const virtualItems = virtualization ? virtualizer.getVirtualItems() : [];
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const firstVisibleVirtualItem = virtualItems.find(
    (virtualItem) => virtualItem.end > scrollOffset + 1
  );
  const activeSectionEntry = firstVisibleVirtualItem
    ? visibleEntries[firstVisibleVirtualItem.index]
    : undefined;
  const activeSectionKey = firstVisibleVirtualItem
    ? sectionKeyByVisibleIndex[firstVisibleVirtualItem.index]
    : null;
  const activeSectionIndex = activeSectionKey
    ? visibleSectionKeys.indexOf(activeSectionKey)
    : -1;

  const virtualizedEntriesNode = virtualization ? (
    <>
      {renderSectionHeader && activeSectionEntry && activeSectionKey ? (
        <div className="pointer-events-none sticky top-0 z-30 h-0">
          {renderSectionHeader({
            sectionKey: activeSectionKey,
            sectionIndex: activeSectionIndex,
            firstItem: activeSectionEntry.item
          })}
        </div>
      ) : null}
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualItem: VirtualItem) => {
          const entry = visibleEntries[virtualItem.index];
          if (!entry) return null;

          return (
            <div
              key={entry.value}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {renderVisibleEntry(entry, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </>
  ) : null;

  const listNode = (
    <div
      id={listId}
      ref={setListContainerElement}
      role="listbox"
      onWheel={handleFloatingOverlayWheelScroll}
      className={cn(
        COMBOBOX_LIST_CLASS_NAME,
        hasTouchUi && COMBOBOX_LIST_TOUCH_CLASS_NAME,
        isDrawerPopover && COMBOBOX_LIST_DRAWER_CLASS_NAME,
        listClassName
      )}
    >
      <FloatingListHighlightLayer
        motionKey={motionKey}
        roundedClassName="rounded-sm"
        show={showHighlightSlab && !touchScreen.hasTouchCapability}
        slab={listNavigation.slabHighlight}
      >
        {emptyNode ??
          (virtualization
            ? virtualizedEntriesNode
            : visibleEntries.map((entry, index) => (
                <React.Fragment key={entry.value}>
                  {renderVisibleEntry(entry, index)}
                </React.Fragment>
              )))}
      </FloatingListHighlightLayer>
    </div>
  );

  const panelNode = (
    <div
      className={cn(
        COMBOBOX_PANEL_CLASS_NAME,
        isDrawerPopover && COMBOBOX_PANEL_DRAWER_CLASS_NAME,
        panelClassName
      )}
      onClick={handleContentClick}
      onKeyDown={handleKeyDown}
    >
      {searchNode}
      {listNode}
    </div>
  );

  if (mode === 'inline') {
    return (
      <div className={cn('flex min-h-0 min-w-0 flex-col', className)}>
        {panelNode}
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      openOnClick={openOnClick}
    >
      <PopoverTrigger asChild>
        <Slot
          data-slot="combobox-trigger"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-label={triggerAriaLabel}
          aria-disabled={disabled}
          data-disabled={disabled ? '' : undefined}
          className={triggerClassName}
          onPointerDown={handleTriggerPointerDown}
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
        >
          {trigger}
        </Slot>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          COMBOBOX_CONTENT_CLASS_NAME,
          isDrawerPopover && COMBOBOX_CONTENT_DRAWER_CLASS_NAME,
          matchTriggerWidth &&
            'w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) min-w-0',
          isDrawerPopover && '!w-full !max-w-none',
          contentClassName
        )}
        onOpenAutoFocus={(event) => {
          if (search) {
            event.preventDefault();
          }
        }}
        onClick={handleContentClick}
      >
        {panelNode}
      </PopoverContent>
    </Popover>
  );
}

export { Combobox };
