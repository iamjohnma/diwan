import * as React from 'react';
import { XIcon } from '@phosphor-icons/react';
import { Presence } from '@radix-ui/react-presence';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type {
  DialogContextValue,
  DialogInteractOutsideEvent,
  DialogPointerDownOutsideEvent
} from '@/@types/common/dialogts/ui/dialog';
import { DialogLoadingOverlay } from '@/components/dialogts/common/dialog-chrome';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { FloatingLayerProvider } from '@/components/ui/floating-layer';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useDialogSubmit } from '@/hooks/common/dialog-submit';
import { useDialogToastLayerRegistration } from '@/hooks/common/dialog-toast-layer-registration';
import { useDirection } from '@/hooks/common/direction';
import { useDocumentScrollLock } from '@/hooks/common/document-scroll-lock';
import { focusAutoFocusTarget } from '@/utils/common/can-auto-focus';
import { cn } from '@/utils/common/cn';
import { useTranslation } from 'react-i18next';
import {
  OPEN_OVERLAY_FIRST_INPUT_SELECTOR,
  getFirstOpenOverlayTextField,
  handleOpenOverlayAutoFocus
} from '@/utils/common/open-overlay-autofocus';
import { scheduleSelectEndAfterControlledUpdate } from '@/utils/common/select-end-of-input-value';

const PORTALED_POPOVER_SELECTOR = [
  '[data-dms-floating-overlay]',
  '[data-variable-dropdown]',
  '[data-slot="select-content"]',
  '[data-radix-select-content]',
  '[data-slot="select-content-mobile"]',
  '[data-slot="popover-content"]'
].join(', ');

const DialogContext = React.createContext<DialogContextValue | null>(null);

function isPortaledPopoverTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(PORTALED_POPOVER_SELECTOR) !== null
  );
}

function hasOpenPortaledPopover(container?: ParentNode | null) {
  const root = container ?? document;

  return (
    root.querySelector(
      '[data-dms-floating-overlay], [data-slot="menu-positioner"]'
    ) !== null
  );
}

function Dialog(
  props: React.ComponentProps<typeof DialogPrimitive.Root> & {
    disableAnimations?: boolean;
    onEnterSubmit?: () => void;
    isEnterDisabled?: () => boolean;
  }
) {
  const {
    open: openProp,
    defaultOpen,
    onOpenChange,
    disableAnimations = false,
    onEnterSubmit,
    isEnterDisabled,
    ...rootProps
  } = props;
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false
  );
  const reactId = React.useId();
  const dialogIdRef = React.useRef(`dialog-${reactId}`);
  const breakpoint = useBreakpoint();

  const open = isControlled ? openProp : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpenParam: boolean | { open?: boolean }) => {
      const nextOpen =
        typeof nextOpenParam === 'boolean'
          ? nextOpenParam
          : (nextOpenParam?.open ?? Boolean(nextOpenParam));
      if (nextOpen && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const closeDialog = React.useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  useDialogToastLayerRegistration(open, dialogIdRef.current, closeDialog);

  const contextValue = React.useMemo<DialogContextValue>(
    () => ({
      dialogId: dialogIdRef.current,
      open,
      isMobile: breakpoint.isMobile,
      disableAnimations,
      onClose: closeDialog,
      onEnterSubmit,
      isEnterDisabled
    }),
    [
      open,
      breakpoint.isMobile,
      disableAnimations,
      closeDialog,
      onEnterSubmit,
      isEnterDisabled
    ]
  );

  return (
    <DialogContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        data-slot="dialog"
        open={open}
        onOpenChange={handleOpenChange}
        {...rootProps}
      />
    </DialogContext.Provider>
  );
}

function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>
) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

const DialogOverlay = React.memo(function DialogOverlay(
  props: React.ComponentProps<'div'>
) {
  const { className, ...overlayProps } = props;
  const dialog = React.useContext(DialogContext);
  const open = dialog?.open ?? false;
  const disableAnimations = dialog?.disableAnimations ?? false;

  return (
    <Presence present={open}>
      <div
        data-slot="dialog-overlay"
        data-state={open ? 'open' : 'closed'}
        className={cn(
          // `pointer-events-auto` is required: Radix's modal Content sets
          // `body { pointer-events: none }`, which a plain-div overlay inherits.
          // Without this the backdrop is click-through and elements behind it
          // that opt back in (e.g. scroll-hint buttons) intercept the click.
          // No z-index: the overlay stacks inside its dialog's `dialog-layer`
          // context (below this dialog's own content, above the page).
          'pointer-events-auto fixed inset-0 bg-black/40',
          'backdrop-blur-[2px]',
          !disableAnimations &&
            'data-[state=open]:animate-[dialog-overlay-enter_120ms_cubic-bezier(0.16,1,0.3,1)_both]',
          !disableAnimations &&
            'data-[state=closed]:animate-[dialog-overlay-exit_100ms_cubic-bezier(0.4,0,1,1)_both]',
          className
        )}
        {...overlayProps}
      />
    </Presence>
  );
});

function useFrozenChildren(children: React.ReactNode, open: boolean) {
  const frozenRef = React.useRef<React.ReactNode>(children);

  if (open) {
    frozenRef.current = children;
  }

  return open ? children : frozenRef.current;
}

const DesktopDialogCloseButton = React.memo(
  function DesktopDialogCloseButton() {
    const { t } = useTranslation();

    return (
      <DialogPrimitive.Close
        type="button"
        data-slot="dialog-close"
        className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 end-4 z-30 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <XIcon className="size-5" />
        <span className="sr-only">{t('common.dialog.close')}</span>
      </DialogPrimitive.Close>
    );
  }
);

function DialogContent(
  props: React.ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    showDragHandle?: boolean;
    isLoading?: boolean;
    allowContentOverflow?: boolean;
  }
) {
  const {
    className,
    children,
    showCloseButton = true,
    showDragHandle,
    isLoading = false,
    allowContentOverflow = true,
    style,
    onOpenAutoFocus,
    onCloseAutoFocus,
    onInteractOutside,
    onPointerDownOutside,
    ...contentProps
  } = props;
  const dialog = React.useContext(DialogContext);
  const dialogId = dialog?.dialogId ?? '';
  const open = dialog?.open ?? false;
  const disableAnimations = dialog?.disableAnimations ?? false;
  const onClose = dialog?.onClose ?? (() => {});
  const breakpoint = useBreakpoint();
  const direction = useDirection();
  const frozenChildren = useFrozenChildren(children, open);
  useDocumentScrollLock(open && !breakpoint.isMobile);

  const contentDomRef = React.useRef<HTMLDivElement | null>(null);
  const [floatingLayerContainer, setFloatingLayerContainer] =
    React.useState<HTMLDivElement | null>(null);

  useDialogSubmit({
    open,
    onSubmit: dialog?.onEnterSubmit,
    isDisabled: dialog?.isEnterDisabled
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const frameIds: number[] = [];

    const runAutoFocus = () => {
      if (cancelled) {
        return;
      }
      const content = contentDomRef.current;
      if (!content || !content.isConnected) {
        return;
      }
      const activeElement = content.ownerDocument.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement !== content &&
        content.contains(activeElement) &&
        activeElement.matches(OPEN_OVERLAY_FIRST_INPUT_SELECTOR)
      ) {
        return;
      }
      const firstInput = getFirstOpenOverlayTextField(content);
      if (!firstInput) {
        return;
      }
      if (focusAutoFocusTarget(firstInput, { preventScroll: true })) {
        scheduleSelectEndAfterControlledUpdate(firstInput);
      }
    };

    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(runAutoFocus);
      frameIds.push(secondFrame);
    });
    frameIds.push(firstFrame);

    return () => {
      cancelled = true;
      frameIds.forEach((id) => cancelAnimationFrame(id));
    };
  }, [open]);

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      handleOpenOverlayAutoFocus(event, onOpenAutoFocus);
    },
    [onOpenAutoFocus]
  );

  const blockOutsidePopoverInteraction = React.useCallback(
    (event: DialogInteractOutsideEvent | DialogPointerDownOutsideEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (
        isPortaledPopoverTarget(event.target) ||
        hasOpenPortaledPopover(floatingLayerContainer)
      ) {
        event.preventDefault();
      }
    },
    [floatingLayerContainer]
  );

  const handleInteractOutside = React.useCallback(
    (event: DialogInteractOutsideEvent) => {
      onInteractOutside?.(event);
      blockOutsidePopoverInteraction(event);
    },
    [blockOutsidePopoverInteraction, onInteractOutside]
  );

  const handlePointerDownOutside = React.useCallback(
    (event: DialogPointerDownOutsideEvent) => {
      onPointerDownOutside?.(event);
      blockOutsidePopoverInteraction(event);
    },
    [blockOutsidePopoverInteraction, onPointerDownOutside]
  );

  const handleCloseAutoFocus = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      onCloseAutoFocus?.(event);
    },
    [onCloseAutoFocus]
  );

  // DialogContent is only valid under <Dialog>. Without context, skip render
  // instead of mounting children that call useDialog().
  if (!dialog) {
    return null;
  }

  if (breakpoint.isMobile) {
    const { ref: _drawerRef, ...drawerContentProps } = contentProps;

    return (
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose();
          }
        }}
      >
        <DrawerContent
          key={`${dialogId}-drawer-content`}
          ref={contentDomRef}
          data-slot="dialog-content"
          data-dms-dialog-open="true"
          side="bottom"
          className={cn(
            'max-h-[95svh] gap-3.5 overflow-x-hidden p-0',
            className
          )}
          showDragHandle={showDragHandle}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          onInteractOutside={handleInteractOutside}
          onPointerDownOutside={handlePointerDownOutside}
          {...drawerContentProps}
        >
          {frozenChildren}
          <DialogLoadingOverlay
            isLoading={isLoading}
            disableAnimations={disableAnimations}
            className="z-10 rounded-t-2xl"
          />
        </DrawerContent>
      </Drawer>
    );
  }

  const desktopContentPositionClassName =
    'pointer-events-auto fixed z-10 min-h-0 w-full outline-none top-[50%] left-[50%] max-h-[85svh] translate-x-[-50%] translate-y-[-50%]';
  const desktopContentAnimationClassName = cn(
    !disableAnimations &&
      'data-[state=open]:animate-[dialog-content-enter_150ms_cubic-bezier(0.16,1,0.3,1)_both]',
    !disableAnimations &&
      'data-[state=closed]:animate-[dialog-content-exit_120ms_cubic-bezier(0.4,0,1,1)_both]'
  );
  const desktopContentSurfaceClassName =
    'bg-background flex min-h-0 w-full flex-col gap-6 overflow-x-hidden overflow-hidden border shadow-lg rounded-3xl';
  const desktopContentChildren = (
    <>
      {frozenChildren}
      {showCloseButton && <DesktopDialogCloseButton />}
      <DialogLoadingOverlay
        isLoading={isLoading}
        disableAnimations={disableAnimations}
        className="z-10 rounded-3xl"
      />
    </>
  );

  return (
    <DialogPortal>
      {/*
        Isolate this dialog's overlay + content in a single z-50 stacking
        context. They were previously `fixed z-50` siblings portaled straight
        to <body>, so their paint order fell back to DOM order — and React
        does not coordinate DOM order across *separate* dialog portals. Opening
        a second dialog mid-transition could therefore drop a foreign overlay
        on top of this dialog's content: the "dialog behind the backdrop" race.
        Scoping both to this layer makes it impossible for a sibling dialog's
        overlay to interleave between our overlay and our content.
      */}
      <div
        data-slot="dialog-layer"
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'pointer-events-none fixed inset-0 z-50 isolate',
          // Radix's DialogPortal wraps each direct child in its own <Presence>,
          // which reads THIS element's computed `animation-name` to decide
          // whether to defer unmount on close. With no animation here the layer
          // (and the overlay + content nested inside it) would unmount the
          // instant `open` flips false, cutting off their exit animations. This
          // transparent hold keeps the layer mounted until the nested overlay
          // (100ms) and content (120ms) exits finish — keep it >= the longest.
          !disableAnimations &&
            'data-[state=closed]:animate-[dialog-layer-exit_130ms_linear_both]'
        )}
      >
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={contentDomRef}
          data-slot="dialog-content"
          data-dialog-id={dialogId || undefined}
          data-dms-dialog-open={open ? 'true' : undefined}
          dir={direction}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          onInteractOutside={handleInteractOutside}
          onPointerDownOutside={handlePointerDownOutside}
          className={cn(
            !allowContentOverflow && desktopContentSurfaceClassName,
            desktopContentPositionClassName,
            desktopContentAnimationClassName,
            className,
            allowContentOverflow && 'overflow-visible'
          )}
          style={style}
          {...contentProps}
        >
          <div
            ref={setFloatingLayerContainer}
            data-slot="dialog-floating-layer"
            className="pointer-events-none fixed inset-0 z-60"
          />
          <FloatingLayerProvider container={floatingLayerContainer}>
            {allowContentOverflow ? (
              <div
                data-slot="dialog-content-shell"
                className={cn(
                  desktopContentSurfaceClassName,
                  'relative max-h-[85svh]',
                  className
                )}
              >
                {desktopContentChildren}
              </div>
            ) : (
              desktopContentChildren
            )}
          </FloatingLayerProvider>
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
}

function DialogHeader(props: React.ComponentProps<'div'>) {
  const { className, ...headerProps } = props;

  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'bg-background z-20 shrink-0 sticky top-0 flex flex-col gap-2 text-center',
        className
      )}
      {...headerProps}
    />
  );
}

function DialogFooter(props: React.ComponentProps<'div'>) {
  const { className, ...footerProps } = props;

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'bg-background z-20 shrink-0 sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border-default px-6 py-5 justify-center sm:flex-row sm:justify-center',
        // Larger tap target for submit actions on mobile bottom sheets only.
        '[&_[data-slot=button]]:max-md:!h-12 [&_[data-slot=button]]:max-md:!min-h-12',
        className
      )}
      {...footerProps}
    />
  );
}

function DialogBody(props: React.ComponentProps<'div'>) {
  const { className, ...bodyProps } = props;

  return (
    <div
      data-slot="dialog-body"
      className={cn('min-w-0 flex-1 min-h-0 overflow-y-auto', className)}
      {...bodyProps}
    />
  );
}

function DialogTitle(
  props: React.ComponentProps<typeof DialogPrimitive.Title>
) {
  const { className, ...titleProps } = props;

  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'min-w-0 truncate text-lg leading-normal font-medium',
        className
      )}
      {...titleProps}
    />
  );
}

function DialogDescription(
  props: React.ComponentProps<typeof DialogPrimitive.Description>
) {
  const { className, ...descriptionProps } = props;

  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...descriptionProps}
    />
  );
}

function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a Dialog');
  }

  return context;
}

function DialogCancelButton(
  props: React.ComponentProps<'button'> & {
    variant?: 'outline' | 'ghost';
    layout?: 'default' | 'dialogAction' | 'grow';
  }
) {
  const context = React.useContext(DialogContext);
  const isMobile = context?.isMobile ?? false;

  if (isMobile) {
    return null;
  }

  const {
    variant = 'outline',
    layout = 'default',
    className,
    ...buttonProps
  } = props;

  const { ref: _ref, ...buttonPropsWithoutRef } = buttonProps;

  return (
    <DialogPrimitive.Close
      data-slot="dialog-cancel-button"
      className={cn(
        'flex full-center gap-x-2 group rounded-lg outline-none focus-visible:ring-0.4 cursor-pointer transition-all border duration-100 py-2 px-4 text-sm h-10',
        (layout === 'dialogAction' || layout === 'grow') && 'min-w-18 flex-1',
        variant === 'outline' &&
          'bg-background-base border-border-default active:bg-background-elevated hover:bg-background-surface',
        variant === 'ghost' &&
          'border-transparent hover:text-secondary-foreground hover:bg-secondary active:bg-secondary-active focus-visible:bg-secondary',
        className
      )}
      {...buttonPropsWithoutRef}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialog
};
