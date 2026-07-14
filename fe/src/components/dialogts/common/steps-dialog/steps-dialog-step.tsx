'use client';

import * as React from 'react';
import type { Icon, IconWeight } from '@phosphor-icons/react';
import { XIcon } from '@phosphor-icons/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { FormSubmitBehavior } from '@/components/common/form-wrapper';
import { TruncateText } from '@/components/common/truncate-text';
import {
  DIALOG_STEP_TITLE_CLASS_NAME,
  DialogLoadingOverlay,
  DialogStepBackButton,
  DialogStepFooter,
  DialogStepHeaderRow
} from '@/components/dialogts/common/dialog-chrome';
import {
  StepIndexContext,
  StepsDialogContext
} from '@/components/dialogts/common/steps-dialog/context';
import { DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useDialogSubmit } from '@/hooks/common/dialog-submit';
import { cn } from '@/utils/common/cn';
import { fireAndForgetDialogAction } from '@/utils/common/dialog-actions';
import { useTranslation } from 'react-i18next';

interface StepsDialogStepProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon: Icon;
  iconWeight?: IconWeight;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  hideFooter?: boolean;
  showBackButton?: boolean;
  backLabel?: string;
  onBack?: () => void;
  nextLabel?: string;
  onNext?: () => undefined | boolean | Promise<undefined | boolean>;
  submitBehavior?: FormSubmitBehavior;
  nextDisabled?: boolean;
  isLoading?: boolean;
  preventBack?: boolean;
  children: React.ReactNode;
}

function StepsDialogTitle(props: {
  presentation: 'dialog' | 'drawer';
  children: React.ReactNode;
}) {
  const TitleComponent =
    props.presentation === 'drawer' ? DrawerTitle : DialogPrimitive.Title;

  return (
    <TitleComponent
      data-slot="steps-dialog-title"
      className={DIALOG_STEP_TITLE_CLASS_NAME}
    >
      <TruncateText>{props.children}</TruncateText>
    </TitleComponent>
  );
}

function StepsDialogCloseButton(props: { presentation: 'dialog' | 'drawer' }) {
  const { t } = useTranslation();

  // Bottom sheets never show an X — swipe-down and outside taps close them.
  if (props.presentation === 'drawer') {
    return null;
  }

  return (
    <DialogPrimitive.Close
      data-slot="steps-dialog-close"
      className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground shrink-0 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      <XIcon className="size-5" />
      <span className="sr-only">{t('common.dialog.close')}</span>
    </DialogPrimitive.Close>
  );
}

export function StepsDialogStep(props: StepsDialogStepProps) {
  const context = React.useContext(StepsDialogContext);
  const stepIndex = React.useContext(StepIndexContext);

  const registerStepConfig = context?.registerStepConfig;
  const unregisterStepConfig = context?.unregisterStepConfig;
  const presentation = context?.presentation ?? 'dialog';
  const open = context?.open ?? false;
  const activeStep = context?.activeStep ?? 0;
  const isActiveStep = stepIndex === activeStep;
  const isStepTransitioning = context?.isStepTransitioning ?? false;
  const isFirstStep = context?.isFirstStep ?? true;
  const goPrevious = context?.goPrevious;
  const goNext = context?.goNext;

  const iconWeight = props.iconWeight ?? 'duotone';
  const isLoading = props.isLoading ?? false;
  const showBackButton = props.showBackButton ?? true;
  const hideFooter = props.hideFooter ?? false;
  const backLabel = props.backLabel ?? 'Back';
  const nextLabel = props.nextLabel ?? 'Next';
  const nextDisabled = props.nextDisabled ?? false;
  const submitBehavior = props.submitBehavior ?? 'await';
  const preventBack = props.preventBack ?? false;
  const shouldShowIcon = isFirstStep || preventBack;
  const DescriptionComponent =
    presentation === 'drawer' ? DrawerDescription : DialogPrimitive.Description;

  const handleBack = React.useCallback(() => {
    props.onBack?.();
    goPrevious?.();
  }, [goPrevious, props.onBack]);

  const handleNext = React.useCallback(async () => {
    if (isStepTransitioning) {
      return;
    }

    if (submitBehavior === 'fire-and-forget') {
      fireAndForgetDialogAction(() => context?.onClose(), props.onNext);

      return;
    }

    const result = props.onNext?.();
    const shouldAdvance = result instanceof Promise ? await result : result;
    if (shouldAdvance === false) {
      return;
    }
    goNext?.();
  }, [context, goNext, isStepTransitioning, props.onNext, submitBehavior]);

  const isNextDisabled = React.useCallback(
    () => !props.onNext || nextDisabled || isLoading || isStepTransitioning,
    [isLoading, isStepTransitioning, nextDisabled, props.onNext]
  );

  useDialogSubmit({
    open: open && isActiveStep,
    onSubmit: handleNext,
    isDisabled: isNextDisabled
  });

  React.useLayoutEffect(() => {
    if (!registerStepConfig) return;

    registerStepConfig(stepIndex, {
      title: props.title,
      icon: props.icon,
      iconWeight: props.iconWeight,
      headerAction: props.headerAction,
      footer: props.footer,
      hideFooter: props.hideFooter,
      showBackButton: props.showBackButton,
      backLabel: props.backLabel,
      onBack: props.onBack,
      nextLabel: props.nextLabel,
      onNext: props.onNext,
      submitBehavior: props.submitBehavior,
      nextDisabled: props.nextDisabled,
      isLoading: props.isLoading,
      preventBack: props.preventBack
    });
  }, [
    registerStepConfig,
    stepIndex,
    props.title,
    props.icon,
    props.iconWeight,
    props.headerAction,
    props.footer,
    props.hideFooter,
    props.showBackButton,
    props.backLabel,
    props.onBack,
    props.nextLabel,
    props.onNext,
    props.submitBehavior,
    props.nextDisabled,
    props.isLoading,
    props.preventBack
  ]);

  React.useEffect(() => {
    return () => {
      unregisterStepConfig?.(stepIndex);
    };
  }, [unregisterStepConfig, stepIndex]);

  return (
    <>
      <DialogStepHeaderRow>
        <DialogStepBackButton
          icon={props.icon}
          iconWeight={iconWeight}
          showIcon={shouldShowIcon}
          onClick={handleBack}
        />
        <StepsDialogTitle presentation={presentation}>
          {props.title}
        </StepsDialogTitle>
        <DescriptionComponent className="sr-only">
          {props.title}
        </DescriptionComponent>
        {props.headerAction}
        <StepsDialogCloseButton presentation={presentation} />
      </DialogStepHeaderRow>
      <div
        data-slot="steps-dialog-body"
        className={cn(
          'hide-scrollbar min-h-0 overflow-x-hidden overflow-y-auto bg-background',
          props.className
        )}
      >
        <div data-slot="steps-dialog-step">{props.children}</div>
      </div>
      <DialogStepFooter
        footer={props.footer}
        hideFooter={hideFooter}
        showBack={showBackButton && !shouldShowIcon}
        backLabel={backLabel}
        nextLabel={nextLabel}
        backDisabled={isLoading}
        nextDisabled={nextDisabled || isLoading || isStepTransitioning}
        onBack={handleBack}
        onNext={handleNext}
      />
      <DialogLoadingOverlay
        isLoading={isLoading}
        fadeDuration={0.2}
        className={cn(
          'z-20',
          presentation === 'dialog' ? 'rounded-3xl' : 'rounded-t-2xl'
        )}
      />
    </>
  );
}
