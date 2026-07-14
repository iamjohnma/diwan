'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { TruncateText } from '@/components/common/truncate-text';
import {
  DIALOG_STEP_TITLE_CLASS_NAME,
  DialogStepBackButton,
  DialogStepCloseButton,
  DialogStepHeaderRow,
  dialogStepFooterMobileSubmitClassName
} from '@/components/dialogts/common/dialog-chrome';
import { useStepsDialog } from '@/components/dialogts/common/steps-dialog/context';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle
} from '@/components/ui/drawer';
import { FloatingLayerProvider } from '@/components/ui/floating-layer';
import { useDirection } from '@/hooks/common/direction';
import { focusAutoFocusTarget } from '@/utils/common/can-auto-focus';
import { cn } from '@/utils/common/cn';
import { getFirstOpenOverlayTextField } from '@/utils/common/open-overlay-autofocus';

// Portaled floating overlays (e.g. the variable-textarea "@" dropdown) render
// into this view's floating-layer container — a DOM sibling of the dialog
// content, so Radix treats clicks inside them as "outside". Without this guard,
// picking a variable from the dropdown would dismiss the entire nested view.
const FLOATING_OVERLAY_SELECTOR =
  '[data-dms-floating-overlay], [data-variable-dropdown], [data-slot="select-content"], [data-slot="popover-content"]';

function isFloatingOverlayTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(FLOATING_OVERLAY_SELECTOR) !== null
  );
}

interface StepsDialogNestedViewProps extends Omit<
  HTMLMotionProps<'div'>,
  'children' | 'ref' | 'title'
> {
  id: string;
  title: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  fitContent?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function StepsDialogNestedView(props: StepsDialogNestedViewProps) {
  const {
    id,
    title,
    headerAction,
    footer,
    bodyClassName,
    fitContent = false,
    onBack,
    children,
    className,
    ...viewProps
  } = props;
  const stepsDialog = useStepsDialog();
  const direction = useDirection();
  const isActive = stepsDialog.activeNestedViewId === id;
  const portalContainer = stepsDialog.nestedLayerContainer;
  const contentRef = React.useRef<HTMLDivElement>(null);
  const backButtonRef = React.useRef<HTMLButtonElement>(null);
  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack();

      return;
    }

    stepsDialog.closeNestedView();
  }, [onBack, stepsDialog]);
  // Floating layer scoped to this nested level, so selects/popovers opened
  // inside the nested view render above its card rather than behind it (the
  // parent step's floating layer sits below this nested layer).
  const [floatingLayerContainer, setFloatingLayerContainer] =
    React.useState<HTMLDivElement | null>(null);

  // Keep the nested view open when interacting with a portaled floating overlay
  // it owns (the "@" variable dropdown lives in its floating-layer container,
  // which Radix sees as outside the content). Other outside clicks still close.
  const guardFloatingOverlayInteraction = React.useCallback(
    (event: { target: EventTarget | null; preventDefault: () => void }) => {
      if (
        isFloatingOverlayTarget(event.target) ||
        floatingLayerContainer?.querySelector(FLOATING_OVERLAY_SELECTOR) != null
      ) {
        event.preventDefault();
      }
    },
    [floatingLayerContainer]
  );

  React.useEffect(() => {
    if (!isActive) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const content = contentRef.current;
      const textField = content ? getFirstOpenOverlayTextField(content) : null;
      if (focusAutoFocusTarget(textField, { preventScroll: true })) {
        return;
      }

      backButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isActive]);

  if (stepsDialog.presentation === 'drawer') {
    return (
      <Drawer
        open={isActive}
        onOpenChange={(open) => {
          if (!open) {
            stepsDialog.closeNestedView();
          }
        }}
      >
        <DrawerContent
          ref={contentRef}
          data-slot="steps-dialog-nested-view"
          side="bottom"
          fitContent
          dir={direction}
          className={cn('max-h-[95svh] gap-0 overflow-x-hidden p-0', className)}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={guardFloatingOverlayInteraction}
          onPointerDownOutside={guardFloatingOverlayInteraction}
        >
          <DialogStepHeaderRow>
            <DialogStepBackButton
              buttonRef={backButtonRef}
              showIcon={false}
              onClick={handleBack}
            />
            <DrawerTitle className={DIALOG_STEP_TITLE_CLASS_NAME}>
              <TruncateText>{title}</TruncateText>
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              <TruncateText>{title}</TruncateText>
            </DrawerDescription>
            {headerAction}
          </DialogStepHeaderRow>
          <div
            data-slot="steps-dialog-nested-view-body"
            className={cn(
              'hide-scrollbar min-h-0 overflow-x-hidden overflow-y-auto bg-background',
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer ? (
            <div
              data-slot="dialog-step-footer"
              className={cn(
                'shrink-0 bg-background',
                dialogStepFooterMobileSubmitClassName
              )}
            >
              {footer}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <DialogPrimitive.Root
      open={isActive}
      onOpenChange={(open) => {
        if (!open) {
          stepsDialog.closeNestedView();
        }
      }}
    >
      <AnimatePresence initial={false}>
        {isActive ? (
          <>
            {/*
              Own scrim for the nested level. It is portaled into the nested
              layer host (above the parent's overlay), so an outside click lands
              here rather than on the parent's overlay. Crucially this element is
              a React-tree descendant of the parent dialog's content (the whole
              nested view renders inside the parent's children, then portals out)
              but NOT of the nested content. So Radix's DismissableLayer marks the
              click "inside" for the PARENT (its onPointerDownCapture fires in the
              capture phase → the parent never dismisses) while still "outside" for
              the NESTED layer (which dismisses itself). That React-tree check is
              immune to the listener-ordering / flushSync race that made the old
              state-only guard close BOTH levels on a single outside click — now
              one click pops exactly one level. closeNestedView is an explicit,
              redundant safety net alongside the nested layer's own dismissal.

              The scrim must be a real DialogPrimitive.Overlay: Radix mounts its
              react-remove-scroll lock around the Overlay with the nested content
              as an allowed shard. Without it this dialog has no lock of its own,
              and the PARENT dialog's lock — whose only allowed regions are the
              parent overlay and the parent content — preventDefault()s every
              wheel/touch scroll over the nested view (portaled outside both), so
              nested bodies showed a scrollbar but wouldn't wheel-scroll. Mounted
              after the parent's lock, this one takes over the shared lock stack
              and the parent's blocker goes inert.
            */}
            <DialogPrimitive.Overlay asChild forceMount>
              <div
                data-slot="steps-dialog-nested-view-scrim"
                className="pointer-events-auto absolute inset-0"
                onClick={stepsDialog.closeNestedView}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              forceMount
              asChild
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              onInteractOutside={guardFloatingOverlayInteraction}
              onPointerDownOutside={guardFloatingOverlayInteraction}
            >
              <motion.div
                ref={contentRef}
                data-slot="steps-dialog-nested-view"
                dir={direction}
                className={cn(
                  'pointer-events-auto absolute grid overflow-hidden border bg-background shadow-2xl outline-none',
                  fitContent
                    ? 'grid-rows-[auto_auto_auto]'
                    : 'min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]',
                  stepsDialog.presentation === 'dialog'
                    ? fitContent
                      ? 'left-1/2 top-1/2 h-auto max-h-[var(--steps-dialog-stack-height)] w-[var(--steps-dialog-stack-width)] max-w-[calc(100%_-_2rem)] rounded-2xl md:rounded-3xl'
                      : 'left-1/2 top-1/2 h-[var(--steps-dialog-stack-height)] max-h-[calc(100%_-_2rem)] w-[var(--steps-dialog-stack-width)] max-w-[calc(100%_-_2rem)] rounded-2xl md:rounded-3xl'
                    : fitContent
                      ? 'inset-x-3 bottom-3 h-auto max-h-[var(--steps-dialog-stack-height)] rounded-2xl'
                      : 'inset-x-3 bottom-3 h-[var(--steps-dialog-stack-height)] max-h-[calc(100%_-_1.5rem)] rounded-2xl',
                  className
                )}
                initial={
                  stepsDialog.presentation === 'dialog'
                    ? { opacity: 0, x: '-50%', y: 'calc(-50% + 10px)' }
                    : { opacity: 0, y: 10 }
                }
                animate={
                  stepsDialog.presentation === 'dialog'
                    ? { opacity: 1, x: '-50%', y: '-50%' }
                    : { opacity: 1, y: 0 }
                }
                exit={
                  stepsDialog.presentation === 'dialog'
                    ? { opacity: 0, x: '-50%', y: 'calc(-50% + 10px)' }
                    : { opacity: 0, y: 10 }
                }
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                {...viewProps}
              >
                <FloatingLayerProvider container={floatingLayerContainer}>
                  <DialogStepHeaderRow>
                    <DialogStepBackButton
                      buttonRef={backButtonRef}
                      showIcon={false}
                      onClick={handleBack}
                    />
                    <DialogPrimitive.Title
                      className={DIALOG_STEP_TITLE_CLASS_NAME}
                    >
                      <TruncateText>{title}</TruncateText>
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      <TruncateText>{title}</TruncateText>
                    </DialogPrimitive.Description>
                    {headerAction}
                    {stepsDialog.presentation === 'dialog' && (
                      <DialogStepCloseButton onClick={stepsDialog.onClose} />
                    )}
                  </DialogStepHeaderRow>
                  <div
                    data-slot="steps-dialog-nested-view-body"
                    data-vaul-no-drag=""
                    className={cn(
                      'hide-scrollbar min-h-0 overflow-x-hidden overflow-y-auto bg-background',
                      bodyClassName
                    )}
                  >
                    {children}
                  </div>
                  {footer ? (
                    <div
                      data-slot="dialog-step-footer"
                      className={cn(
                        'shrink-0 bg-background',
                        dialogStepFooterMobileSubmitClassName
                      )}
                    >
                      {footer}
                    </div>
                  ) : null}
                </FloatingLayerProvider>
              </motion.div>
            </DialogPrimitive.Content>
            <div
              ref={setFloatingLayerContainer}
              data-slot="steps-dialog-nested-view-floating-layer"
              className="pointer-events-none absolute inset-0"
            />
          </>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>,
    portalContainer
  );
}
