import {
  type Dispatch,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  normalizeSearchText,
  searchTextIncludes
} from '@diwan/shared/search-text';
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@phosphor-icons/react';
import {
  FloatingListHighlightItem,
  FloatingListHighlightLayer
} from '@/components/common/floating-list-highlight';
import { TruncateText } from '@/components/common/truncate-text';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { SearchField } from '@/components/ui/search-field';
import { useDropdownListNavigation } from '@/hooks/common/dropdown-list-navigation';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import {
  focusAutoFocusTarget,
  resolveAutoFocus
} from '@/utils/common/can-auto-focus';
import { cn } from '@/utils/common/cn';
import { handleFloatingOverlayWheelScroll } from '@/utils/common/floating-overlay-wheel-scroll';

const CREATE_OPTION_ROW_KEY = '__input-combobox-create-option__';

interface InputComboboxMultiSelectRenderTagContext {
  onRemove: () => void;
}

interface InputComboboxMultiSelectRenderOptionContext {
  selected: boolean;
  onSelect: () => void;
  isUnderSlab: boolean;
}

interface InputComboboxMultiSelectRenderCreateContext {
  onSelect: () => void;
  isUnderSlab: boolean;
}

interface InputComboboxMultiSelectPropsHook<T> {
  items: T[];
  selectedIds: string[];
  onSelectedIdsChange: Dispatch<SetStateAction<string[]>>;
  getItemId: (item: T) => string;
  getSearchableText?: (item: T) => string;
  /**
   * When provided, an inline "create" row surfaces at the bottom of the list
   * whenever the trimmed search has no exact (case-insensitive) match among the
   * items. Choosing it invokes this callback with the trimmed search text.
   */
  onCreateOption?: (input: string) => void;
}

interface InputComboboxMultiSelectProps<
  T
> extends InputComboboxMultiSelectPropsHook<T> {
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  noMatchLabel: string;
  disabled?: boolean;

  singleLine?: boolean;
  /**
   * When set (and not `singleLine`), the selected tags wrap onto multiple rows
   * but the field is capped at this many rows; further tags scroll vertically.
   * Intended for >= 2 — use `singleLine` for the one-row, horizontally-scrolling
   * variant.
   */
  maxRows?: number;
  renderTag: (
    item: T,
    context: InputComboboxMultiSelectRenderTagContext
  ) => ReactNode;
  renderOption?: (
    item: T,
    context: InputComboboxMultiSelectRenderOptionContext
  ) => ReactNode;
  renderCreateOption?: (
    input: string,
    context: InputComboboxMultiSelectRenderCreateContext
  ) => ReactNode;
}

function getInputComboboxMultiSelectDefaultSearchableText<T>(item: T): string {
  if (item && typeof item === 'object' && 'name' in item) {
    const name = item.name;
    if (typeof name === 'string') return name;
  }

  return '';
}

function useInputComboboxMultiSelect<T>(
  props: InputComboboxMultiSelectPropsHook<T>
) {
  const {
    items,
    selectedIds,
    onSelectedIdsChange,
    getItemId,
    getSearchableText: getSearchableTextProp,
    onCreateOption
  } = props;

  const getSearchableText =
    getSearchableTextProp ?? getInputComboboxMultiSelectDefaultSearchableText;

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(getItemId(item))),
    [items, selectedIds, getItemId]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim();
    if (!query) return items;

    return items.filter((item) =>
      searchTextIncludes(getSearchableText(item), query)
    );
  }, [items, search, getSearchableText]);

  const createOptionInput = useMemo(() => {
    if (!onCreateOption) return null;
    const trimmed = search.trim();
    if (trimmed.length === 0) return null;

    const needle = normalizeSearchText(trimmed);
    const hasExactMatch = items.some(
      (item) => normalizeSearchText(getSearchableText(item)) === needle
    );

    return hasExactMatch ? null : trimmed;
  }, [getSearchableText, items, onCreateOption, search]);

  const create = useCallback(() => {
    if (!onCreateOption) return;
    const value = search.trim();
    if (value.length === 0) return;

    onCreateOption(value);
    setSearch('');
    requestAnimationFrame(() => focusAutoFocusTarget(inputRef.current));
  }, [onCreateOption, search]);

  const toggle = useCallback(
    (id: string) => {
      onSelectedIdsChange((previous: string[]) =>
        previous.includes(id)
          ? previous.filter((x) => x !== id)
          : [...previous, id]
      );
      setSearch('');
      requestAnimationFrame(() => focusAutoFocusTarget(inputRef.current));
    },
    [onSelectedIdsChange]
  );

  const remove = useCallback(
    (id: string) => {
      onSelectedIdsChange((previous: string[]) =>
        previous.filter((x) => x !== id)
      );
      requestAnimationFrame(() => focusAutoFocusTarget(inputRef.current));
    },
    [onSelectedIdsChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      }
      if (
        event.key === 'Backspace' &&
        search === '' &&
        selectedItems.length > 0
      ) {
        const lastSelected = selectedItems[selectedItems.length - 1];
        if (lastSelected) remove(getItemId(lastSelected));
      }
    },
    [search, selectedItems, remove, getItemId]
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setSearch('');
  }, []);

  const handleContainerClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      inputRef.current?.focus();
    },
    [isOpen]
  );

  const focusInput = useCallback(() => {
    setIsOpen(true);
  }, []);

  return {
    search,
    setSearch,
    isOpen,
    inputRef,
    containerRef,
    selectedItems,
    filteredItems,
    createOptionInput,
    create,
    selectedIds,
    toggle,
    remove,
    handleKeyDown,
    handleOpenChange,
    handleContainerClick,
    focusInput,
    getItemId
  };
}

function InputComboboxMultiSelect<T>(props: InputComboboxMultiSelectProps<T>) {
  const {
    placeholder,
    searchPlaceholder,
    emptyLabel,
    noMatchLabel,
    disabled,
    singleLine,
    maxRows,
    renderTag,
    renderOption,
    renderCreateOption,
    ...comboboxOptions
  } = props;

  // A wrapped row is one tag tall: a text-xs line box (1rem * --font-scale, so it
  // tracks the small/medium/large font setting) plus the badge's fixed chrome
  // (py-0.5 + 1px borders = 6px). Rows are separated by the 6px (gap-1.5) gap, and
  // the field itself adds 12px vertical padding (py-1.5) + 2px border.
  const wrapMaxHeight =
    maxRows != null && !singleLine
      ? `calc(${maxRows} * (1rem * var(--font-scale) + 6px) + ${maxRows - 1} * 6px + 0.75rem + 2px)`
      : undefined;

  const touchScreen = useTouchScreen();
  const shouldAutoFocusSearch = resolveAutoFocus(true);
  const c = useInputComboboxMultiSelect(comboboxOptions);
  const [listContainerElement, setListContainerElement] =
    useState<HTMLDivElement | null>(null);
  const popoverPanelRef = useRef<HTMLDivElement | null>(null);
  // Clicking the list's scrollbar moves focus onto the outer Radix popover
  // content node — which is not contained by `popoverPanelRef` — so the
  // blur guard below must also check it, otherwise the input blur closes the
  // popover mid-scroll.
  const popoverContentRef = useRef<HTMLDivElement | null>(null);

  const handleListContainerRef = useCallback((node: HTMLDivElement | null) => {
    setListContainerElement(node);
  }, []);

  type ComboboxRow =
    | { kind: 'item'; key: string; item: T }
    | { kind: 'create'; key: string; input: string };

  const navigationRows = useMemo<ComboboxRow[]>(() => {
    const rows: ComboboxRow[] = c.filteredItems.map((item) => ({
      kind: 'item',
      key: c.getItemId(item),
      item
    }));
    if (c.createOptionInput !== null) {
      rows.push({
        kind: 'create',
        key: CREATE_OPTION_ROW_KEY,
        input: c.createOptionInput
      });
    }

    return rows;
  }, [c]);

  const handleRowSelect = useCallback(
    (row: ComboboxRow) => {
      if (row.kind === 'create') {
        c.create();

        return;
      }
      c.toggle(c.getItemId(row.item));
    },
    [c]
  );

  const handleNavigationClose = useCallback(() => {
    c.handleOpenChange(false);
    c.inputRef.current?.blur();
  }, [c]);

  const listNavigation = useDropdownListNavigation<ComboboxRow>({
    isOpen: c.isOpen,
    resetKey: c.search,
    items: navigationRows,
    getItemKey: (row) => row.key,
    listContainerElement,
    stopPropagationOnSelect: true,
    onSelect: handleRowSelect,
    onClose: handleNavigationClose
  });

  const getOptionLabel = (item: T) =>
    comboboxOptions.getSearchableText
      ? comboboxOptions.getSearchableText(item)
      : getInputComboboxMultiSelectDefaultSearchableText(item);

  const defaultRenderOption = (
    item: T,
    ctx: InputComboboxMultiSelectRenderOptionContext
  ) => (
    <button
      type="button"
      onClick={ctx.onSelect}
      className={cn(
        'flex min-w-0 w-full cursor-pointer items-center gap-2 rounded-sm bg-transparent px-2 py-2.5 text-sm outline-hidden select-none transition-[color] duration-200 overflow-hidden',
        'text-text-secondary [&_span]:text-inherit',
        ctx.selected && 'text-text-primary',
        ctx.isUnderSlab && 'text-secondary-foreground',
        ctx.selected && ctx.isUnderSlab && 'text-secondary-foreground'
      )}
    >
      <TruncateText as="span" className="flex-1">
        {getOptionLabel(item)}
      </TruncateText>
      {ctx.selected && (
        <CheckIcon
          className="size-4 shrink-0 ms-auto text-current"
          weight="bold"
        />
      )}
    </button>
  );

  const renderOptionRow = renderOption ?? defaultRenderOption;

  const defaultRenderCreate = (
    input: string,
    ctx: InputComboboxMultiSelectRenderCreateContext
  ) => (
    <button
      type="button"
      onClick={ctx.onSelect}
      className={cn(
        'flex min-w-0 w-full cursor-pointer items-center gap-2 rounded-sm bg-transparent px-2 py-2.5 text-sm outline-hidden select-none transition-[color] duration-200 overflow-hidden',
        'text-text-secondary [&_span]:text-inherit',
        ctx.isUnderSlab && 'text-secondary-foreground'
      )}
    >
      <PlusIcon className="size-4 shrink-0" weight="bold" />
      <TruncateText as="span" className="flex-1">
        {input}
      </TruncateText>
    </button>
  );

  const renderCreateRow = renderCreateOption ?? defaultRenderCreate;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      c.handleOpenChange(open);
    },
    [c]
  );

  const handleTagStripFocusCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (disabled || !c.isOpen) {
        return;
      }

      const next = event.target;
      if (!(next instanceof Element)) {
        return;
      }

      if (next.closest('[data-input-combobox-multi-select-tag]')) {
        handleOpenChange(false);
      }
    },
    [disabled, c.isOpen, handleOpenChange]
  );

  const handleTagStripKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' || disabled || event.repeat) {
        return;
      }

      if (event.nativeEvent.isComposing) {
        return;
      }

      const el = event.target;
      if (!(el instanceof Element)) {
        return;
      }

      const strip = el.closest('[data-input-combobox-multi-select-tag]');
      if (!strip) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const raw = strip.getAttribute('data-tag-id');
      if (raw == null) {
        return;
      }

      c.remove(raw);
    },
    [disabled, c]
  );

  const handleComboboxInputBlur = useCallback(() => {
    if (disabled) {
      return;
    }

    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof Node) {
        if (c.containerRef.current?.contains(active)) {
          return;
        }
        if (popoverPanelRef.current?.contains(active)) {
          return;
        }
        if (popoverContentRef.current?.contains(active)) {
          return;
        }
      }
      handleOpenChange(false);
    });
  }, [disabled, c.containerRef, handleOpenChange]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (listNavigation.handleKeyDown(event)) {
        return;
      }

      if (event.key === 'Enter' && c.isOpen) {
        event.preventDefault();

        return;
      }

      c.handleKeyDown(event);
    },
    [c, listNavigation]
  );

  return (
    <Popover open={c.isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          ref={c.containerRef}
          role="combobox"
          className={cn(
            'flex min-h-10 min-w-0 w-full cursor-text items-center gap-1.5 rounded-lg border border-border-default bg-background-base px-2.5 py-1.5 text-sm',
            singleLine
              ? 'hide-scrollbar flex-nowrap overflow-x-auto'
              : maxRows != null
                ? 'flex-wrap overflow-y-auto'
                : 'flex-wrap overflow-hidden',
            'transition-colors duration-150',
            'hover:border-secondary-foreground hover:bg-secondary-hover',
            'focus-within:border-border-dark focus-within:hover:bg-background-base',
            disabled && 'pointer-events-none opacity-50'
          )}
          style={wrapMaxHeight ? { maxHeight: wrapMaxHeight } : undefined}
          onClick={c.handleContainerClick}
          onFocusCapture={handleTagStripFocusCapture}
          onKeyDownCapture={handleTagStripKeyDownCapture}
        >
          <input
            ref={c.inputRef}
            type="text"
            value={c.search}
            onChange={(event) => c.setSearch(event.target.value)}
            onFocus={c.focusInput}
            onBlur={handleComboboxInputBlur}
            onKeyDown={handleSearchKeyDown}
            placeholder={
              c.isOpen
                ? searchPlaceholder
                : c.selectedItems.length > 0
                  ? ''
                  : placeholder
            }
            disabled={disabled}
            className={cn(
              'order-2 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary',
              singleLine && 'min-w-16'
            )}
          />
          {c.selectedItems.map((item) => {
            const id = c.getItemId(item);

            return (
              <span
                key={id}
                data-input-combobox-multi-select-tag=""
                data-tag-id={String(id)}
                className={cn(
                  'order-1 inline-flex max-w-full min-w-0',
                  singleLine && 'shrink-0'
                )}
              >
                {renderTag(item, {
                  onRemove: () => c.remove(id)
                })}
              </span>
            );
          })}
        </div>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverContentRef}
        align="start"
        className="flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) sm:w-(--radix-popover-trigger-width) max-w-none flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <div
          ref={popoverPanelRef}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div className="shrink-0 sm:hidden">
            <SearchField
              value={c.search}
              onValueChange={c.setSearch}
              placeholder={searchPlaceholder}
              icon={<MagnifyingGlassIcon weight="regular" />}
              onBlur={handleComboboxInputBlur}
              onKeyDown={handleSearchKeyDown}
              autoFocus={shouldAutoFocusSearch}
              flush
            />
          </div>
          <div
            ref={handleListContainerRef}
            onWheel={handleFloatingOverlayWheelScroll}
            className="relative isolate max-h-56 min-h-0 flex-1 scroll-py-2 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2"
          >
            <FloatingListHighlightLayer
              motionKey="input-combobox-multi-select-highlight"
              slab={listNavigation.slabHighlight}
              show={!touchScreen.hasTouchCapability}
            >
              {navigationRows.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  {comboboxOptions.items.length === 0
                    ? emptyLabel
                    : noMatchLabel}
                </p>
              ) : (
                <>
                  {navigationRows.map((row, index) => (
                    <FloatingListHighlightItem
                      key={row.key}
                      itemKey={row.key}
                      onRequestHighlight={() => {
                        listNavigation.requestHighlightForIndex(index);
                      }}
                    >
                      {({ isHighlighted }) =>
                        row.kind === 'create'
                          ? renderCreateRow(row.input, {
                              onSelect: c.create,
                              isUnderSlab: isHighlighted
                            })
                          : renderOptionRow(row.item, {
                              selected: c.selectedIds.includes(
                                c.getItemId(row.item)
                              ),
                              onSelect: () => c.toggle(c.getItemId(row.item)),
                              isUnderSlab: isHighlighted
                            })
                      }
                    </FloatingListHighlightItem>
                  ))}
                </>
              )}
            </FloatingListHighlightLayer>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { InputComboboxMultiSelect };
