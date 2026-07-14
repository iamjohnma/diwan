import * as React from 'react';
import { searchTextIncludes } from '@diwan/shared/search-text';
import { CheckIcon } from '@phosphor-icons/react';
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
import { useDropdownListNavigation } from '@/hooks/common/dropdown-list-navigation';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { assignRef } from '@/utils/common/assign-ref';
import {
  focusAutoFocusTarget,
  resolveAutoFocus
} from '@/utils/common/can-auto-focus';
import { cn } from '@/utils/common/cn';
import { isDataInvalid } from '@/utils/common/data-invalid';
import { handleFloatingOverlayWheelScroll } from '@/utils/common/floating-overlay-wheel-scroll';

interface InputComboboxRenderOptionContext {
  selected: boolean;
  highlighted: boolean;
  value: string;
  label: string;
  search: string;
  onSelect: () => void;
}

interface InputComboboxEntry<T> {
  item: T;
  value: string;
  label: string;
  searchableText: string;
}

interface InputComboboxProps<T> extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'defaultValue'
> {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly T[];
  'data-invalid'?: boolean | 'true' | 'false';
  getItemValue?: (item: T) => string;
  getItemLabel?: (item: T) => string;
  getItemSearchValue?: (item: T) => string;
  contentClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  renderOption?: (
    item: T,
    context: InputComboboxRenderOptionContext
  ) => React.ReactNode;
}

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
    if ('value' in item && typeof item.value === 'string') {
      return item.value;
    }
  }

  return '';
}

function getDefaultItemValue<T>(item: T): string {
  if (item && typeof item === 'object' && 'value' in item) {
    const value = item.value;
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  return getDefaultItemLabel(item);
}

function InputComboboxInner<T>(
  props: InputComboboxProps<T>,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  const {
    value,
    onValueChange,
    items,
    getItemValue = getDefaultItemValue,
    getItemLabel = getDefaultItemLabel,
    getItemSearchValue,
    contentClassName,
    listClassName,
    itemClassName,
    renderOption,
    className,
    disabled,
    autoFocus: rawAutoFocus,
    onBlur,
    onFocus,
    onKeyDown,
    ...inputProps
  } = props;
  const touchScreen = useTouchScreen();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const keyboardSelectionEnabledRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [listContainerElement, setListContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const inputValue = value ?? '';
  const query = inputValue.trim();
  const invalid = isDataInvalid({ 'data-invalid': props['data-invalid'] });
  const resolvedAutoFocus = resolveAutoFocus(rawAutoFocus ?? false);

  const entries = React.useMemo<InputComboboxEntry<T>[]>(
    () =>
      items.map((item) => {
        const itemValue = getItemValue(item);
        const itemLabel = getItemLabel(item);
        const searchableText =
          getItemSearchValue?.(item) ?? `${itemLabel} ${itemValue}`;

        return {
          item,
          value: itemValue,
          label: itemLabel,
          searchableText
        };
      }),
    [getItemLabel, getItemSearchValue, getItemValue, items]
  );

  const filteredEntries = React.useMemo(() => {
    if (!query) {
      return entries;
    }

    return entries.filter((entry) =>
      searchTextIncludes(entry.searchableText, query)
    );
  }, [entries, query]);

  // The dropdown only exists to surface suggestions, so when nothing matches we
  // hide it entirely rather than showing an empty-state message.
  const suggestionsOpen = open && !disabled && filteredEntries.length > 0;

  const handleInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      assignRef(ref, node);
    },
    [ref]
  );

  const handleSelectEntry = React.useCallback(
    (entry: InputComboboxEntry<T>) => {
      onValueChange(entry.value);
      keyboardSelectionEnabledRef.current = false;
      setOpen(false);
      requestAnimationFrame(() => focusAutoFocusTarget(inputRef.current));
    },
    [onValueChange]
  );

  const handleNavigationClose = React.useCallback(() => {
    keyboardSelectionEnabledRef.current = false;
    setOpen(false);
  }, []);

  const listNavigation = useDropdownListNavigation({
    isOpen: suggestionsOpen,
    items: filteredEntries,
    getItemKey: (entry) => entry.value,
    listContainerElement,
    resetKey: inputValue,
    initialIndex: filteredEntries.length > 0 ? 0 : -1,
    stopPropagationOnSelect: true,
    onSelect: handleSelectEntry,
    onClose: handleNavigationClose
  });

  const handleInputFocus = React.useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(event);
      if (!event.defaultPrevented && !disabled) {
        keyboardSelectionEnabledRef.current = false;
        setOpen(true);
      }
    },
    [disabled, onFocus]
  );

  const handleInputBlur = React.useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(event);

      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active instanceof Node) {
          if (triggerRef.current?.contains(active)) {
            return;
          }
          if (contentRef.current?.contains(active)) {
            return;
          }
        }
        setOpen(false);
      });
    },
    [onBlur]
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const isArrowNavigation =
        event.key === 'ArrowDown' || event.key === 'ArrowUp';

      if (!open && isArrowNavigation && !disabled) {
        event.preventDefault();
        keyboardSelectionEnabledRef.current = true;
        setOpen(true);

        return;
      }

      if (isArrowNavigation) {
        keyboardSelectionEnabledRef.current = true;
      }

      if (event.key === 'Enter' && !keyboardSelectionEnabledRef.current) {
        // Free-text entry: the typed value is already committed via onChange, so
        // close the suggestions and let Enter bubble to the dialog submit hotkey
        // instead of stopping propagation (which would swallow the submit).
        setOpen(false);
        onKeyDown?.(event);

        return;
      }

      if (listNavigation.handleKeyDown(event)) {
        if (event.key === 'Enter' || event.key === 'Escape') {
          keyboardSelectionEnabledRef.current = false;
        }

        return;
      }

      if (event.key === 'Escape') {
        keyboardSelectionEnabledRef.current = false;
        setOpen(false);
      }

      onKeyDown?.(event);
    },
    [disabled, listNavigation, onKeyDown, open]
  );

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(event.target.value);
      keyboardSelectionEnabledRef.current = false;
      if (!open && !disabled) {
        setOpen(true);
      }
    },
    [disabled, onValueChange, open]
  );

  return (
    <Popover open={suggestionsOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={triggerRef}
          data-slot="input-combobox"
          data-invalid={invalid ? '' : undefined}
          data-disabled={disabled ? '' : undefined}
          className={cn(
            'flex h-10 min-w-0 w-full cursor-text items-center justify-center rounded-lg border bg-background-base transition-colors duration-150 focus-within:hover:bg-background-base',
            invalid
              ? 'border-error/90 hover:border-error focus-within:border-error'
              : 'border-border-default hover:border-primary hover:bg-secondary-hover focus-within:border-primary',
            disabled && 'pointer-events-none opacity-50',
            className
          )}
          onClick={() => {
            focusAutoFocusTarget(inputRef.current);
            if (!disabled) {
              setOpen(true);
            }
          }}
        >
          <input
            {...inputProps}
            ref={handleInputRef}
            data-slot="input-combobox-input"
            type={inputProps.type ?? 'text'}
            autoComplete="off"
            disabled={disabled}
            value={inputValue}
            autoFocus={resolvedAutoFocus}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent px-3 text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="start"
        className={cn(
          'flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) sm:w-(--radix-popover-trigger-width) max-w-none flex-col overflow-hidden p-0',
          contentClassName
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          ref={setListContainerElement}
          onWheel={handleFloatingOverlayWheelScroll}
          className={cn(
            'relative isolate max-h-56 min-h-0 flex-1 scroll-py-2 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5',
            touchScreen.hasTouchCapability && 'scroll-py-1 p-2',
            listClassName
          )}
        >
          <FloatingListHighlightLayer
            motionKey="input-combobox-highlight"
            roundedClassName="rounded-sm"
            show={!touchScreen.hasTouchCapability}
            slab={listNavigation.slabHighlight}
          >
            {filteredEntries.map((entry, index) => {
              const selected = entry.value === inputValue;
              const highlighted = listNavigation.highlightedIndex === index;

              return (
                <FloatingListHighlightItem
                  key={entry.value}
                  itemKey={entry.value}
                  onRequestHighlight={() => {
                    listNavigation.requestHighlightForIndex(index);
                  }}
                >
                  {({ isHighlighted }) => (
                    <button
                      type="button"
                      data-selected={selected ? 'true' : undefined}
                      className={cn(
                        'relative z-10 flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-sm bg-transparent px-2.5 py-2 text-sm text-text-secondary outline-hidden select-none transition-[color] duration-200',
                        touchScreen.hasTouchCapability &&
                          'min-h-12 rounded-md px-3 py-3 text-base',
                        selected && 'font-medium text-text-primary',
                        (isHighlighted || highlighted) &&
                          'text-secondary-foreground',
                        itemClassName
                      )}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectEntry(entry)}
                    >
                      {renderOption ? (
                        renderOption(entry.item, {
                          selected,
                          highlighted: isHighlighted || highlighted,
                          value: entry.value,
                          label: entry.label,
                          search: inputValue,
                          onSelect: () => handleSelectEntry(entry)
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
              );
            })}
          </FloatingListHighlightLayer>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const InputCombobox = React.forwardRef(InputComboboxInner) as <T>(
  props: InputComboboxProps<T> & React.RefAttributes<HTMLInputElement>
) => React.ReactElement;

export { InputCombobox };
