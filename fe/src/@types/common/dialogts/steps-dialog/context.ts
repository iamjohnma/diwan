import type * as React from 'react';
import type { Icon, IconWeight } from '@phosphor-icons/react';
import type { FormSubmitBehavior } from '@/components/common';

export interface StepConfig {
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
}

export type StepsDialogPresentation = 'dialog' | 'drawer';

export interface StepsDialogContextValue {
  dialogId: string;
  presentation: StepsDialogPresentation;
  open: boolean;
  visualOpen: boolean;
  onClose: () => void;
  disableAnimations: boolean;
  activeNestedViewId: string | null;
  openNestedView: (id: string) => void;
  closeNestedView: () => void;
  nestedLayerContainer: HTMLDivElement | null;
  setNestedLayerContainer: (container: HTMLDivElement | null) => void;
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  totalSteps: number;
  setTotalSteps: React.Dispatch<React.SetStateAction<number>>;
  direction: number;
  goNext: () => void;
  goPrevious: () => void;
  /** Jump to an arbitrary step index, animating in the correct direction. */
  goToStep: (index: number) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isStepTransitioning: boolean;
  setStepTransitioning: (transitioning: boolean) => void;
  stepConfigs: Map<number, StepConfig>;
  registerStepConfig: (index: number, config: StepConfig) => void;
  unregisterStepConfig: (index: number) => void;
}
