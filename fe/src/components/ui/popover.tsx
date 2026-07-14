import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  useInDrawer
} from '@/components/ui/drawer';
import {
  useFloatingLayerContainer,
  useTopFloatingLayerDismiss
} from '@/components/ui/floating-layer';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useDirection } from '@/hooks/common/direction';
import { assignRef } from '@/utils/common/assign-ref';
import { cn } from '@/utils/common/cn';
import { hapticFromPointerEvent } from '@/utils/common/haptics';
import { handleOpenOverlayAutoFocus } from '@/utils/common/open-overlay-autofocus';

const SuppressFloatingOverlayMotionContext = React.createContext(false);

function useSuppressFloatingOverlayMotion() {
  return React.useContext(SuppressFloatingOverlayMotionContext);
}

type PopoverMode = 'popover' | 'drawer';
type PopoverContentProps = React.ComponentProps<
  typeof PopoverPrimitive.Content
> & {
  nestedEnterAnimation?: boolean;

  disableMotion?: boolean;
};
type PopoverOutsideInteractionEvent = Parameters<
  NonNullable<PopoverContentProps['onInteractOutside']>
>[0];

// A dialog/drawer opened *from* a popover (its trigger lives outside the dialog)
// should not dismiss that popover — it stays open behind the dialog and is there
// again once the dialog closes. The trigger-containment check in
// `isNestedFloatingLayerTarget` keeps the common case intact: a Select whose
// trigger is *inside* a dialog still closes when you click elsewhere in it.
const NESTED_FLOATING_LAYER_SELECTOR =
  '[data-dms-floating-overlay], [data-slot="menu-positioner"], [data-slot="select-content"], [data-slot="select-content-mobile"], [data-slot="dialog-content"], [data-slot="dialog-overlay"]';

function stopOutsideInteractionPropagation(
  event: PopoverOutsideInteractionEvent
) {
  event.stopPropagation();
  event.detail?.originalEvent.stopPropagation();
  event.detail?.originalEvent.stopImmediatePropagation();
}

// A dialog overlay is a *sibling* of its dialog content inside the shared
// `dialog-layer` wrapper, so it never `contains()` a trigger that lives in
// the content. Judge overlay clicks by the whole dialog layer instead —
// otherwise a MODAL popover opened from inside a dialog can never be
// dismissed: Radix demotes the dialog content to pointer-events:none while
// the popover is open, so every real outside click hit-tests to the
// (pointer-events-auto) overlay and was misread as a foreign layer.
function resolveFloatingLayerScope(floatingLayer: Element) {
  if (floatingLayer.matches('[data-slot="dialog-overlay"]')) {
    return floatingLayer.closest('[data-slot="dialog-layer"]') ?? floatingLayer;
  }

  return floatingLayer;
}

// A click on a floating layer that isn't this popover is normally ignored so
// the popover stays open while you interact with a nested child layer (a
// Select/menu opened from inside it). But the panel/overlay this popover was
// opened *from* also matches the selector, and clicking it SHOULD dismiss the
// popover. Tell them apart: an ancestor layer contains this popover's trigger.
function isNestedFloatingLayerTarget(
  target: EventTarget | null | undefined,
  trigger: Element | null | undefined
) {
  if (!(target instanceof Element)) {
    return false;
  }

  const floatingLayer = target.closest(NESTED_FLOATING_LAYER_SELECTOR);
  if (!floatingLayer) {
    return false;
  }

  return !(
    trigger && resolveFloatingLayerScope(floatingLayer).contains(trigger)
  );
}

function isNestedFloatingLayerInteraction(
  event: PopoverOutsideInteractionEvent,
  trigger: Element | null | undefined
) {
  return isNestedFloatingLayerTarget(
    event.detail?.originalEvent.target,
    trigger
  );
}

const PopoverModeContext = React.createContext<PopoverMode>('popover');

function usePopoverMode() {
  return React.useContext(PopoverModeContext);
}

interface PopoverOpenContextValue {
  openPopover: () => void;
  closePopover: () => void;
  isOpen: boolean;
  openedByMouseDown: React.RefObject<boolean>;
  triggerRef: React.RefObject<HTMLElement | null>;
  openOnClick: boolean;
}

const PopoverOpenContext = React.createContext<PopoverOpenContextValue | null>(
  null
);

function Popover(
  props: React.ComponentProps<typeof PopoverPrimitive.Root> & {
    // Opt the trigger into opening on click instead of on pointer-down (press).
    // Defaults to the app-wide open-on-press behavior.
    openOnClick?: boolean;
  }
) {
  const {
    modal: modalProp,
    onOpenChange,
    openOnClick = false,
    ...rootProps
  } = props;
  const {
    open: controlledOpen,
    defaultOpen,
    children,
    ...restRootProps
  } = rootProps;
  const { isMobile } = useBreakpoint();
  const inDrawer = useInDrawer();
  const mode: PopoverMode = isMobile ? 'drawer' : 'popover';

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const openedByMouseDown = React.useRef(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const open = isControlled ? controlledOpen : internalOpen;

  const directSetOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (openedByMouseDown.current) {
        openedByMouseDown.current = false;
        if (!nextOpen) {
          return;
        }
      }
      directSetOpen(nextOpen);
    },
    [directSetOpen]
  );

  const openPopover = React.useCallback(() => {
    directSetOpen(true);
  }, [directSetOpen]);

  const closePopover = React.useCallback(() => {
    directSetOpen(false);
  }, [directSetOpen]);

  const contextValue = React.useMemo(
    () => ({
      openPopover,
      closePopover,
      isOpen: open,
      openedByMouseDown,
      triggerRef,
      openOnClick
    }),
    [closePopover, openPopover, open, openOnClick]
  );

  if (mode === 'drawer') {
    return (
      <PopoverOpenContext.Provider value={contextValue}>
        <PopoverModeContext.Provider value={mode}>
          <Drawer open={open} onOpenChange={handleOpenChange}>
            {children}
          </Drawer>
        </PopoverModeContext.Provider>
      </PopoverOpenContext.Provider>
    );
  }

  const modal = modalProp ?? inDrawer;

  return (
    <PopoverOpenContext.Provider value={contextValue}>
      <PopoverModeContext.Provider value={mode}>
        <PopoverPrimitive.Root
          data-slot="popover"
          modal={modal}
          open={open}
          onOpenChange={handleOpenChange}
          {...restRootProps}
        >
          {children}
        </PopoverPrimitive.Root>
      </PopoverModeContext.Provider>
    </PopoverOpenContext.Provider>
  );
}

function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
  const {
    ref: triggerRefProp,
    onClick: onClickProp,
    onPointerDown: onPointerDownProp,
    onKeyDown: onKeyDownProp,
    ...triggerProps
  } = props;
  const mode = usePopoverMode();
  const popoverOpenContext = React.useContext(PopoverOpenContext);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event as never);
    },
    [onClickProp]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDownProp?.(event);
      if (event.defaultPrevented || triggerProps.disabled) {
        return;
      }
      if (event.key !== 'Enter' || !popoverOpenContext) {
        return;
      }
      // Toggle on keydown with preventDefault so Enter never falls through
      // to outer handlers (e.g. dialog Enter-to-submit).
      event.preventDefault();
      if (popoverOpenContext.isOpen) {
        popoverOpenContext.closePopover();
      } else {
        popoverOpenContext.openPopover();
      }
    },
    [onKeyDownProp, popoverOpenContext, triggerProps.disabled]
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDownProp?.(event);
      if (event.defaultPrevented || triggerProps.disabled) {
        return;
      }
      hapticFromPointerEvent(event);
      if (event.button !== 0) return;
      // Opt-out pickers open on the trigger's click toggle instead, so a press
      // alone never opens — leaving the open-on-press behavior elsewhere intact.
      if (popoverOpenContext?.openOnClick) return;
      // Open-on-press is a mouse affordance only. Touch (and pen) fall through
      // to the trigger's native click toggle so the popover opens on tap
      // release, not the moment the finger lands (which would defeat
      // scroll-cancel and feel jumpy).
      if (event.pointerType !== 'mouse') return;
      if (popoverOpenContext && !popoverOpenContext.isOpen) {
        popoverOpenContext.openedByMouseDown.current = true;
        popoverOpenContext.openPopover();

        cleanupRef.current?.();
        const resetOnPointerUp = () => {
          setTimeout(() => {
            popoverOpenContext.openedByMouseDown.current = false;
          }, 0);
          cleanupRef.current = null;
        };
        document.addEventListener('pointerup', resetOnPointerUp, {
          once: true
        });
        cleanupRef.current = () => {
          document.removeEventListener('pointerup', resetOnPointerUp);
        };
      }
    },
    [onPointerDownProp, popoverOpenContext, triggerProps.disabled]
  );

  const handleTriggerRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      if (popoverOpenContext) {
        popoverOpenContext.triggerRef.current = node;
      }
      assignRef(triggerRefProp, node);
    },
    [popoverOpenContext, triggerRefProp]
  );

  if (mode === 'drawer') {
    return (
      <DrawerTrigger
        {...triggerProps}
        ref={handleTriggerRef}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      {...triggerProps}
      ref={handleTriggerRef}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  );
}

function PopoverContent(props: PopoverContentProps) {
  const {
    className,
    nestedEnterAnimation = false,
    disableMotion = false,
    align = 'center',
    sideOffset = 4,
    collisionPadding = 16,
    children,
    ref: contentRefProp,
    onInteractOutside,
    onPointerDownOutside,
    onCloseAutoFocus,
    onOpenAutoFocus: userOnOpenAutoFocus,
    ...contentProps
  } = props;
  const mode = usePopoverMode();
  const inDrawer = useInDrawer();
  const direction = useDirection();
  const floatingLayerContainer = useFloatingLayerContainer();
  const popoverOpenContext = React.useContext(PopoverOpenContext);
  const shouldContainOutsideInteractions = mode === 'popover' && inDrawer;
  const suppressFloatingOverlayMotion = useSuppressFloatingOverlayMotion();
  const { t } = useTranslation();
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const handleInteractOutside = React.useCallback<
    NonNullable<PopoverContentProps['onInteractOutside']>
  >(
    (event) => {
      onInteractOutside?.(event);

      if (
        isNestedFloatingLayerInteraction(
          event,
          popoverOpenContext?.triggerRef.current
        )
      ) {
        event.preventDefault();
      }

      if (shouldContainOutsideInteractions) {
        stopOutsideInteractionPropagation(event);
      }
    },
    [onInteractOutside, popoverOpenContext, shouldContainOutsideInteractions]
  );

  const handlePointerDownOutside = React.useCallback<
    NonNullable<PopoverContentProps['onPointerDownOutside']>
  >(
    (event) => {
      onPointerDownOutside?.(event);

      if (
        isNestedFloatingLayerInteraction(
          event,
          popoverOpenContext?.triggerRef.current
        )
      ) {
        event.preventDefault();
      }

      if (shouldContainOutsideInteractions) {
        stopOutsideInteractionPropagation(event);
      }
    },
    [onPointerDownOutside, popoverOpenContext, shouldContainOutsideInteractions]
  );

  const handleCloseAutoFocus = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      onCloseAutoFocus?.(event);
    },
    [onCloseAutoFocus]
  );

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      handleOpenOverlayAutoFocus(event, userOnOpenAutoFocus);
    },
    [userOnOpenAutoFocus]
  );

  const handleContentRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      assignRef(contentRefProp, node);
    },
    [contentRefProp]
  );

  useTopFloatingLayerDismiss({
    enabled: mode === 'popover' && !!popoverOpenContext?.isOpen,
    getElements: () => [
      contentRef.current,
      popoverOpenContext?.triggerRef.current
    ],
    close: () => popoverOpenContext?.closePopover(),
    ignoreOutsideEvent: (event) =>
      isNestedFloatingLayerTarget(
        event.target,
        popoverOpenContext?.triggerRef.current
      )
  });

  if (mode === 'drawer') {
    return (
      <DrawerContent
        data-slot="popover-content"
        side="bottom"
        accessibilityTitle={t('common.drawerAccessibility.popoverTitle')}
        accessibilityDescription={t(
          'common.drawerAccessibility.popoverDescription'
        )}
        className={cn(
          'flex max-h-[85dvh] min-h-0 flex-col overflow-hidden !w-full !max-w-none p-0',
          className
        )}
        onCloseAutoFocus={handleCloseAutoFocus}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        {children}
      </DrawerContent>
    );
  }

  const surfaceMotionClassName = (() => {
    if (disableMotion) {
      return '';
    }
    if (suppressFloatingOverlayMotion && !nestedEnterAnimation) {
      return '';
    }
    if (nestedEnterAnimation) {
      return 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0';
    }

    return 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2';
  })();

  const defaultPopoverPanelClassName =
    'bg-background-base text-popover-foreground w-[calc(100vw-2rem)] sm:w-72 max-w-sm rounded-xl border p-4 shadow-md';

  // Inside a Dialog/Drawer/command-palette floating-layer container the popover
  // portals into that overlay's own (z-60) stacking context, so a high value
  // only orders it locally and never escapes the overlay. At the base page level
  // there is no container: the popover portals to <body>, so its z-index
  // competes globally and must stay BELOW dialogs/drawers (z-50) — otherwise an
  // open base-page dropdown floats over any dialog that opens on top of it.
  const layerZIndexClassName = floatingLayerContainer ? 'z-[70]' : 'z-45';

  return (
    <PopoverPrimitive.Portal container={floatingLayerContainer ?? undefined}>
      <PopoverPrimitive.Content
        ref={handleContentRef}
        data-dms-floating-overlay=""
        data-slot="popover-content"
        dir={direction}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        onCloseAutoFocus={handleCloseAutoFocus}
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handlePointerDownOutside}
        className={
          nestedEnterAnimation
            ? cn(
                'pointer-events-auto w-max max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) border-0 bg-transparent p-0 shadow-none rounded-none outline-hidden',
                layerZIndexClassName,
                surfaceMotionClassName
              )
            : cn(
                defaultPopoverPanelClassName,
                'pointer-events-auto origin-(--radix-popover-content-transform-origin) outline-hidden',
                layerZIndexClassName,
                surfaceMotionClassName,
                className
              )
        }
        {...contentProps}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        {nestedEnterAnimation ? (
          <div
            className={cn(
              'animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out outline-hidden',
              defaultPopoverPanelClassName,
              className
            )}
          >
            <SuppressFloatingOverlayMotionContext.Provider value={true}>
              {children}
            </SuppressFloatingOverlayMotionContext.Provider>
          </div>
        ) : (
          children
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor(
  props: React.ComponentProps<typeof PopoverPrimitive.Anchor>
) {
  const { ...anchorProps } = props;
  const mode = usePopoverMode();

  if (mode === 'drawer') {
    return null;
  }

  return (
    <PopoverPrimitive.Anchor data-slot="popover-anchor" {...anchorProps} />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  usePopoverMode,
  useSuppressFloatingOverlayMotion
};
