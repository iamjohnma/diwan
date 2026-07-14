import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Drawer as DrawerPrimitive } from 'vaul';
import { FloatingLayerProvider } from '@/components/ui/floating-layer';
import { cn } from '@/lib/utils';
import { useSidebarNavStore } from '@/stores/sidebar-nav';
import { assignRef } from '@/utils/common/assign-ref';
import { handleOpenOverlayAutoFocus } from '@/utils/common/open-overlay-autofocus';

const InDrawerContext = React.createContext(false);

export function useInDrawer() {
  return React.useContext(InDrawerContext);
}

type DrawerSide = 'top' | 'bottom' | 'left' | 'right';

interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseRgbaColor(colorValue: string): RgbaColor | null {
  const channels = colorValue.match(/[\d.]+/g);

  if (!channels || channels.length < 3) {
    return null;
  }

  const red = Number(channels[0]);
  const green = Number(channels[1]);
  const blue = Number(channels[2]);
  const alpha = channels[3] !== undefined ? Number(channels[3]) : 1;

  if ([red, green, blue, alpha].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { red, green, blue, alpha };
}

function findFirstOpaqueBackgroundNode(node: HTMLElement): HTMLElement | null {
  const queue = Array.from(node.children) as HTMLElement[];

  while (queue.length > 0) {
    const candidateNode = queue.shift();
    if (!candidateNode) {
      break;
    }

    const backgroundColor = parseRgbaColor(
      window.getComputedStyle(candidateNode).backgroundColor
    );

    if (backgroundColor && backgroundColor.alpha > 0.01) {
      return candidateNode;
    }

    queue.push(...(Array.from(candidateNode.children) as HTMLElement[]));
  }

  return null;
}

function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const closeMobileSidebar = useSidebarNavStore((state) => state.closeMobile);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        closeMobileSidebar();
      }

      props.onOpenChange?.(nextOpen);
    },
    [closeMobileSidebar, props]
  );

  return (
    <DrawerPrimitive.Root
      noBodyStyles
      // Vaul's visualViewport repositioning lifts the sheet when the mobile
      // keyboard opens, but often fails to clear the inline `bottom`/`height`
      // it wrote when the keyboard closes — leaving the sheet stuck mid-screen.
      // Disable it and let the browser scroll focused inputs into view.
      // Callers can still opt back in via `repositionInputs`.
      repositionInputs={false}
      {...props}
      onOpenChange={handleOpenChange}
    />
  );
}

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

export const DrawerClose = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Close>
>((props, ref) => {
  return <DrawerPrimitive.Close ref={ref} {...props} />;
});
DrawerClose.displayName = DrawerPrimitive.Close.displayName;

function DrawerOverlay(
  props: React.ComponentProps<typeof DrawerPrimitive.Overlay>
) {
  const { className, ...overlayProps } = props;

  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...overlayProps}
    />
  );
}

const drawerVariants = cva(
  'fixed z-50 flex min-h-0 flex-col gap-4 overflow-hidden bg-background p-6 outline-hidden',
  {
    variants: {
      side: {
        // Bottom sheets sit flush to the viewport edge — a downward box-shadow
        // bleeds past the sheet as a grey band under the content. Side/top
        // drawers keep elevation via shadow-lg.
        top: 'inset-x-0 top-0 max-h-dvh rounded-b-2xl border-b shadow-lg',
        bottom: 'inset-x-0 bottom-0 max-h-dvh rounded-t-2xl border-t',
        left: 'inset-y-0 left-0 h-full w-3/4 border-e shadow-lg sm:max-w-sm',
        right: 'inset-y-0 right-0 h-full w-3/4 border-s shadow-lg sm:max-w-sm'
      },
      fitContent: {
        true: 'h-auto',
        false: ''
      }
    },
    compoundVariants: [
      {
        side: 'bottom',
        fitContent: true,
        className: 'max-h-dvh'
      },
      {
        side: 'top',
        fitContent: true,
        className: 'max-h-dvh'
      }
    ],
    defaultVariants: {
      side: 'bottom',
      fitContent: false
    }
  }
);

interface DrawerContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>,
    VariantProps<typeof drawerVariants> {
  showDragHandle?: boolean;
  disableSwipe?: boolean;
  fitContent?: boolean;
  overlayClassName?: string;
  floatingLayerClassName?: string;
  accessibilityTitle?: React.ReactNode;
  accessibilityDescription?: React.ReactNode;
  /**
   * Vaul escape hatch: 'false' suppresses the open/close keyframe animations
   * (its stylesheet applies `animation: none !important`). Mirrored onto the
   * overlay as well so the panel slide-in and the overlay fade-in are
   * suppressed together — otherwise a caller that already animated the drawer
   * in (e.g. the sidebar edge-swipe preview) gets a second overlay fade
   * stacked on top of its own.
   */
  'data-vaul-animate'?: 'true' | 'false';
}

type DrawerPointerEventType = 'pointerdown' | 'pointermove' | 'pointerup';

type DrawerPointerDownOutsideEvent = Parameters<
  NonNullable<
    React.ComponentPropsWithoutRef<
      typeof DrawerPrimitive.Content
    >['onPointerDownOutside']
  >
>[0];

interface OutsideDragState {
  pointerId: number;
  startX: number;
  startY: number;
}

function dispatchDrawerPointerEvent(
  eventType: DrawerPointerEventType,
  sourceEvent: React.PointerEvent,
  targetNode: HTMLElement
) {
  const pointerEvent = new PointerEvent(eventType, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: sourceEvent.pointerId,
    pointerType: sourceEvent.pointerType,
    isPrimary: sourceEvent.isPrimary,
    button: sourceEvent.button,
    buttons: sourceEvent.buttons,
    clientX: sourceEvent.clientX,
    clientY: sourceEvent.clientY,
    screenX: sourceEvent.screenX,
    screenY: sourceEvent.screenY,
    altKey: sourceEvent.altKey,
    ctrlKey: sourceEvent.ctrlKey,
    metaKey: sourceEvent.metaKey,
    shiftKey: sourceEvent.shiftKey
  });

  targetNode.dispatchEvent(pointerEvent);

  if (pointerEvent.defaultPrevented) {
    sourceEvent.preventDefault();
  }
}

function getOutsideDragMoveThreshold(pointerType: string) {
  return pointerType === 'touch' ? 10 : 2;
}

function DrawerHandle(
  props: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Handle>
) {
  const { className, style, ...handleProps } = props;

  return (
    <div
      data-slot="drawer-handle"
      className="flex shrink-0 items-center justify-center pt-3 pb-1.5"
      style={{
        backgroundColor: 'var(--drawer-handle-bg, var(--background))'
      }}
    >
      <DrawerPrimitive.Handle
        className={cn('h-1.5 w-12 rounded-full bg-foreground/20', className)}
        style={style}
        {...handleProps}
      />
    </div>
  );
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  DrawerContentProps
>((contentProps, ref) => {
  const {
    side = 'bottom',
    className,
    children,
    showDragHandle: showDragHandleProp,
    disableSwipe: disableSwipeProp,
    fitContent = false,
    overlayClassName,
    floatingLayerClassName,
    accessibilityTitle,
    accessibilityDescription,
    onCloseAutoFocus,
    onOpenAutoFocus: userOnOpenAutoFocus,
    onPointerDownOutside: userOnPointerDownOutside,
    'data-vaul-animate': dataVaulAnimate,
    ...primitiveContentProps
  } = contentProps;

  // Vaul computes its own data-vaul-animate before spreading incoming props,
  // so passing an explicit `undefined` would override and strip its value.
  // Only include the key when the caller actually set it.
  const vaulAnimateProps =
    dataVaulAnimate !== undefined
      ? ({ 'data-vaul-animate': dataVaulAnimate } as const)
      : undefined;

  const isBottomDrawer = side === 'bottom';
  const showDragHandle = showDragHandleProp ?? isBottomDrawer;
  const disableSwipe = disableSwipeProp ?? !isBottomDrawer;
  const contentRef =
    React.useRef<React.ElementRef<typeof DrawerPrimitive.Content>>(null);
  const outsideDragStateRef = React.useRef<OutsideDragState | null>(null);
  const shouldSuppressOverlayClickRef = React.useRef(false);
  const [floatingLayerContainer, setFloatingLayerContainer] =
    React.useState<HTMLDivElement | null>(null);

  const hasExplicitBackgroundClass = React.useMemo(() => {
    if (!className) {
      return false;
    }

    return /(?:^|\s)bg-[^\s]+/.test(className);
  }, [className]);

  const setContentRef = React.useCallback(
    (node: React.ElementRef<typeof DrawerPrimitive.Content> | null) => {
      contentRef.current = node;
      assignRef(ref, node);
    },
    [ref]
  );

  const updateHandleBackground = React.useCallback(() => {
    const contentNode = contentRef.current;
    if (!contentNode) {
      return;
    }

    const sourceNode = hasExplicitBackgroundClass
      ? contentNode
      : (findFirstOpaqueBackgroundNode(contentNode) ?? contentNode);
    const sourceBackground = parseRgbaColor(
      window.getComputedStyle(sourceNode).backgroundColor
    );

    if (!sourceBackground || sourceBackground.alpha <= 0.01) {
      contentNode.style.removeProperty('--drawer-handle-bg');

      return;
    }

    contentNode.style.setProperty(
      '--drawer-handle-bg',
      `rgb(${sourceBackground.red} ${sourceBackground.green} ${sourceBackground.blue})`
    );
  }, [hasExplicitBackgroundClass]);

  React.useEffect(() => {
    if (!isBottomDrawer || !showDragHandle) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateHandleBackground();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isBottomDrawer, showDragHandle, updateHandleBackground]);

  // Bottom sheets size to their content. Filtering a search list (or any other
  // shrink) would collapse the sheet mid-interaction. Lock the open height as a
  // floor so the sheet can grow but never get shorter while it stays mounted.
  React.useEffect(() => {
    if (!isBottomDrawer) {
      return;
    }

    const contentNode = contentRef.current;
    if (!contentNode) {
      return;
    }

    let lockedMinHeightPx = 0;

    const lockOpenHeightFloor = () => {
      const nextHeightPx = Math.ceil(
        contentNode.getBoundingClientRect().height
      );
      if (nextHeightPx <= 0 || nextHeightPx <= lockedMinHeightPx) {
        return;
      }

      lockedMinHeightPx = nextHeightPx;
      contentNode.style.minHeight = `${lockedMinHeightPx}px`;
    };

    const frameId = window.requestAnimationFrame(() => {
      lockOpenHeightFloor();
    });
    const resizeObserver = new ResizeObserver(() => {
      lockOpenHeightFloor();
    });
    resizeObserver.observe(contentNode);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      contentNode.style.minHeight = '';
    };
  }, [isBottomDrawer]);

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

  const handleOverlayPointerEvent = React.useCallback(
    (
      eventType: DrawerPointerEventType,
      event: React.PointerEvent<HTMLDivElement>
    ) => {
      const contentNode = contentRef.current;

      if (!contentNode || disableSwipe || !event.isPrimary) {
        return;
      }

      if (eventType === 'pointerdown') {
        if (event.button !== 0 || event.currentTarget !== event.target) {
          return;
        }

        outsideDragStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY
        };
        shouldSuppressOverlayClickRef.current = false;
      } else if (outsideDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      if (eventType === 'pointermove' && outsideDragStateRef.current) {
        const deltaX = Math.abs(
          event.clientX - outsideDragStateRef.current.startX
        );
        const deltaY = Math.abs(
          event.clientY - outsideDragStateRef.current.startY
        );
        const moveThreshold = getOutsideDragMoveThreshold(event.pointerType);

        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          shouldSuppressOverlayClickRef.current = true;
        }
      }

      dispatchDrawerPointerEvent(eventType, event, contentNode);

      if (
        eventType === 'pointerdown' &&
        contentNode.hasPointerCapture(event.pointerId)
      ) {
        // Vaul's onPress captures the pointer to the content, which would
        // retarget the rest of this real gesture (moves, pointerup and the
        // final click) away from the overlay. That silently breaks
        // click-outside-to-close: the click never reaches the overlay's
        // DrawerPrimitive.Close wrapper, and the overlay's own
        // forwarding/suppression handlers above stop firing. Release the
        // capture so the real events keep flowing through the overlay — we
        // forward everything Vaul needs ourselves.
        contentNode.releasePointerCapture(event.pointerId);
      }

      if (eventType === 'pointerup') {
        outsideDragStateRef.current = null;
      }
    },
    [disableSwipe]
  );

  const handleOverlayPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (outsideDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      handleOverlayPointerEvent('pointerup', event);
      outsideDragStateRef.current = null;
    },
    [handleOverlayPointerEvent]
  );

  const handleOverlayClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!shouldSuppressOverlayClickRef.current) {
        return;
      }

      event.preventDefault();
      shouldSuppressOverlayClickRef.current = false;
    },
    []
  );

  const handlePointerDownOutside = React.useCallback(
    (event: DrawerPointerDownOutsideEvent) => {
      userOnPointerDownOutside?.(event);

      if (event.defaultPrevented || disableSwipe) {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLElement &&
        target.closest('[data-slot="drawer-overlay"]')
      ) {
        event.preventDefault();
      }
    },
    [disableSwipe, userOnPointerDownOutside]
  );

  return (
    <DrawerPortal>
      <DrawerPrimitive.Close asChild>
        <DrawerOverlay
          className={overlayClassName}
          {...vaulAnimateProps}
          onClick={handleOverlayClick}
          onPointerDown={(event) =>
            handleOverlayPointerEvent('pointerdown', event)
          }
          onPointerMove={(event) =>
            handleOverlayPointerEvent('pointermove', event)
          }
          onPointerUp={(event) => handleOverlayPointerEvent('pointerup', event)}
          onPointerCancel={handleOverlayPointerCancel}
        />
      </DrawerPrimitive.Close>
      {isBottomDrawer && (
        // Fills the gap that appears below the sheet when it is dragged up past
        // its open position (Vaul's damped rubber-band overscroll). It lives
        // outside the content's `overflow-hidden`, so — unlike Vaul's built-in
        // `::after` — it is never clipped. Anchored to the screen bottom and
        // sitting behind the sheet, it only shows in the gap the lift exposes.
        // `bg-background` matches every bottom sheet's surface (and tracks the
        // theme). Height is taller than the (logarithmically damped) max
        // overscroll yet shorter than the smallest sheet, so it never peeks
        // above a short one.
        <div
          aria-hidden
          data-slot="drawer-bottom-fill"
          className="bg-background pointer-events-none fixed inset-x-0 bottom-0 z-50 h-14"
        />
      )}
      <DrawerPrimitive.Content
        ref={setContentRef}
        data-slot="drawer-content"
        {...vaulAnimateProps}
        data-vaul-no-drag={disableSwipe ? '' : undefined}
        className={cn(
          drawerVariants({ side: side as DrawerSide, fitContent }),
          className
        )}
        {...primitiveContentProps}
        onCloseAutoFocus={handleCloseAutoFocus}
        onOpenAutoFocus={handleOpenAutoFocus}
        onPointerDownOutside={handlePointerDownOutside}
      >
        <div
          ref={setFloatingLayerContainer}
          data-slot="drawer-floating-layer"
          className={cn(
            'pointer-events-none absolute inset-0 z-60',
            floatingLayerClassName
          )}
        />
        <InDrawerContext.Provider value={true}>
          <FloatingLayerProvider container={floatingLayerContainer}>
            {showDragHandle && isBottomDrawer && <DrawerHandle />}
            {accessibilityTitle != null ? (
              <DrawerTitle className="sr-only">
                {accessibilityTitle}
              </DrawerTitle>
            ) : null}
            {accessibilityDescription != null || accessibilityTitle != null ? (
              <DrawerDescription className="sr-only">
                {accessibilityDescription ?? accessibilityTitle}
              </DrawerDescription>
            ) : null}
            {children}
          </FloatingLayerProvider>
        </InDrawerContext.Provider>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

export function DrawerHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...headerProps } = props;

  return (
    <div
      data-slot="drawer-header"
      className={cn(
        'bg-background sticky top-0 z-20 shrink-0 flex flex-col gap-2 text-center',
        className
      )}
      {...headerProps}
    />
  );
}

export function DrawerFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...footerProps } = props;

  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        'bg-background sticky bottom-0 z-20 shrink-0 flex flex-col-reverse gap-2 border-t border-border-default px-6 py-5 justify-center sm:flex-row sm:justify-center',
        className
      )}
      {...footerProps}
    />
  );
}

export function DrawerTitle(
  props: React.ComponentProps<typeof DrawerPrimitive.Title>
) {
  const { className, ...titleProps } = props;

  return (
    <DrawerPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...titleProps}
    />
  );
}

export function DrawerDescription(
  props: React.ComponentProps<typeof DrawerPrimitive.Description>
) {
  const { className, ...descriptionProps } = props;

  return (
    <DrawerPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...descriptionProps}
    />
  );
}

export {
  Drawer,
  DrawerContent,
  DrawerTrigger
};
