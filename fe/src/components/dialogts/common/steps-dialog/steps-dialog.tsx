'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  type StepConfig,
  StepsDialogContext,
  type StepsDialogPresentation
} from '@/components/dialogts/common/steps-dialog/context';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useDialogToastLayerRegistration } from '@/hooks/common/dialog-toast-layer-registration';
import { clamp } from '@/utils/common/math';

interface StepsDialogProps extends React.ComponentProps<
  typeof DialogPrimitive.Root
> {
  defaultStep?: number;
  disableAnimations?: boolean;
  /**
   * Push this nested-view id onto the dialog the moment it opens, so the very
   * first thing the user sees is a nested second-level view layered over the
   * (base) step. Enables "make the first step nested as well".
   */
  defaultNestedViewId?: string;
}

const CONTENT_EXIT_ANIMATION_DURATION = 120;

const COMPARED_STEP_CONFIG_KEYS = [
  'title',
  'icon',
  'iconWeight',
  'hideFooter',
  'showBackButton',
  'backLabel',
  'nextLabel',
  'submitBehavior',
  'nextDisabled',
  'isLoading',
  'preventBack'
] as const satisfies readonly (keyof StepConfig)[];

export function StepsDialog(props: StepsDialogProps) {
  const {
    defaultStep: defaultStepProp,
    disableAnimations = false,
    defaultNestedViewId = null,
    open: openProp,
    defaultOpen,
    onOpenChange,
    children
  } = props;
  const defaultStep = defaultStepProp ?? 0;
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false
  );
  const [activeStep, setActiveStep] = React.useState(defaultStep);
  const [activeNestedViewId, setActiveNestedViewId] = React.useState<
    string | null
  >(null);
  const [nestedLayerContainer, setNestedLayerContainer] =
    React.useState<HTMLDivElement | null>(null);
  const [totalSteps, setTotalSteps] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [isStepTransitioning, setStepTransitioning] = React.useState(false);
  const activeStepRef = React.useRef(activeStep);
  const stepConfigsRef = React.useRef<Map<number, StepConfig>>(new Map());
  const [configVersion, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const dialogId = React.useId();
  const dialogIdRef = React.useRef(`steps-dialog-${dialogId}`);
  const breakpoint = useBreakpoint();
  const presentation: StepsDialogPresentation = breakpoint.isMobile
    ? 'drawer'
    : 'dialog';

  const open = isControlled ? openProp : uncontrolledOpen;
  const exitAnimationDuration = disableAnimations
    ? 0
    : CONTENT_EXIT_ANIMATION_DURATION;

  const [delayedRootOpen, setDelayedRootOpen] = React.useState(open ?? false);
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const effectiveOpen = (open ?? false) && !isClosing;
  const rootOpen = effectiveOpen || delayedRootOpen;

  React.useLayoutEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (nextOpen) {
        clearCloseTimeout();
        setIsClosing(false);
        if (!isControlled) setUncontrolledOpen(true);
        onOpenChange?.(true);
      } else {
        clearCloseTimeout();
        setActiveNestedViewId(null);
        setIsClosing(true);
        closeTimeoutRef.current = setTimeout(() => {
          closeTimeoutRef.current = null;
          setIsClosing(false);
          if (!isControlled) setUncontrolledOpen(false);
          onOpenChange?.(false);
          setActiveStep(defaultStep);
        }, exitAnimationDuration);
      }
    },
    [
      clearCloseTimeout,
      defaultStep,
      exitAnimationDuration,
      isControlled,
      onOpenChange
    ]
  );

  const closeDialog = React.useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const openNestedView = React.useCallback((id: string) => {
    setActiveNestedViewId(id);
  }, []);

  const closeNestedView = React.useCallback(() => {
    setActiveNestedViewId(null);
  }, []);

  useDialogToastLayerRegistration(
    effectiveOpen,
    dialogIdRef.current,
    closeDialog
  );

  React.useEffect(() => {
    if (effectiveOpen) {
      setDelayedRootOpen(true);
    } else {
      const timer = setTimeout(() => {
        setDelayedRootOpen(false);
      }, exitAnimationDuration);

      return () => clearTimeout(timer);
    }
  }, [effectiveOpen, exitAnimationDuration]);

  const prevOpenForResetRef = React.useRef(false);

  React.useLayoutEffect(() => {
    const justOpened = Boolean(open) && !prevOpenForResetRef.current;
    prevOpenForResetRef.current = Boolean(open);

    if (!justOpened) {
      return;
    }

    clearCloseTimeout();
    setIsClosing(false);
    setActiveStep(defaultStep);
    setActiveNestedViewId(defaultNestedViewId);
    setDirection(1);
    setStepTransitioning(false);
  }, [clearCloseTimeout, defaultNestedViewId, defaultStep, open]);

  React.useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  React.useEffect(() => {
    if (open) {
      return;
    }

    const timer = setTimeout(() => {
      setActiveStep(defaultStep);
      setActiveNestedViewId(null);
      setDirection(1);
    }, exitAnimationDuration);

    return () => clearTimeout(timer);
  }, [defaultStep, exitAnimationDuration, open]);

  const goNext = React.useCallback(() => {
    setActiveNestedViewId(null);
    if (totalSteps <= 0) {
      return;
    }

    const previous = activeStepRef.current;
    const next = Math.min(previous + 1, totalSteps - 1);
    if (next === previous) {
      return;
    }

    setStepTransitioning(true);
    setDirection(1);
    setActiveStep(next);
  }, [setStepTransitioning, totalSteps]);

  const goPrevious = React.useCallback(() => {
    setActiveNestedViewId(null);
    const previous = activeStepRef.current;
    const next = Math.max(previous - 1, 0);
    if (next === previous) {
      return;
    }

    setStepTransitioning(true);
    setDirection(-1);
    setActiveStep(next);
  }, [setStepTransitioning]);

  const goToStep = React.useCallback(
    (index: number) => {
      if (totalSteps <= 0) {
        return;
      }
      const target = clamp(index, 0, totalSteps - 1);
      const previous = activeStepRef.current;
      if (target === previous) {
        return;
      }

      setActiveNestedViewId(null);
      setStepTransitioning(true);
      setDirection(target >= previous ? 1 : -1);
      setActiveStep(target);
    },
    [setStepTransitioning, totalSteps]
  );

  React.useEffect(() => {
    if (totalSteps <= 0) {
      return;
    }

    setActiveStep((prev) => clamp(prev, 0, totalSteps - 1));
  }, [totalSteps]);

  const registerStepConfig = React.useCallback(
    (index: number, config: StepConfig) => {
      const existing = stepConfigsRef.current.get(index);
      const hasChanged =
        !existing ||
        COMPARED_STEP_CONFIG_KEYS.some((key) => existing[key] !== config[key]);

      stepConfigsRef.current.set(index, config);

      if (hasChanged) {
        forceUpdate();
      }
    },
    []
  );

  const unregisterStepConfig = React.useCallback((index: number) => {
    stepConfigsRef.current.delete(index);
  }, []);

  const isFirstStep = activeStep <= 0;
  const isLastStep = activeStep >= totalSteps - 1;

  const contextValue = React.useMemo(
    () => ({
      dialogId: dialogIdRef.current,
      presentation,
      open: effectiveOpen,
      visualOpen: rootOpen,
      onClose: closeDialog,
      disableAnimations,
      activeNestedViewId,
      openNestedView,
      closeNestedView,
      nestedLayerContainer,
      setNestedLayerContainer,
      activeStep,
      setActiveStep,
      totalSteps,
      setTotalSteps,
      direction,
      goNext,
      goPrevious,
      goToStep,
      isFirstStep,
      isLastStep,
      isStepTransitioning,
      setStepTransitioning,
      stepConfigs: stepConfigsRef.current,
      registerStepConfig,
      unregisterStepConfig
    }),
    [
      configVersion,
      presentation,
      effectiveOpen,
      rootOpen,
      disableAnimations,
      activeNestedViewId,
      openNestedView,
      closeNestedView,
      nestedLayerContainer,
      setNestedLayerContainer,
      activeStep,
      totalSteps,
      direction,
      goNext,
      goPrevious,
      goToStep,
      isFirstStep,
      isLastStep,
      isStepTransitioning,
      setStepTransitioning,
      registerStepConfig,
      unregisterStepConfig,
      closeDialog
    ]
  );

  return (
    <StepsDialogContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        data-slot="steps-dialog"
        open={effectiveOpen}
        onOpenChange={handleOpenChange}
      >
        {children}
      </DialogPrimitive.Root>
    </StepsDialogContext.Provider>
  );
}
