import * as React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common/truncate-text';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useTopFloatingLayerDismiss } from '@/components/ui/floating-layer';
import {
  FloatingListSlabLayer,
  type FloatingSlabState,
  getFloatingSlabLayout
} from '@/components/ui/floating-list-slab';
import { useSuppressFloatingOverlayMotion } from '@/components/ui/popover';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useDirection } from '@/hooks/common/direction';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { useDialogsStore } from '@/stores/dialogs/store';
import { assignRef } from '@/utils/common/assign-ref';
import { scrollItemToContainerCenter } from '@/utils/common/center-item-scroll';
import { cn } from '@/utils/common/cn';
import { handleFloatingOverlayWheelScroll } from '@/utils/common/floating-overlay-wheel-scroll';
import { hapticFromPointerEvent } from '@/utils/common/haptics';
import { resolveSelectSlabSource } from '@/utils/common/select-slab-source';

interface MobileSelectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (value: string, label?: string) => void;
  selectedLabel?: string;
  registerItem: (value: string, label: string) => void;
  setItemsForRegistration: (items: React.ReactNode) => void;
}

const MobileSelectContext = createContext<MobileSelectContextValue | null>(
  null
);

function useMobileSelect() {
  return useContext(MobileSelectContext);
}

interface SelectLabelsContextValue {
  selectedLabel?: string;
  registerItem: (value: string, label: string) => void;
  registerItems: (items: React.ReactNode) => void;
}

const SelectLabelsContext = createContext<SelectLabelsContextValue | null>(
  null
);

function useSelectLabels() {
  return useContext(SelectLabelsContext);
}

const DesktopSelectTriggerContext = createContext<{
  disabled?: boolean;
  open: () => void;
  toggleOpen: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
} | null>(null);

function useDesktopSelectTrigger() {
  return useContext(DesktopSelectTriggerContext);
}

const DesktopSelectContentContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  value?: string;
  setValue: (value: string, label?: string) => void;
} | null>(null);

function useDesktopSelectContent() {
  return useContext(DesktopSelectContentContext);
}

interface SelectHighlightControlsContextValue {
  setSlabHighlight: React.Dispatch<
    React.SetStateAction<FloatingSlabState | null>
  >;
  setSlabActiveItem: (itemEl: HTMLElement | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const SelectHighlightControlsContext =
  createContext<SelectHighlightControlsContextValue | null>(null);

function useSelectHighlightControls() {
  return useContext(SelectHighlightControlsContext);
}

function getSelectSlabLayout(itemEl: HTMLElement, containerEl: HTMLElement) {
  const layout = getFloatingSlabLayout(itemEl, containerEl);
  const style = getComputedStyle(containerEl);
  const padStart = parseFloat(style.paddingInlineStart) || 0;
  const padEnd = parseFloat(style.paddingInlineEnd) || 0;

  return {
    ...layout,
    insetInlineStart: padStart,
    width: Math.max(0, containerEl.clientWidth - padStart - padEnd)
  };
}

function getSelectItemUnderPointer(
  container: HTMLElement,
  pointer: { x: number; y: number } | null
): HTMLElement | null {
  if (!pointer || typeof document === 'undefined') {
    return null;
  }

  const target = document.elementFromPoint(pointer.x, pointer.y);
  if (!(target instanceof Element)) {
    return null;
  }

  const item = target.closest<HTMLElement>(
    '[data-slot="select-item"]:not([data-disabled])'
  );
  if (!item || !container.contains(item)) {
    return null;
  }

  return item;
}

function areSelectSlabLayoutsEqual(
  first: FloatingSlabState['layout'],
  second: FloatingSlabState['layout']
) {
  return (
    first.top === second.top &&
    first.height === second.height &&
    first.insetInlineStart === second.insetInlineStart &&
    first.width === second.width
  );
}

function resolveNextSelectSlabHighlight(
  current: FloatingSlabState | null,
  next: FloatingSlabState
) {
  if (
    current &&
    current.itemKey === next.itemKey &&
    current.variant === next.variant &&
    areSelectSlabLayoutsEqual(current.layout, next.layout)
  ) {
    return current;
  }

  return next;
}

function useSelectItemHighlight(itemValue: string) {
  const selectHighlightControls = useSelectHighlightControls();
  const itemRef = useRef<HTMLDivElement>(null);

  const onMouseEnter = useCallback(() => {
    if (!selectHighlightControls || !itemRef.current) return;

    const container = selectHighlightControls.containerRef.current;
    if (!container) return;

    selectHighlightControls.setSlabActiveItem(itemRef.current);
    // Measure eagerly at event time, while the hovered item is known to be
    // mounted. The updater below may execute lazily on a later render (React
    // queues it), by which point a click may have unmounted the item and
    // nulled the ref — dereferencing it inside the updater crashed here.
    const nextSlabHighlight = {
      layout: getSelectSlabLayout(itemRef.current, container),
      itemKey: String(itemValue)
    };
    selectHighlightControls.setSlabHighlight((currentSlabHighlight) =>
      resolveNextSelectSlabHighlight(currentSlabHighlight, nextSlabHighlight)
    );
  }, [selectHighlightControls, itemValue]);

  return { itemRef, onMouseEnter };
}

const SELECT_TRIGGER_CLASS_NAME =
  'flex w-full h-10 min-w-0 cursor-pointer items-center justify-between gap-0 overflow-hidden rounded-lg border border-border-default bg-background-base ps-3 pe-2 outline-none transition-[background-color,border-color,color,box-shadow] duration-[var(--motion-duration-surface)] ease-[var(--motion-ease-out)] focus-visible:ring-0.4';

const SELECT_TRIGGER_ICON_CLASS_NAME = 'size-4 shrink-0 opacity-50';

const SELECT_TRIGGER_CONTENT_CLASS_NAME =
  'flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap [&>*]:min-w-0 [&>*]:w-full [&>*]:max-w-full [&>*]:truncate **:min-w-0 **:max-w-full **:truncate';

const SELECT_ITEM_TEXT_CLASS_NAME =
  'block w-full min-w-0 flex-1 truncate whitespace-nowrap [&>*]:min-w-0 [&>*]:w-full [&>*]:max-w-full [&>*]:truncate **:min-w-0 **:max-w-full **:truncate';

const SELECT_CONTENT_MATCH_TRIGGER_WIDTH_CLASS =
  'w-(--radix-select-trigger-width) max-w-[min(var(--radix-select-trigger-width),var(--radix-select-content-available-width))]';

const SELECT_CONTENT_INTRINSIC_WIDTH_CLASS =
  'w-max min-w-(--radix-select-trigger-width) max-w-(--radix-select-content-available-width)';

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

type SelectValueProps = React.ComponentPropsWithRef<'span'> & {
  placeholder?: React.ReactNode;
};

type SelectTriggerProps = React.ComponentPropsWithRef<'button'> & {
  size?: 'sm' | 'default';
  showChevron?: boolean;
};

type SelectContentAlign = 'start' | 'center' | 'end';
type SelectContentSide = 'top' | 'bottom';
type SelectContentPosition = 'popper' | 'item-aligned';

type SelectContentProps = React.ComponentPropsWithRef<'div'> & {
  matchTriggerWidth?: boolean;
  position?: SelectContentPosition;
  align?: SelectContentAlign;
  collisionPadding?: number;
  side?: SelectContentSide;
  sideOffset?: number;
  collisionBoundary?: Element | null;
  onCloseAutoFocus?: (event: Event) => void;
};

type SelectItemProps = React.ComponentPropsWithRef<'div'> & {
  value: string;
  disabled?: boolean;
  itemLabel?: string;
  textValue?: string;
};

interface SelectLayout {
  availableHeight: number;
  availableWidth: number;
  inlineStart: number;
  side: SelectContentSide;
  top: number;
  triggerHeight: number;
  triggerWidth: number;
  transformOrigin: string;
}

type SelectContentStyle = React.CSSProperties &
  Record<`--${string}`, string | number | undefined>;

function renderSelectTriggerContent(children: React.ReactNode) {
  if (typeof children === 'string') {
    return <TruncateText className="w-full flex-1">{children}</TruncateText>;
  }

  return <span className={SELECT_TRIGGER_CONTENT_CLASS_NAME}>{children}</span>;
}

function renderSelectItemText(children: React.ReactNode) {
  if (typeof children === 'string' || typeof children === 'number') {
    return <TruncateText>{children}</TruncateText>;
  }

  return children;
}

function getSelectNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean' || typeof node === 'function') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getSelectNodeText).join('');
  }

  if (React.isValidElement(node)) {
    const elementProps = node.props as { children?: React.ReactNode };

    return getSelectNodeText(elementProps.children);
  }

  return '';
}

function collectSelectItemLabels(
  node: React.ReactNode,
  labels: Map<string, string>
) {
  if (node == null || typeof node === 'boolean' || typeof node === 'function') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectSelectItemLabels(child, labels));

    return;
  }

  if (!React.isValidElement(node)) {
    return;
  }

  const elementProps = node.props as {
    children?: React.ReactNode;
    itemLabel?: string;
    value?: unknown;
  };

  if (typeof elementProps.value === 'string') {
    const childrenLabel = getSelectNodeText(elementProps.children).trim();
    const labelText =
      elementProps.itemLabel ??
      (childrenLabel.length > 0 ? childrenLabel : undefined);

    if (labelText) {
      labels.set(elementProps.value, labelText);
    }
  }

  collectSelectItemLabels(elementProps.children, labels);
}

function getSelectContentLayout(options: {
  align: SelectContentAlign;
  collisionPadding: number;
  direction: 'ltr' | 'rtl';
  matchTriggerWidth: boolean;
  side?: SelectContentSide;
  sideOffset: number;
  trigger: HTMLElement;
}): SelectLayout {
  const triggerRect = options.trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const triggerWidth = triggerRect.width;
  const estimatedContentWidth = options.matchTriggerWidth
    ? triggerWidth
    : triggerWidth;
  const availableWidth = Math.max(
    0,
    viewportWidth - options.collisionPadding * 2
  );
  const bottomAvailableHeight =
    viewportHeight -
    triggerRect.bottom -
    options.sideOffset -
    options.collisionPadding;
  const topAvailableHeight =
    triggerRect.top - options.sideOffset - options.collisionPadding;
  const side =
    options.side ??
    (bottomAvailableHeight >= 160 || bottomAvailableHeight >= topAvailableHeight
      ? 'bottom'
      : 'top');
  const availableHeight = Math.max(
    0,
    side === 'bottom' ? bottomAvailableHeight : topAvailableHeight
  );
  const top =
    side === 'bottom'
      ? triggerRect.bottom + options.sideOffset
      : triggerRect.top - options.sideOffset;

  const alignedStart = (() => {
    if (options.matchTriggerWidth) {
      return triggerRect.left;
    }

    if (options.align === 'end') {
      return triggerRect.right - estimatedContentWidth;
    }

    if (options.align === 'center') {
      return triggerRect.left + triggerWidth / 2 - estimatedContentWidth / 2;
    }

    return triggerRect.left;
  })();
  const clampedStart = Math.min(
    Math.max(options.collisionPadding, alignedStart),
    Math.max(
      options.collisionPadding,
      viewportWidth - estimatedContentWidth - options.collisionPadding
    )
  );
  const inlineStart =
    options.direction === 'rtl'
      ? viewportWidth - clampedStart - estimatedContentWidth
      : clampedStart;

  return {
    availableHeight,
    availableWidth,
    inlineStart,
    side,
    top,
    triggerHeight: triggerRect.height,
    triggerWidth,
    transformOrigin:
      side === 'bottom' ? `${options.align} top` : `${options.align} bottom`
  };
}

function Select(props: SelectProps) {
  const {
    children,
    value,
    defaultValue,
    onValueChange,
    open: controlledOpen,
    onOpenChange,
    disabled
  } = props;
  const { isMobile } = useBreakpoint();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>();
  const [itemsForRegistration, setItemsForRegistration] =
    useState<React.ReactNode>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const itemLabelsRef = useRef<Map<string, string>>(new Map());
  const selectedValue = value ?? uncontrolledValue;
  const pendingValueRef = useRef<string | undefined>(selectedValue);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const desktopTriggerRef = useRef<HTMLElement | null>(null);
  const desktopOpenValueRef = useRef(false);
  const openStateRef = useRef({
    desktopOpen: false,
    isMobile,
    mobileOpen: false
  });
  const previousOpenDialogLayerCountRef = useRef(
    useDialogsStore.getState().openDialogs.size +
      useDialogsStore.getState().registeredDialogs.size
  );

  const commitSelectedLabel = useCallback((label: string | undefined) => {
    setSelectedLabel((currentLabel) =>
      currentLabel === label ? currentLabel : label
    );
  }, []);

  React.useEffect(() => {
    pendingValueRef.current = selectedValue;
    if (selectedValue && itemLabelsRef.current.has(selectedValue)) {
      commitSelectedLabel(itemLabelsRef.current.get(selectedValue));
    }
  }, [commitSelectedLabel, selectedValue]);

  const handleSetOpen = useCallback(
    (open: boolean) => {
      if (disabled && open) {
        return;
      }
      setMobileOpen(open);
      onOpenChange?.(open);
    },
    [disabled, onOpenChange]
  );

  const handleValueChange = useCallback(
    (newValue: string, label?: string) => {
      const newLabel = label || itemLabelsRef.current.get(newValue);
      if (newLabel) {
        commitSelectedLabel(newLabel);
      }
      if (value === undefined) {
        setUncontrolledValue(newValue);
      }
      handleSetOpen(false);
      requestAnimationFrame(() => {
        onValueChange?.(newValue);
      });
    },
    [commitSelectedLabel, value, onValueChange, handleSetOpen]
  );

  const registerItem = useCallback(
    (itemValue: string, label: string) => {
      itemLabelsRef.current.set(itemValue, label);
      const currentValue = pendingValueRef.current;
      if (itemValue === currentValue) {
        commitSelectedLabel(label);
      }
    },
    [commitSelectedLabel]
  );

  const registerItems = useCallback(
    (items: React.ReactNode) => {
      const labels = new Map<string, string>();
      collectSelectItemLabels(items, labels);

      labels.forEach((label, itemValue) => {
        itemLabelsRef.current.set(itemValue, label);
      });

      const currentValue = pendingValueRef.current;
      if (currentValue && labels.has(currentValue)) {
        commitSelectedLabel(labels.get(currentValue));
      }
    },
    [commitSelectedLabel]
  );

  const selectLabelsContextValue = React.useMemo(
    () => ({
      selectedLabel,
      registerItem,
      registerItems
    }),
    [selectedLabel, registerItem, registerItems]
  );

  const desktopOpenValue = controlledOpen ?? desktopOpen;
  desktopOpenValueRef.current = desktopOpenValue;
  openStateRef.current = {
    desktopOpen: desktopOpenValue,
    isMobile,
    mobileOpen
  };

  const handleDesktopOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (controlledOpen === undefined) {
          setDesktopOpen(false);
        }
        onOpenChange?.(next);
      }
    },
    [controlledOpen, onOpenChange]
  );

  const setOpenFromTrigger = useCallback(
    (next: boolean) => {
      if (next) {
        if (disabled) {
          return;
        }
        if (controlledOpen === undefined) {
          setDesktopOpen(true);
        }
        onOpenChange?.(true);
      } else {
        handleDesktopOpenChange(false);
      }
    },
    [controlledOpen, disabled, handleDesktopOpenChange, onOpenChange]
  );

  const handleDesktopValueChange = useCallback(
    (newValue: string, label?: string) => {
      const newLabel = label || itemLabelsRef.current.get(newValue);
      if (newLabel) {
        commitSelectedLabel(newLabel);
      }
      if (value === undefined) {
        setUncontrolledValue(newValue);
      }
      setOpenFromTrigger(false);
      onValueChange?.(newValue);
    },
    [commitSelectedLabel, value, onValueChange, setOpenFromTrigger]
  );

  const openFromTrigger = useCallback(() => {
    if (desktopOpenValueRef.current) {
      return;
    }

    setOpenFromTrigger(true);
  }, [setOpenFromTrigger]);

  const toggleOpenFromTrigger = useCallback(() => {
    setOpenFromTrigger(!desktopOpenValueRef.current);
  }, [setOpenFromTrigger]);

  const desktopTriggerContextValue = React.useMemo(
    () => ({
      disabled,
      open: openFromTrigger,
      toggleOpen: toggleOpenFromTrigger,
      triggerRef: desktopTriggerRef
    }),
    [disabled, openFromTrigger, toggleOpenFromTrigger]
  );

  const desktopContentContextValue = React.useMemo(
    () => ({
      open: desktopOpenValue,
      setOpen: setOpenFromTrigger,
      onOpenChange,
      triggerRef: desktopTriggerRef,
      disabled,
      value: selectedValue,
      setValue: handleDesktopValueChange
    }),
    [
      desktopOpenValue,
      onOpenChange,
      selectedValue,
      disabled,
      handleDesktopValueChange,
      setOpenFromTrigger
    ]
  );

  React.useEffect(() => {
    return useDialogsStore.subscribe((state) => {
      const openDialogLayerCount =
        state.openDialogs.size + state.registeredDialogs.size;
      const previousOpenDialogLayerCount =
        previousOpenDialogLayerCountRef.current;
      previousOpenDialogLayerCountRef.current = openDialogLayerCount;

      if (
        openDialogLayerCount === 0 ||
        openDialogLayerCount <= previousOpenDialogLayerCount
      ) {
        return;
      }

      const openState = openStateRef.current;

      if (openState.isMobile) {
        if (openState.mobileOpen) {
          handleSetOpen(false);
        }

        return;
      }

      if (openState.desktopOpen) {
        handleDesktopOpenChange(false);
      }
    });
  }, [handleDesktopOpenChange, handleSetOpen]);

  if (isMobile) {
    return (
      <MobileSelectContext.Provider
        value={{
          open: mobileOpen,
          setOpen: handleSetOpen,
          disabled,
          value: selectedValue,
          onValueChange: handleValueChange,
          selectedLabel,
          registerItem,
          setItemsForRegistration
        }}
      >
        <Drawer open={mobileOpen} onOpenChange={handleSetOpen}>
          {children}
        </Drawer>
        {itemsForRegistration && (
          <div style={{ display: 'none' }} data-no-focus>
            {itemsForRegistration}
          </div>
        )}
      </MobileSelectContext.Provider>
    );
  }

  return (
    <SelectLabelsContext.Provider value={selectLabelsContextValue}>
      <DesktopSelectTriggerContext.Provider value={desktopTriggerContextValue}>
        <DesktopSelectContentContext.Provider
          value={desktopContentContextValue}
        >
          {children}
        </DesktopSelectContentContext.Provider>
      </DesktopSelectTriggerContext.Provider>
    </SelectLabelsContext.Provider>
  );
}

function SelectValue(props: SelectValueProps) {
  const { placeholder, children, className, ...valueProps } = props;
  const mobileContext = useMobileSelect();
  const selectLabels = useSelectLabels();

  if (mobileContext) {
    const displayValue = mobileContext.selectedLabel ?? children ?? placeholder;

    return (
      <TruncateText
        data-slot="select-value"
        className={cn('w-full flex-1', className)}
        {...valueProps}
      >
        {displayValue ?? ''}
      </TruncateText>
    );
  }

  const displayValue = selectLabels?.selectedLabel ?? children ?? placeholder;

  return (
    <TruncateText
      data-slot="select-value"
      className={cn('block min-w-0 w-full flex-1', className)}
      {...valueProps}
    >
      {displayValue ?? ''}
    </TruncateText>
  );
}

function SelectTrigger(props: SelectTriggerProps) {
  const {
    className,
    size = 'default',
    children,
    showChevron = true,
    ref: triggerRefProp,
    onClick: onClickProp,
    onPointerDown: onPointerDownProp,
    onKeyDown: onKeyDownProp,
    disabled: triggerDisabled,
    ...triggerProps
  } = props;
  const mobileContext = useMobileSelect();
  const desktopSelectTrigger = useDesktopSelectTrigger();
  const direction = useDirection();
  const handleDesktopTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (desktopSelectTrigger) {
        desktopSelectTrigger.triggerRef.current = node;
      }
      assignRef(triggerRefProp, node);
    },
    [desktopSelectTrigger, triggerRefProp]
  );

  if (mobileContext) {
    return (
      <button
        ref={(node) => assignRef(triggerRefProp, node)}
        type="button"
        data-slot="select-trigger"
        data-size={size}
        disabled={triggerDisabled || mobileContext.disabled}
        dir={direction}
        className={cn(SELECT_TRIGGER_CLASS_NAME, className)}
        onPointerDown={(event) => {
          onPointerDownProp?.(event);
          if (!event.defaultPrevented) {
            hapticFromPointerEvent(event);
          }
        }}
        onClick={(event) => {
          onClickProp?.(event);
          if (!event.defaultPrevented) {
            mobileContext.setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          onKeyDownProp?.(event);
          if (event.defaultPrevented) {
            return;
          }
          if (
            event.key !== 'Enter' &&
            event.key !== ' ' &&
            event.key !== 'ArrowDown' &&
            event.key !== 'ArrowUp'
          ) {
            return;
          }
          event.preventDefault();
          mobileContext.setOpen(true);
        }}
        {...triggerProps}
      >
        {renderSelectTriggerContent(children)}
        {showChevron ? (
          <CaretDownIcon
            className={SELECT_TRIGGER_ICON_CLASS_NAME}
            weight="regular"
          />
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-slot="select-trigger"
      data-size={size}
      disabled={triggerDisabled || desktopSelectTrigger?.disabled}
      dir={direction}
      className={cn(SELECT_TRIGGER_CLASS_NAME, className)}
      onPointerDown={(e) => {
        onPointerDownProp?.(e);
        if (!e.defaultPrevented) {
          hapticFromPointerEvent(e);
        }
      }}
      onKeyDown={(e) => {
        onKeyDownProp?.(e);
        if (e.defaultPrevented || !desktopSelectTrigger) {
          return;
        }
        if (
          e.key !== 'Enter' &&
          e.key !== ' ' &&
          e.key !== 'ArrowDown' &&
          e.key !== 'ArrowUp'
        ) {
          return;
        }
        e.preventDefault();
        desktopSelectTrigger.open();
      }}
      onClick={
        desktopSelectTrigger
          ? (e) => {
              onClickProp?.(e);
              if (!e.defaultPrevented) {
                desktopSelectTrigger.toggleOpen();
              }
            }
          : onClickProp
      }
      {...triggerProps}
      ref={handleDesktopTriggerRef}
    >
      {renderSelectTriggerContent(children)}
      {showChevron ? (
        <CaretDownIcon
          className={SELECT_TRIGGER_ICON_CLASS_NAME}
          weight="regular"
        />
      ) : null}
    </button>
  );
}

function SelectContent(props: SelectContentProps) {
  const {
    className,
    children,
    position = 'popper',
    align = 'center',
    collisionPadding = 16,
    collisionBoundary: _collisionBoundary,
    side,
    sideOffset = 0,
    matchTriggerWidth = true,
    ref: contentRefProp,
    onKeyDown,
    onCloseAutoFocus,
    onAnimationEnd,
    ...contentProps
  } = props;
  const mobileContext = useMobileSelect();
  const selectLabels = useSelectLabels();
  const desktopSelectContent = useDesktopSelectContent();
  const direction = useDirection();
  const touchScreen = useTouchScreen();
  const suppressFloatingOverlayMotion = useSuppressFloatingOverlayMotion();
  const { t } = useTranslation();
  const [slabHighlight, setSlabHighlight] = useState<FloatingSlabState | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<SelectLayout | null>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const preferCheckedOnOpenRef = useRef(false);
  const pointerInsideViewportRef = useRef(false);
  const keepPointerLeaveSlabRef = useRef(false);
  const slabHighlightRef = useRef<FloatingSlabState | null>(null);
  const slabActiveItemRef = useRef<HTMLElement | null>(null);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  const updateSlabHighlight = useCallback(
    (state: React.SetStateAction<FloatingSlabState | null>) => {
      setSlabHighlight((currentSlabHighlight) => {
        const nextSlabHighlight =
          typeof state === 'function' ? state(currentSlabHighlight) : state;

        slabHighlightRef.current = nextSlabHighlight;

        return nextSlabHighlight;
      });
    },
    []
  );

  const setSlabActiveItem = useCallback((itemEl: HTMLElement | null) => {
    const currentItemEl = slabActiveItemRef.current;
    if (currentItemEl === itemEl) {
      return;
    }

    currentItemEl?.removeAttribute('data-slab-active');
    slabActiveItemRef.current = itemEl;
    itemEl?.setAttribute('data-slab-active', 'true');
  }, []);

  const highlightControlsValue = React.useMemo(
    () => ({
      setSlabHighlight: updateSlabHighlight,
      setSlabActiveItem,
      containerRef
    }),
    [setSlabActiveItem, updateSlabHighlight]
  );

  const syncLayout = useCallback(() => {
    const trigger = desktopSelectContent?.triggerRef.current;
    if (!trigger || typeof window === 'undefined') {
      return;
    }

    const nextLayout = getSelectContentLayout({
      align: align ?? 'center',
      collisionPadding,
      direction,
      matchTriggerWidth,
      side,
      sideOffset,
      trigger
    });

    setLayout((currentLayout) =>
      currentLayout &&
      currentLayout.availableHeight === nextLayout.availableHeight &&
      currentLayout.availableWidth === nextLayout.availableWidth &&
      currentLayout.inlineStart === nextLayout.inlineStart &&
      currentLayout.side === nextLayout.side &&
      currentLayout.top === nextLayout.top &&
      currentLayout.triggerHeight === nextLayout.triggerHeight &&
      currentLayout.triggerWidth === nextLayout.triggerWidth &&
      currentLayout.transformOrigin === nextLayout.transformOrigin
        ? currentLayout
        : nextLayout
    );
  }, [
    align,
    collisionPadding,
    desktopSelectContent,
    direction,
    matchTriggerWidth,
    sideOffset,
    side
  ]);

  useLayoutEffect(() => {
    if (mobileContext || !desktopSelectContent?.open) {
      setLayout(null);

      return;
    }

    syncLayout();
    window.addEventListener('resize', syncLayout);
    window.addEventListener('scroll', syncLayout, true);

    return () => {
      window.removeEventListener('resize', syncLayout);
      window.removeEventListener('scroll', syncLayout, true);
    };
  }, [desktopSelectContent?.open, mobileContext, syncLayout]);

  const syncSlabFromViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const highlightedEl = container.querySelector<HTMLElement>(
      '[data-slot="select-item"][data-highlighted]'
    );
    const checkedEl = container.querySelector<HTMLElement>(
      '[data-slot="select-item"][data-state="checked"]'
    );
    // While the cursor hovers the list (and keyboard nav isn't driving the
    // highlight), resolve the item physically under it. A wheel/trackpad scroll
    // slides a new item under the stationary cursor without reliably firing
    // mouseenter, so without this the slab would snap to the checked item (or
    // vanish) instead of following what the user is now pointing at.
    const pointerEl =
      pointerInsideViewportRef.current &&
      !preferCheckedOnOpenRef.current &&
      !highlightedEl
        ? getSelectItemUnderPointer(container, lastPointerPositionRef.current)
        : null;
    const source = resolveSelectSlabSource({
      preferCheckedOnOpen: preferCheckedOnOpenRef.current,
      pointerInsideViewport: pointerInsideViewportRef.current,
      hasHighlighted: highlightedEl != null,
      hasChecked: checkedEl != null,
      hasPointerItem: pointerEl != null,
      hasCurrentSlab: slabHighlightRef.current != null
    });

    if (source === 'keep') {
      return;
    }

    const activeEl =
      source === 'pointer'
        ? pointerEl
        : source === 'highlighted'
          ? highlightedEl
          : source === 'checked'
            ? checkedEl
            : null;
    const shouldKeepPointerLeaveSlab =
      keepPointerLeaveSlabRef.current &&
      !pointerInsideViewportRef.current &&
      !preferCheckedOnOpenRef.current &&
      slabHighlightRef.current != null &&
      (!activeEl || (checkedEl && activeEl === checkedEl));
    if (shouldKeepPointerLeaveSlab) {
      return;
    }

    if (!activeEl) {
      setSlabActiveItem(null);
      updateSlabHighlight(null);

      return;
    }

    const itemValue = activeEl.getAttribute('data-select-item-value');
    if (itemValue == null) {
      setSlabActiveItem(null);
      updateSlabHighlight(null);

      return;
    }

    const itemKey = String(itemValue);
    const layout = getSelectSlabLayout(activeEl, container);
    preferCheckedOnOpenRef.current = false;
    keepPointerLeaveSlabRef.current = false;
    setSlabActiveItem(activeEl);

    updateSlabHighlight((currentSlabHighlight) => {
      const nextSlabHighlight = {
        layout,
        itemKey,
        instantTransition: currentSlabHighlight == null
      };

      return resolveNextSelectSlabHighlight(
        currentSlabHighlight,
        nextSlabHighlight
      );
    });
  }, [setSlabActiveItem, updateSlabHighlight]);

  useLayoutEffect(() => {
    if (mobileContext) {
      return;
    }

    if (!desktopSelectContent?.open) {
      preferCheckedOnOpenRef.current = false;
      pointerInsideViewportRef.current = false;
      keepPointerLeaveSlabRef.current = false;
      setSlabActiveItem(null);
      updateSlabHighlight(null);

      return;
    }

    pointerInsideViewportRef.current = false;
    keepPointerLeaveSlabRef.current = false;
    preferCheckedOnOpenRef.current = true;

    let cancelled = false;
    let unsub: (() => void) | undefined;

    const attachObservers = (): (() => void) | undefined => {
      const container = containerRef.current;
      if (!container) {
        return undefined;
      }

      const queueSync = () => {
        requestAnimationFrame(() => {
          if (!cancelled) {
            syncSlabFromViewport();
          }
        });
      };

      requestAnimationFrame(queueSync);

      const mutationObserver = new MutationObserver(queueSync);
      mutationObserver.observe(container, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-highlighted', 'data-state']
      });

      const onScroll = () => {
        queueSync();
      };
      container.addEventListener('scroll', onScroll, { passive: true });

      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(queueSync)
          : null;
      resizeObserver?.observe(container);

      return () => {
        mutationObserver.disconnect();
        container.removeEventListener('scroll', onScroll);
        resizeObserver?.disconnect();
      };
    };

    unsub = attachObservers();

    let rafId = 0;
    if (!unsub) {
      rafId = requestAnimationFrame(() => {
        unsub = attachObservers();
      });
    }

    return () => {
      cancelled = true;
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
      unsub?.();
    };
  }, [
    mobileContext,
    desktopSelectContent?.open,
    setSlabActiveItem,
    syncSlabFromViewport,
    updateSlabHighlight
  ]);

  // On open, bring the checked item into the vertical middle of the list. Long
  // lists otherwise render from the top with the selection scrolled out of
  // view; short lists that don't overflow stay put (the scroll clamps to 0).
  // This must happen before the first visible paint: the content stays
  // `visibility: hidden` until `layout` is measured, and once `layout` lands
  // this effect re-runs in the same pre-paint flush, so the list never paints
  // unscrolled and then visibly jumps. Centering runs once per open;
  // `layout` also changes on page scroll/resize and must not re-center.
  useLayoutEffect(() => {
    if (mobileContext || !desktopSelectContent?.open) {
      hasCenteredOnOpenRef.current = false;

      return;
    }

    if (!layout || hasCenteredOnOpenRef.current) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    hasCenteredOnOpenRef.current = true;
    const checkedEl = container.querySelector<HTMLElement>(
      '[data-slot="select-item"][data-state="checked"]'
    );
    if (checkedEl) {
      scrollItemToContainerCenter(checkedEl, container);
    }
  }, [mobileContext, desktopSelectContent?.open, layout]);

  React.useEffect(() => {
    return () => setSlabActiveItem(null);
  }, [setSlabActiveItem]);

  React.useEffect(() => {
    selectLabels?.registerItems(children);

    if (mobileContext) {
      mobileContext.setItemsForRegistration(children);
    }
  }, [mobileContext, selectLabels, children]);

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      onCloseAutoFocus?.(event);
    },
    [onCloseAutoFocus]
  );

  const handleContentKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      keepPointerLeaveSlabRef.current = false;
      onKeyDown?.(event);
      if (!event.defaultPrevented && event.key === 'Escape') {
        desktopSelectContent?.setOpen(false);
      }
    },
    [desktopSelectContent, onKeyDown]
  );

  const getNavigableItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return [] as HTMLElement[];
    }

    return Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-slot="select-item"]:not([data-disabled])'
      )
    );
  }, []);

  const setHighlightedItem = useCallback((item: HTMLElement | null) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container
      .querySelectorAll<HTMLElement>(
        '[data-slot="select-item"][data-highlighted]'
      )
      .forEach((el) => {
        if (el !== item) {
          el.removeAttribute('data-highlighted');
        }
      });

    if (item && !item.hasAttribute('data-highlighted')) {
      item.setAttribute('data-highlighted', '');
    }
  }, []);

  const moveHighlight = useCallback(
    (direction: 'next' | 'prev' | 'first' | 'last') => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const items = getNavigableItems();
      if (items.length === 0) {
        return;
      }

      const highlighted = container.querySelector<HTMLElement>(
        '[data-slot="select-item"][data-highlighted]'
      );
      let currentIndex = highlighted ? items.indexOf(highlighted) : -1;
      if (currentIndex === -1) {
        const checked = container.querySelector<HTMLElement>(
          '[data-slot="select-item"][data-state="checked"]:not([data-disabled])'
        );
        currentIndex = checked ? items.indexOf(checked) : -1;
      }

      let nextIndex: number;
      switch (direction) {
        case 'first':
          nextIndex = 0;
          break;
        case 'last':
          nextIndex = items.length - 1;
          break;
        case 'next':
          nextIndex =
            currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
          break;
        case 'prev':
          nextIndex =
            currentIndex < 0 ? items.length - 1 : Math.max(currentIndex - 1, 0);
          break;
      }

      const nextItem = items[nextIndex];
      if (!nextItem) {
        return;
      }

      preferCheckedOnOpenRef.current = false;
      keepPointerLeaveSlabRef.current = false;
      setHighlightedItem(nextItem);
      nextItem.scrollIntoView({ block: 'nearest' });
    },
    [getNavigableItems, setHighlightedItem]
  );

  const selectHighlightedItem = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return false;
    }

    const highlighted = container.querySelector<HTMLElement>(
      '[data-slot="select-item"][data-highlighted]:not([data-disabled])'
    );
    if (!highlighted) {
      return false;
    }

    highlighted.click();

    return true;
  }, []);

  const handleAnimationEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      onAnimationEnd?.(event);
      if (!event.defaultPrevented) {
        syncSlabFromViewport();
      }
    },
    [onAnimationEnd, syncSlabFromViewport]
  );

  const handleContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      assignRef(contentRefProp, node);
    },
    [contentRefProp]
  );

  useTopFloatingLayerDismiss({
    enabled: !mobileContext && !!desktopSelectContent?.open,
    getElements: () => [
      contentRef.current,
      desktopSelectContent?.triggerRef.current
    ],
    close: () => desktopSelectContent?.setOpen(false)
  });

  React.useEffect(() => {
    if (mobileContext || !desktopSelectContent?.open) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          moveHighlight('next');
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          moveHighlight('prev');
          break;
        case 'Home':
          event.preventDefault();
          event.stopPropagation();
          moveHighlight('first');
          break;
        case 'End':
          event.preventDefault();
          event.stopPropagation();
          moveHighlight('last');
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          event.stopPropagation();
          selectHighlightedItem();
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          desktopSelectContent.setOpen(false);
          break;
        case 'Tab':
          desktopSelectContent.setOpen(false);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    mobileContext,
    desktopSelectContent,
    moveHighlight,
    selectHighlightedItem
  ]);

  if (mobileContext) {
    return (
      <DrawerContent
        data-slot="select-content-mobile"
        side="bottom"
        accessibilityTitle={
          mobileContext.selectedLabel ??
          t('common.drawerAccessibility.selectTitle')
        }
        accessibilityDescription={t(
          'common.drawerAccessibility.selectDescription'
        )}
        className="max-h-[70dvh] overflow-hidden flex flex-col p-0"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <div
          className="flex-1 min-w-0 p-2 overflow-x-hidden overflow-y-auto"
          onWheel={handleFloatingOverlayWheelScroll}
        >
          {children}
        </div>
      </DrawerContent>
    );
  }

  if (!desktopSelectContent?.open || typeof document === 'undefined') {
    return null;
  }

  const contentStyle = {
    position: 'fixed',
    top: layout?.top ?? 0,
    insetInlineStart: layout?.inlineStart ?? 0,
    translate: layout?.side === 'top' ? '0 -100%' : undefined,
    visibility: layout ? undefined : 'hidden',
    '--radix-select-trigger-width': `${layout?.triggerWidth ?? 0}px`,
    '--radix-select-trigger-height': `${layout?.triggerHeight ?? 0}px`,
    '--radix-select-content-available-width': `${
      layout?.availableWidth ?? 0
    }px`,
    '--radix-select-content-available-height': `${
      layout?.availableHeight ?? 0
    }px`,
    '--radix-select-content-transform-origin':
      layout?.transformOrigin ?? 'center top'
  } satisfies SelectContentStyle;

  return createPortal(
    <SelectHighlightControlsContext.Provider value={highlightControlsValue}>
      <div
        ref={handleContentRef}
        data-slot="select-content"
        data-state="open"
        data-side={layout?.side ?? 'bottom'}
        dir={direction}
        onKeyDown={handleContentKeyDown}
        onAnimationEnd={handleAnimationEnd}
        className={cn(
          // `pointer-events-auto` is essential: this content is portaled to
          // document.body, and an open modal Dialog (Radix DismissableLayer)
          // sets `body { pointer-events: none }`. Without re-enabling it here
          // the dropdown inherits `none` and becomes non-interactive — items
          // can't be hovered, the highlight won't move, and the list can't be
          // scrolled. Radix's own Select avoids this by being the top
          // DismissableLayer; we re-enable directly instead.
          'pointer-events-auto bg-background-base text-popover-foreground fixed z-[70] flex max-h-(--radix-select-content-available-height) min-w-0 origin-(--radix-select-content-transform-origin) flex-col overflow-hidden rounded-lg border border-border-default shadow-md',
          !suppressFloatingOverlayMotion &&
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            cn(
              matchTriggerWidth
                ? SELECT_CONTENT_MATCH_TRIGGER_WIDTH_CLASS
                : SELECT_CONTENT_INTRINSIC_WIDTH_CLASS,
              'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1'
            ),
          position === 'item-aligned' && 'min-w-32',
          className
        )}
        style={contentStyle}
        {...contentProps}
      >
        <div
          ref={containerRef}
          onWheel={handleFloatingOverlayWheelScroll}
          className={cn(
            'relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1',
            position === 'popper' &&
              cn(
                'w-full scroll-my-1',
                matchTriggerWidth
                  ? 'min-w-0 max-w-[min(var(--radix-select-trigger-width),var(--radix-select-content-available-width))]'
                  : 'min-w-(--radix-select-trigger-width) max-w-(--radix-select-content-available-width)'
              )
          )}
          onMouseEnter={(event) => {
            pointerInsideViewportRef.current = true;
            keepPointerLeaveSlabRef.current = false;
            lastPointerPositionRef.current = {
              x: event.clientX,
              y: event.clientY
            };
          }}
          onMouseMove={(event) => {
            lastPointerPositionRef.current = {
              x: event.clientX,
              y: event.clientY
            };
          }}
          onMouseLeave={() => {
            pointerInsideViewportRef.current = false;
            keepPointerLeaveSlabRef.current = true;
          }}
        >
          <FloatingListSlabLayer
            motionKey="select-highlight"
            roundedClassName="rounded-sm"
            show={!touchScreen.hasTouchCapability}
            slab={slabHighlight}
          />
          {children}
        </div>
      </div>
    </SelectHighlightControlsContext.Provider>,
    document.body
  );
}

function SelectItem(props: SelectItemProps) {
  const {
    className,
    children,
    value,
    disabled = false,
    onClick: onClickProp,
    onMouseEnter: onMouseEnterProp,
    onPointerDown: onPointerDownProp,
    itemLabel,
    textValue,
    ...itemProps
  } = props;
  const touchScreen = useTouchScreen();
  const mobileContext = useMobileSelect();
  const selectLabels = useSelectLabels();
  const desktopSelectContent = useDesktopSelectContent();
  const direction = useDirection();
  const { itemRef, onMouseEnter } = useSelectItemHighlight(value);
  const isSelected = desktopSelectContent?.value === value;

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseEnter();
    onMouseEnterProp?.(e);
  };

  const childrenLabel = getSelectNodeText(children).trim();
  const labelText =
    itemLabel ?? (childrenLabel.length > 0 ? childrenLabel : undefined);

  React.useLayoutEffect(() => {
    if (mobileContext && labelText) {
      mobileContext.registerItem(value, labelText);
    }

    if (selectLabels && labelText) {
      selectLabels.registerItem(value, labelText);
    }
  }, [mobileContext, selectLabels, value, labelText]);

  if (mobileContext) {
    const isSelected = mobileContext.value === value;

    return (
      <button
        type="button"
        data-slot="select-item"
        disabled={disabled}
        dir={direction}
        className={cn(
          'relative flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-lg ps-3 pe-2 py-3 text-base outline-hidden select-none transition-colors [&_div]:text-inherit [&_p]:text-inherit [&_span]:text-inherit [&_svg]:text-inherit',
          isSelected
            ? 'bg-secondary text-secondary-foreground'
            : 'text-text-secondary hover:bg-background-muted hover:text-text-primary',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
        onPointerDown={(event) => {
          onPointerDownProp?.(event as never);
          if (event.defaultPrevented || disabled) {
            return;
          }
          hapticFromPointerEvent(event);
        }}
        onClick={(event) => {
          onClickProp?.(event as never);
          if (event.defaultPrevented || disabled) {
            return;
          }
          mobileContext.onValueChange?.(value, labelText);
        }}
      >
        <span className={SELECT_ITEM_TEXT_CLASS_NAME}>
          {renderSelectItemText(children)}
        </span>
        <span className="flex size-5 shrink-0 items-center justify-center">
          {isSelected && <CheckIcon className="size-5" weight="bold" />}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={itemRef}
      data-slot="select-item"
      data-select-item-value={value}
      data-state={isSelected ? 'checked' : 'unchecked'}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        "relative z-10 flex min-h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-sm ps-2 pe-2 py-1.5 text-sm text-text-secondary outline-hidden select-none transition-colors duration-200 data-[state=checked]:font-medium data-[state=checked]:text-text-primary data-[highlighted]:text-secondary-foreground data-[slab-active=true]:text-secondary-foreground data-[state=checked]:data-[highlighted]:text-secondary-foreground data-[state=checked]:data-[slab-active=true]:text-secondary-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_div]:text-inherit [&_p]:text-inherit [&_span]:text-inherit [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-inherit [&_svg:not([class*='size-'])]:size-4",
        touchScreen.hasTouchCapability && 'data-[highlighted]:bg-secondary',
        className
      )}
      onClick={(event) => {
        onClickProp?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }
        desktopSelectContent?.setValue(value, labelText ?? textValue);
      }}
      onMouseEnter={handleMouseEnter}
      onPointerDown={(e) => {
        onPointerDownProp?.(e);
        if (e.defaultPrevented || disabled) {
          return;
        }
        hapticFromPointerEvent(e);
      }}
      {...itemProps}
      dir={direction}
    >
      <span className={SELECT_ITEM_TEXT_CLASS_NAME}>
        <span data-slot="select-item-text">
          {renderSelectItemText(children)}
        </span>
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {isSelected ? <CheckIcon className="size-4" weight="regular" /> : null}
      </span>
    </div>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
