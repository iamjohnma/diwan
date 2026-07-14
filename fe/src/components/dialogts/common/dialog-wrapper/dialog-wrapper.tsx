import type { ComponentProps, ReactNode } from 'react';
import * as React from 'react';
import type { Icon } from '@phosphor-icons/react';
import type {
  FieldValues,
  SubmitErrorHandler,
  SubmitHandler,
  UseFormReturn
} from 'react-hook-form';
import {
  type FormSubmitBehavior,
  Form as FormWrapperForm
} from '@/components/common/form-wrapper';
import { TruncateText } from '@/components/common/truncate-text';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogCancelButton as DialogPrimitiveCancelButton,
  DialogFooter as DialogPrimitiveFooter,
  DialogTitle,
  useDialog as usePrimitiveDialog
} from '@/components/dialogts/dialog';
import { Button } from '@/components/ui/button';
import { DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { cn } from '@/utils/common/cn';
import { fireAndForgetDialogAction } from '@/utils/common/dialog-actions';

const DialogWrapperFormIdContext = React.createContext<string | null>(null);
const DialogWrapperSubmitBehaviorContext =
  React.createContext<FormSubmitBehavior>('fire-and-forget');

export function useDialogWrapperFormId(): string {
  const id = React.useContext(DialogWrapperFormIdContext);
  if (id === null) {
    throw new Error('useDialogWrapperFormId must be used within DialogWrapper');
  }

  return id;
}

interface DialogWrapperFormProps<
  TFieldValues extends FieldValues,
  TContext,
  TTransformedValues extends FieldValues
> {
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  children: React.ReactNode;
  onSubmit?: SubmitHandler<TTransformedValues>;
  onInvalidSubmit?: SubmitErrorHandler<TFieldValues>;
  submitBehavior?: FormSubmitBehavior;
  className?: string;
  id?: string;
}

export function DialogWrapperForm<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues = TFieldValues
>(props: DialogWrapperFormProps<TFieldValues, TContext, TTransformedValues>) {
  const contextFormId = React.useContext(DialogWrapperFormIdContext);
  const contextSubmitBehavior = React.useContext(
    DialogWrapperSubmitBehaviorContext
  );
  const primitiveDialog = usePrimitiveDialog();
  if (contextFormId === null) {
    throw new Error('DialogWrapperForm must be used within DialogWrapper');
  }
  const formElementId = props.id ?? contextFormId;
  const submitBehavior = props.submitBehavior ?? contextSubmitBehavior;

  return (
    <FormWrapperForm
      form={props.form}
      onSubmit={props.onSubmit}
      onInvalidSubmit={props.onInvalidSubmit}
      submitBehavior={submitBehavior}
      onValidSubmitStart={
        submitBehavior === 'fire-and-forget'
          ? primitiveDialog.onClose
          : undefined
      }
      className={cn('flex w-full flex-col gap-y-6', props.className)}
      id={formElementId}
    >
      {props.children}
    </FormWrapperForm>
  );
}

interface DialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  descriptionContent?: React.ReactElement;
  icon?: Icon;
  iconWeight?: ComponentProps<Icon>['weight'];
  titleExtra?: ReactNode;
  isLoading?: boolean;
  showCloseButton?: boolean;
  showDragHandle?: boolean;
  showHeader?: boolean;
  disableAnimations?: boolean;
  allowContentOverflow?: boolean;
  maxWidth?: string;
  headerClassName?: string;
  titleClassName?: string;
  contentClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  showContentLoadingOverlay?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  footerHint?: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  submitBehavior?: FormSubmitBehavior;
  confirmDisabled?: boolean;
  confirmVariant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  confirmType?: 'button' | 'submit';
  hideFooter?: boolean;
  onEnterSubmit?: () => void;
  isEnterDisabled?: () => boolean;
  renderConfirmButton?: (ctx: {
    formId: string;
    disabled: boolean;
    isLoading: boolean;
    onConfirm: () => void;
  }) => ReactNode;
}

interface DialogWrapperHeaderProps {
  title: ReactNode;
  icon?: Icon;
  iconWeight?: ComponentProps<Icon>['weight'];
  titleExtra?: ReactNode;
  className?: string;
  titleClassName?: string;
}

type DialogWrapperFooterProps = ComponentProps<'div'>;

interface DialogWrapperCancelButtonProps extends ComponentProps<'button'> {
  variant?: 'outline' | 'ghost';
  layout?: 'default' | 'dialogAction' | 'grow';
}

interface DialogWrapperActionsProps {
  cancelLabel?: ReactNode;
  confirmLabel?: ReactNode;
  isLoading?: boolean;
  onConfirm?: () => void;
  submitBehavior?: FormSubmitBehavior;
  confirmDisabled?: boolean;
  confirmVariant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  confirmType?: 'button' | 'submit';
  confirmFormId?: string;
  footerClassName?: string;
  renderConfirmButton?: (ctx: {
    formId: string;
    disabled: boolean;
    isLoading: boolean;
    onConfirm: () => void;
  }) => ReactNode;
}

function DialogWrapperTitle(props: {
  className?: string;
  children: ReactNode;
}) {
  // Match DialogContent's mobile/desktop split via breakpoint — do not require
  // Dialog context here (title can render while the sheet is portaled/closing).
  const breakpoint = useBreakpoint();
  const TitleComponent = breakpoint.isMobile ? DrawerTitle : DialogTitle;

  return (
    <TitleComponent
      className={cn(
        'min-w-0 truncate text-lg leading-normal font-medium',
        props.className
      )}
    >
      {props.children}
    </TitleComponent>
  );
}

function DialogWrapperDescription(props: {
  className?: string;
  children: ReactNode;
}) {
  const breakpoint = useBreakpoint();
  const DescriptionComponent = breakpoint.isMobile
    ? DrawerDescription
    : DialogDescription;

  return (
    <DescriptionComponent className={props.className}>
      {props.children}
    </DescriptionComponent>
  );
}

export const DialogWrapperHeader = React.memo(function DialogWrapperHeader(
  props: DialogWrapperHeaderProps
) {
  const IconComponent = props.icon;

  return (
    <DialogHeader
      className={cn(
        'flex flex-row items-center gap-2 border-b border-border-subtle bg-background px-6 pb-3 pt-0 md:pe-14 md:pt-4',
        'min-w-0 shrink-0',
        props.className
      )}
    >
      {IconComponent && (
        <div className="rounded-xl bg-background-base p-2 border shrink-0">
          <IconComponent size={24} weight={props.iconWeight ?? 'duotone'} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <DialogWrapperTitle
          className={cn('min-w-0 overflow-hidden', props.titleClassName)}
        >
          <TruncateText>{props.title}</TruncateText>
        </DialogWrapperTitle>
      </div>
      {props.titleExtra}
      <DialogWrapperDescription className="sr-only">
        <TruncateText>{props.title}</TruncateText>
      </DialogWrapperDescription>
    </DialogHeader>
  );
});

export function DialogFooter(props: DialogWrapperFooterProps) {
  const { className, ...footerProps } = props;

  return (
    <DialogPrimitiveFooter
      className={cn('px-6 py-5', className)}
      {...footerProps}
    />
  );
}

export function DialogCancelButton(props: DialogWrapperCancelButtonProps) {
  return <DialogPrimitiveCancelButton {...props} />;
}

export function DialogWrapperActions(props: DialogWrapperActionsProps) {
  const primitiveDialog = usePrimitiveDialog();
  const contextSubmitBehavior = React.useContext(
    DialogWrapperSubmitBehaviorContext
  );
  const confirmType = props.confirmType ?? 'button';
  const confirmVariant = props.confirmVariant ?? 'primary';
  const submitBehavior = props.submitBehavior ?? contextSubmitBehavior;
  const isConfirmDisabled = !!(props.confirmDisabled || props.isLoading);
  const formId = props.confirmFormId ?? '';

  const handleConfirm = React.useCallback(() => {
    if (!props.onConfirm) {
      return;
    }

    if (submitBehavior === 'fire-and-forget') {
      fireAndForgetDialogAction(primitiveDialog.onClose, props.onConfirm);

      return;
    }

    props.onConfirm();
  }, [primitiveDialog, props.onConfirm, submitBehavior]);

  const confirmControl = props.renderConfirmButton ? (
    props.renderConfirmButton({
      formId,
      disabled: isConfirmDisabled,
      isLoading: !!props.isLoading,
      onConfirm: handleConfirm
    })
  ) : (
    <Button
      type={confirmType}
      variant={confirmVariant}
      size="lgTall"
      layout="grow"
      form={confirmType === 'submit' ? props.confirmFormId : undefined}
      onClick={confirmType === 'button' ? handleConfirm : undefined}
      disabled={isConfirmDisabled}
      loading={props.isLoading}
    >
      {props.confirmLabel}
    </Button>
  );

  return (
    <DialogFooter className={props.footerClassName}>
      {props.cancelLabel != null && props.cancelLabel !== '' ? (
        <DialogCancelButton layout="grow" disabled={props.isLoading}>
          {props.cancelLabel}
        </DialogCancelButton>
      ) : null}
      {confirmControl}
    </DialogFooter>
  );
}

function DialogWrapperContent(
  props: DialogWrapperProps & { dialogFormId: string }
) {
  const maxWidth = props.maxWidth ?? 'md:max-w-[500px]';
  const showCloseButton = props.showCloseButton ?? true;
  const showHeader = props.showHeader ?? true;
  const confirmType = props.confirmType ?? 'button';
  const hasConfirmAction =
    props.renderConfirmButton !== undefined || props.confirmLabel !== undefined;
  const hasDefaultFooter =
    !props.hideFooter &&
    hasConfirmAction &&
    (confirmType === 'submit' ||
      props.onConfirm !== undefined ||
      props.renderConfirmButton !== undefined);

  const showContentOverlay = props.showContentLoadingOverlay === true;

  return (
    <DialogContent
      className={cn(
        maxWidth,
        'grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0',
        props.contentClassName
      )}
      isLoading={!!(showContentOverlay && props.isLoading)}
      showCloseButton={showCloseButton}
      showDragHandle={props.showDragHandle}
      allowContentOverflow={props.allowContentOverflow}
    >
      {showHeader ? (
        <DialogWrapperHeader
          title={props.title}
          icon={props.icon}
          iconWeight={props.iconWeight}
          titleExtra={props.titleExtra}
          className={props.headerClassName}
          titleClassName={props.titleClassName}
        />
      ) : (
        <DialogWrapperTitle className="sr-only">
          {props.title}
        </DialogWrapperTitle>
      )}
      {!props.description && !showHeader && (
        <DialogWrapperDescription className="sr-only">
          {props.title}
        </DialogWrapperDescription>
      )}
      <DialogBody
        className={cn('flex flex-col gap-6 py-6', props.bodyClassName)}
      >
        {props.description && (
          <div className="grid gap-2 px-6 min-w-0">
            <div className="flex min-w-0">
              <DialogDescription asChild>
                {props.descriptionContent ?? (
                  <p className="min-w-0 text-base font-medium text-text-secondary break-words">
                    {props.description}
                  </p>
                )}
              </DialogDescription>
            </div>
          </div>
        )}
        {props.children}
      </DialogBody>
      {props.footer !== undefined ? (
        <div className="shrink-0">{props.footer}</div>
      ) : props.footerHint ? (
        <div className="px-6 py-3 border-t border-border-subtle bg-background shrink-0">
          <p className="text-xs text-text-tertiary text-center">
            {props.footerHint}
          </p>
        </div>
      ) : hasDefaultFooter ? (
        <DialogWrapperActions
          cancelLabel={props.cancelLabel}
          confirmLabel={props.confirmLabel}
          isLoading={props.isLoading}
          onConfirm={props.onConfirm}
          submitBehavior={props.submitBehavior}
          confirmDisabled={props.confirmDisabled}
          confirmVariant={props.confirmVariant}
          confirmType={props.confirmType}
          confirmFormId={props.dialogFormId}
          footerClassName={props.footerClassName}
          renderConfirmButton={props.renderConfirmButton}
        />
      ) : null}
    </DialogContent>
  );
}

export function DialogWrapper(props: DialogWrapperProps) {
  const rawId = React.useId();
  const dialogFormId = `dms-dialog-form-${rawId.replace(/:/g, '')}`;
  const submitBehavior = props.submitBehavior ?? 'fire-and-forget';

  const requestFormSubmit = React.useCallback(() => {
    const el = document.getElementById(dialogFormId);
    if (el instanceof HTMLFormElement) {
      el.requestSubmit();
    }
  }, [dialogFormId]);

  // Dialogs that render their own footer submit button (no onConfirm, no
  // confirmType="submit") still need Enter to submit: the global dialog
  // hotkey preempts the browser's implicit form submission, so mirror it —
  // submit through the form's default submit button, respecting disabled.
  const requestImplicitFormSubmit = React.useCallback(() => {
    const el = document.getElementById(dialogFormId);
    if (!(el instanceof HTMLFormElement)) {
      return;
    }

    const defaultButton = Array.from(el.elements).find(
      (control): control is HTMLButtonElement | HTMLInputElement =>
        (control instanceof HTMLButtonElement ||
          control instanceof HTMLInputElement) &&
        control.type === 'submit'
    );
    if (!defaultButton || defaultButton.disabled) {
      return;
    }

    el.requestSubmit(defaultButton);
  }, [dialogFormId]);

  const confirmType = props.confirmType ?? 'button';
  const handleConfirm = React.useCallback(() => {
    if (!props.onConfirm) {
      return;
    }

    if (submitBehavior === 'fire-and-forget') {
      fireAndForgetDialogAction(
        () => props.onOpenChange(false),
        props.onConfirm
      );

      return;
    }

    props.onConfirm();
  }, [props.onConfirm, props.onOpenChange, submitBehavior]);
  const canUseEnterSubmit =
    props.onConfirm !== undefined || confirmType === 'submit';

  const resolvedOnEnterSubmit =
    props.onEnterSubmit ??
    (confirmType === 'submit'
      ? requestFormSubmit
      : props.onConfirm !== undefined
        ? handleConfirm
        : requestImplicitFormSubmit);

  const resolvedIsEnterDisabled =
    props.isEnterDisabled ??
    (canUseEnterSubmit
      ? () => !!(props.confirmDisabled || props.isLoading)
      : undefined);

  return (
    <DialogWrapperFormIdContext.Provider value={dialogFormId}>
      <DialogWrapperSubmitBehaviorContext.Provider value={submitBehavior}>
        <Dialog
          open={props.open}
          onOpenChange={props.onOpenChange}
          disableAnimations={props.disableAnimations}
          onEnterSubmit={resolvedOnEnterSubmit}
          isEnterDisabled={resolvedIsEnterDisabled}
        >
          <DialogWrapperContent {...props} dialogFormId={dialogFormId} />
        </Dialog>
      </DialogWrapperSubmitBehaviorContext.Provider>
    </DialogWrapperFormIdContext.Provider>
  );
}

export const useDialog = usePrimitiveDialog;
