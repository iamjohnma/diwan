'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { StepsDialogContext } from '@/components/dialogts/common/steps-dialog/context';
import { StepsDialogOverlay } from '@/components/dialogts/common/steps-dialog/steps-dialog-overlay';
import { StepsDialogPortal } from '@/components/dialogts/common/steps-dialog/steps-dialog-portal';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { FloatingLayerProvider } from '@/components/ui/floating-layer';
import { useDirection } from '@/hooks/common/direction';
import { useDocumentScrollLock } from '@/hooks/common/document-scroll-lock';
import { cn } from '@/utils/common/cn';
import { handleOpenOverlayAutoFocus } from '@/utils/common/open-overlay-autofocus';

interface StepsDialogContentProps extends React.ComponentProps<
  typeof DialogPrimitive.Content
> {
  showCloseButton?: boolean;
  maxWidth?: string;
  children: React.ReactNode;
}

function useFrozenChildren(children: React.ReactNode, open: boolean) {
  const frozenRef = React.useRef<React.ReactNode>(children);

  if (open) {
    frozenRef.current = children;
  }

  return open ? children : frozenRef.current;
}

interface StepsDialogParentSize {
  width: number;
  height: number;
}

const NESTED_VIEW_EXIT_ANIMATION_DURATION_MS = 300;

export function StepsDialogContent(props: StepsDialogContentProps) {
  const {
    maxWidth: maxWidthProp,
    className,
    style,
    children,
    onOpenAutoFocus,
    onEscapeKeyDown
  } = props;
  const maxWidth = maxWidthProp ?? 'md:max-w-[500px]';

  const context = React.useContext(StepsDialogContext);
  const dialogId = context?.dialogId ?? '';
  const open = context?.open ?? false;
  const visualOpen = context?.visualOpen ?? false;
  const onClose = context?.onClose ?? (() => {});
  const disableAnimations = context?.disableAnimations ?? false;
  const presentation = context?.presentation ?? 'dialog';
  const activeNestedViewId = context?.activeNestedViewId ?? null;
  const closeNestedView = context?.closeNestedView ?? (() => {});
  const isNestedViewOpen = activeNestedViewId !== null;
  const direction = useDirection();
  const dialogSheetRef = React.useRef<HTMLDivElement>(null);
  const parentSizeRef = React.useRef<StepsDialogParentSize | null>(null);
  const [parentSize, setParentSize] =
    React.useState<StepsDialogParentSize | null>(null);
  const previousNestedViewIdRef = React.useRef<string | null>(
    activeNestedViewId
  );
  const [isNestedViewExiting, setIsNestedViewExiting] = React.useState(false);
  const [floatingLayerContainer, setFloatingLayerContainer] =
    React.useState<HTMLDivElement | null>(null);
  const frozenChildren = useFrozenChildren(children, open);
  const setNestedLayerContainer =
    context?.setNestedLayerContainer ?? (() => {});
  useDocumentScrollLock(visualOpen && presentation === 'dialog');

  // Derive the "exiting" flag synchronously during render. If we instead set it
  // from an effect, there is one committed frame where the nested view has
  // already closed (`isNestedViewOpen === false`) but the exit flag has not yet
  // flipped to true — so `isNestedLayerActive` momentarily drops to false. That
  // gap unfreezes the parent-size measurement below, which then re-measures the
  // parent mid shrink-transition and captures its smaller width, snapping the
  // still-animating nested view to the parent's width.
  if (previousNestedViewIdRef.current !== activeNestedViewId) {
    setIsNestedViewExiting(
      activeNestedViewId === null && previousNestedViewIdRef.current !== null
    );
    previousNestedViewIdRef.current = activeNestedViewId;
  }

  const isNestedLayerActive = isNestedViewOpen || isNestedViewExiting;

  React.useEffect(() => {
    if (!isNestedViewExiting) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsNestedViewExiting(false);
    }, NESTED_VIEW_EXIT_ANIMATION_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isNestedViewExiting]);

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      if (presentation === 'drawer') {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();

        return;
      }
      handleOpenOverlayAutoFocus(event, onOpenAutoFocus);
    },
    [onOpenAutoFocus, presentation]
  );

  React.useLayoutEffect(() => {
    const element = dialogSheetRef.current;
    if (!visualOpen || !element) {
      parentSizeRef.current = null;
      setParentSize(null);

      return;
    }

    const frameIds: number[] = [];

    const updateParentSize = () => {
      if (isNestedLayerActive && parentSizeRef.current !== null) {
        return;
      }

      // Prefer the visible card surface over the outer positioning wrapper so
      // nested views match the bordered sheet the user actually sees.
      const measureTarget =
        element.querySelector<HTMLElement>(
          '[data-slot="steps-dialog-content-shell"]'
        ) ?? element;

      const nextSize = {
        width: Math.round(measureTarget.offsetWidth),
        height: Math.round(measureTarget.offsetHeight)
      };

      if (nextSize.width <= 0 || nextSize.height <= 0) {
        return;
      }

      parentSizeRef.current = nextSize;
      setParentSize((previous) =>
        previous?.width === nextSize.width &&
        previous?.height === nextSize.height
          ? previous
          : nextSize
      );
    };

    updateParentSize();
    frameIds.push(requestAnimationFrame(updateParentSize));

    const resizeObserver = new ResizeObserver(updateParentSize);
    const measureTarget =
      element.querySelector<HTMLElement>(
        '[data-slot="steps-dialog-content-shell"]'
      ) ?? element;
    resizeObserver.observe(measureTarget);
    window.addEventListener('resize', updateParentSize);

    return () => {
      frameIds.forEach((frameId) => cancelAnimationFrame(frameId));
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateParentSize);
    };
  }, [isNestedLayerActive, visualOpen]);

  const handleEscapeKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      onEscapeKeyDown?.(event);
      if (event.defaultPrevented || !activeNestedViewId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeNestedView();
    },
    [activeNestedViewId, closeNestedView, onEscapeKeyDown]
  );

  // Nested views portal outside this content node, so their interactions can
  // otherwise register as "outside" the parent. Keep the root open while the
  // nested level handles Back, Escape, and overlay clicks.
  const guardOutsideWhileNested = React.useCallback(
    (event: { preventDefault: () => void }) => {
      if (activeNestedViewId) {
        event.preventDefault();
      }
    },
    [activeNestedViewId]
  );
  const handleOverlayClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!activeNestedViewId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeNestedView();
    },
    [activeNestedViewId, closeNestedView]
  );

  // Page-level host that nested views portal into. Mounted on body rather than
  // inside the centered sheet, whose translate-centering would trap a fixed
  // child, so the stacked card can align over the whole dialog.
  const shouldRenderNestedLayerHost =
    typeof document !== 'undefined' && visualOpen;
  const nestedLayerHost = shouldRenderNestedLayerHost
    ? createPortal(
        <div
          ref={setNestedLayerContainer}
          data-slot="steps-dialog-nested-layer"
          dir={direction}
          className="pointer-events-none fixed inset-0 z-[80]"
          style={
            {
              '--steps-dialog-stack-width': parentSize
                ? `${parentSize.width}px`
                : 'min(500px, calc(100% - 2rem))',
              '--steps-dialog-stack-height': parentSize
                ? `${parentSize.height}px`
                : 'min(85svh, 500px)'
            } as React.CSSProperties
          }
        />,
        document.body
      )
    : null;
  // The parent's pushed-back visual (shift up, narrow, fade out) tracks the
  // live `isNestedViewOpen`, NOT `isNestedLayerActive`. On close the latter
  // lingers true for the nested view's full 300ms exit (it freezes the
  // parent-size measurement below); gating the visual on it too would hold the
  // parent shrunk + faded until the nested view fully left, then pop it back —
  // sequential, not parallel. Driving the visual from the live flag lets the
  // parent restore the instant the nested view starts exiting, so both animate
  // together (mirroring the open transition).
  const nestedParentStyle = isNestedViewOpen
    ? ({
        ...style,
        '--steps-dialog-stack-y': '-10px',
        ...(presentation === 'dialog' && parentSize !== null
          ? { maxWidth: `${Math.max(parentSize.width - 10, 0)}px` }
          : {})
      } as React.CSSProperties)
    : ({
        ...style,
        '--steps-dialog-stack-y': '0px'
      } as React.CSSProperties);
  const nestedParentMotionClassName =
    !disableAnimations &&
    'transition-[transform,max-width] duration-[var(--motion-duration-surface)] ease-[var(--motion-ease-out)]';
  const nestedParentContentClassName = cn(
    'flex min-h-0 w-full flex-1 flex-col transition-opacity duration-[var(--motion-duration-small)] ease-[var(--motion-ease-out)]',
    isNestedViewOpen && 'pointer-events-none select-none opacity-0'
  );
  const dialogSheetSurfaceClassName =
    // No shadow on the mobile bottom sheet (flush to the viewport edge);
    // keep elevation only for the centered desktop dialog.
    'flex min-h-0 w-full flex-col overflow-hidden border bg-background p-0 rounded-t-2xl max-h-[95svh] md:max-h-[85svh] md:rounded-3xl md:shadow-lg';

  if (presentation === 'drawer') {
    return (
      <Drawer
        open={visualOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose();
          }
        }}
      >
        <DrawerContent
          ref={dialogSheetRef}
          key={`${dialogId}-drawer-content`}
          data-slot="steps-dialog-content"
          side="bottom"
          fitContent
          data-nested={isNestedLayerActive ? 'true' : undefined}
          className={cn(
            'max-h-[95svh] gap-0 overflow-x-hidden p-0',
            'translate-y-[var(--steps-dialog-stack-y)]',
            nestedParentMotionClassName,
            className
          )}
          dir={direction}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={handleEscapeKeyDown}
          onInteractOutside={guardOutsideWhileNested}
          onPointerDownOutside={guardOutsideWhileNested}
          style={nestedParentStyle}
        >
          <div className={nestedParentContentClassName}>{frozenChildren}</div>
        </DrawerContent>
        {nestedLayerHost}
      </Drawer>
    );
  }

  const dialogSheet = (
    <div
      ref={dialogSheetRef}
      data-slot="steps-dialog-content"
      data-nested={isNestedLayerActive ? 'true' : undefined}
      className={cn(
        'pointer-events-auto fixed flex min-h-0 w-full flex-col overflow-visible outline-none',
        'inset-x-0 top-auto bottom-0 max-h-[95svh] translate-y-[var(--steps-dialog-stack-y)] md:inset-auto md:top-[50%] md:left-[50%] md:max-h-[85svh] md:translate-x-[-50%] md:translate-y-[calc(-50%+var(--steps-dialog-stack-y))]',
        !disableAnimations &&
          'data-[state=open]:animate-[dialog-content-enter_150ms_cubic-bezier(0.16,1,0.3,1)_both]',
        !disableAnimations &&
          'data-[state=closed]:animate-[dialog-content-exit_120ms_cubic-bezier(0.4,0,1,1)_both]',
        maxWidth,
        nestedParentMotionClassName,
        className
      )}
      style={nestedParentStyle}
    >
      <div
        ref={setFloatingLayerContainer}
        data-slot="steps-dialog-floating-layer"
        className="pointer-events-none fixed inset-0 z-60"
      />
      <FloatingLayerProvider container={floatingLayerContainer}>
        <div
          data-slot="steps-dialog-content-shell"
          className={dialogSheetSurfaceClassName}
        >
          <div className={nestedParentContentClassName}>{frozenChildren}</div>
        </div>
      </FloatingLayerProvider>
    </div>
  );

  return (
    <>
      {visualOpen ? (
        <StepsDialogPortal>
          <div
            key={dialogId}
            className="fixed inset-0 z-50 pointer-events-none"
            dir={direction}
          >
            <StepsDialogOverlay onClick={handleOverlayClick} />
            <DialogPrimitive.Content
              forceMount
              asChild
              onOpenAutoFocus={handleOpenAutoFocus}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onEscapeKeyDown={handleEscapeKeyDown}
              onInteractOutside={guardOutsideWhileNested}
              onPointerDownOutside={guardOutsideWhileNested}
            >
              {dialogSheet}
            </DialogPrimitive.Content>
          </div>
        </StepsDialogPortal>
      ) : null}
      {nestedLayerHost}
    </>
  );
}
