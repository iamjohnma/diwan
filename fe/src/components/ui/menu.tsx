'use client';

import * as React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState
} from 'react';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { useTopFloatingLayerDismiss } from '@/components/ui/floating-layer';
import {
  FloatingListSlabLayer,
  type FloatingSlabState,
  type FloatingSlabVariant,
  getFloatingSlabLayout,
  isSlabOverItem
} from '@/components/ui/floating-list-slab';
import { useSuppressFloatingOverlayMotion } from '@/components/ui/popover';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { cn } from '@/utils/common/cn';
import { handleFloatingOverlayWheelScroll } from '@/utils/common/floating-overlay-wheel-scroll';
import { hapticFromPointerEvent } from '@/utils/common/haptics';

interface MenuLayerContextValue {
  triggerRef: React.RefObject<HTMLElement | null>;
  positionerRef: React.RefObject<HTMLDivElement | null>;
}

interface MenuHighlightContextValue {
  slab: FloatingSlabState | null;
  setSlab: (state: FloatingSlabState | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const MenuLayerContext = createContext<MenuLayerContextValue | null>(null);

const MenuHighlightContext = createContext<MenuHighlightContextValue | null>(
  null
);

function useMenuLayer() {
  return useContext(MenuLayerContext);
}

function useMenuHighlight() {
  return useContext(MenuHighlightContext);
}

function useMenuItemHighlight(
  itemKey: string,
  variant: FloatingSlabVariant = 'default'
) {
  const highlightContext = useMenuHighlight();
  const itemRef = useRef<HTMLDivElement>(null);

  const onMouseEnter = useCallback(() => {
    if (!highlightContext || !itemRef.current) return;

    const container = highlightContext.containerRef.current;
    if (!container) return;

    highlightContext.setSlab({
      layout: getFloatingSlabLayout(itemRef.current, container),
      itemKey: String(itemKey),
      variant
    });
  }, [highlightContext, itemKey, variant]);

  return { itemRef, onMouseEnter };
}

function Menu(props: MenuPrimitive.Root.Props) {
  const {
    children,
    onOpenChange,
    actionsRef: actionsRefProp,
    open: controlledOpen,
    defaultOpen,
    ...rootProps
  } = props;
  const internalActionsRef = useRef<MenuPrimitive.Root.Actions | null>(null);
  const actionsRef = actionsRefProp ?? internalActionsRef;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen ?? false
  );
  const triggerRef = useRef<HTMLElement | null>(null);
  const positionerRef = useRef<HTMLDivElement | null>(null);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const layerContextValue = React.useMemo(
    () => ({ triggerRef, positionerRef }),
    []
  );
  const close = useCallback(() => {
    actionsRef.current?.close();
  }, [actionsRef]);

  const handleOpenChange = useCallback<
    NonNullable<MenuPrimitive.Root.Props['onOpenChange']>
  >(
    (nextOpen, eventDetails) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen, eventDetails);
      if (!nextOpen && !eventDetails.isCanceled) {
        (document.activeElement as HTMLElement)?.blur();
      }
    },
    [controlledOpen, onOpenChange]
  );

  useTopFloatingLayerDismiss({
    enabled: isOpen,
    getElements: () => [positionerRef.current, triggerRef.current],
    close
  });

  return (
    <MenuLayerContext.Provider value={layerContextValue}>
      <MenuPrimitive.Root
        {...rootProps}
        actionsRef={actionsRef}
        defaultOpen={defaultOpen}
        open={controlledOpen}
        onOpenChange={handleOpenChange}
      >
        {children}
      </MenuPrimitive.Root>
    </MenuLayerContext.Provider>
  );
}

function MenuTrigger(props: MenuPrimitive.Trigger.Props) {
  const {
    onClick: onClickProp,
    onPointerDown: onPointerDownProp,
    onKeyDown: onKeyDownProp,
    ...rest
  } = props;
  const menuLayer = useMenuLayer();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event as never);
    },
    [onClickProp]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDownProp?.(event as never);
      if (event.defaultPrevented || rest.disabled) {
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      // Activate via keydown with preventDefault so Enter never falls
      event.preventDefault();
      event.currentTarget.click();
    },
    [onKeyDownProp, rest.disabled]
  );

  const handleTriggerRef = useCallback(
    (node: HTMLElement | null) => {
      if (menuLayer) {
        menuLayer.triggerRef.current = node;
      }
    },
    [menuLayer]
  );

  return (
    <MenuPrimitive.Trigger
      ref={handleTriggerRef}
      data-slot="menu-trigger"
      {...rest}
      onPointerDown={(e) => {
        onPointerDownProp?.(e);
        if (e.defaultPrevented || rest.disabled) {
          return;
        }
        hapticFromPointerEvent(e);
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  );
}

function MenuPopup(
  props: MenuPrimitive.Popup.Props & {
    align?: MenuPrimitive.Positioner.Props['align'];
    sideOffset?: MenuPrimitive.Positioner.Props['sideOffset'];
    alignOffset?: MenuPrimitive.Positioner.Props['alignOffset'];
    side?: MenuPrimitive.Positioner.Props['side'];
    collisionPadding?: MenuPrimitive.Positioner.Props['collisionPadding'];
  }
) {
  const {
    children,
    className,
    sideOffset = 4,
    align = 'center',
    alignOffset,
    side = 'bottom',
    collisionPadding = 16,
    ...popupProps
  } = props;

  const touchScreen = useTouchScreen();
  const suppressFloatingOverlayMotion = useSuppressFloatingOverlayMotion();
  const [slab, setSlab] = useState<FloatingSlabState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuLayer = useMenuLayer();

  const contextValue = React.useMemo(
    () => ({ slab, setSlab, containerRef }),
    [slab]
  );
  const handlePositionerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (menuLayer) {
        menuLayer.positionerRef.current = node;
      }
    },
    [menuLayer]
  );

  return (
    <MenuHighlightContext.Provider value={contextValue}>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          align={align}
          alignOffset={alignOffset}
          className="pointer-events-auto z-[70]"
          collisionPadding={collisionPadding}
          data-slot="menu-positioner"
          ref={handlePositionerRef}
          side={side}
          sideOffset={sideOffset}
        >
          <MenuPrimitive.Popup
            className={cn(
              'relative flex not-[class*="w-"]:min-w-40 origin-(--transform-origin) rounded-xl border border-border-default bg-background-overlay text-text-primary shadow-lg outline-none focus:outline-none',
              !suppressFloatingOverlayMotion &&
                'data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:slide-out-to-top-2 data-[open]:slide-in-from-top-2',
              className
            )}
            data-slot="menu-popup"
            {...popupProps}
          >
            <div
              ref={containerRef}
              className="relative max-h-(--available-height) w-full overflow-y-auto p-1.5"
              onMouseLeave={() => setSlab(null)}
              onWheel={handleFloatingOverlayWheelScroll}
            >
              <FloatingListSlabLayer
                motionKey="menu-highlight"
                roundedClassName="rounded-lg"
                show={!touchScreen.hasTouchCapability}
                slab={slab}
              />
              {children}
            </div>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuHighlightContext.Provider>
  );
}

function MenuItem(
  props: MenuPrimitive.Item.Props & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  }
) {
  const {
    className,
    inset,
    variant = 'default',
    disabled,
    onMouseEnter: onMouseEnterProp,
    onPointerDown: onPointerDownProp,
    ...itemProps
  } = props;

  const itemKey = useId();
  const menuHighlight = useMenuHighlight();
  const { itemRef, onMouseEnter } = useMenuItemHighlight(
    itemKey,
    variant === 'destructive' ? 'destructive' : 'default'
  );
  const isUnderSlab = isSlabOverItem(menuHighlight?.slab, itemKey);

  const handleMouseEnter: MenuPrimitive.Item.Props['onMouseEnter'] = (e) => {
    onMouseEnter();
    onMouseEnterProp?.(e);
  };

  return (
    <MenuPrimitive.Item
      ref={itemRef}
      className={cn(
        'relative z-10 flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-200 data-disabled:pointer-events-none data-highlighted:text-secondary-foreground data-inset:ps-10 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:text-destructive data-disabled:opacity-50 [&_div]:text-inherit [&_p]:text-inherit [&_span]:text-inherit [&_svg:not([class*="size-"])]:size-5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-inherit',
        isUnderSlab &&
          variant === 'destructive' &&
          'text-destructive data-[variant=destructive]:text-destructive',
        isUnderSlab && variant !== 'destructive' && 'text-secondary-foreground',
        className
      )}
      data-inset={inset}
      data-slot="menu-item"
      data-variant={variant}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onPointerDown={(e) => {
        onPointerDownProp?.(e);
        if (e.defaultPrevented || disabled) {
          return;
        }
        hapticFromPointerEvent(e);
      }}
      {...itemProps}
    />
  );
}

function MenuSeparator(props: MenuPrimitive.Separator.Props) {
  const { className, ...separatorProps } = props;

  return (
    <MenuPrimitive.Separator
      className={cn('-mx-1.5 my-1.5 h-px bg-border', className)}
      data-slot="menu-separator"
      {...separatorProps}
    />
  );
}

export {
  Menu,
  Menu as DropdownMenu,
  MenuTrigger,
  MenuTrigger as DropdownMenuTrigger,
  MenuPopup,
  MenuPopup as DropdownMenuContent,
  MenuItem,
  MenuItem as DropdownMenuItem,
  MenuSeparator,
  MenuSeparator as DropdownMenuSeparator
};
