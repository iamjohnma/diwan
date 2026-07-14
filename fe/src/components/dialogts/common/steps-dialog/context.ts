'use client';

import * as React from 'react';
import type {
  StepConfig,
  StepsDialogContextValue,
  StepsDialogPresentation
} from '@/@types/common/dialogts/steps-dialog/context';

export type { StepConfig, StepsDialogContextValue, StepsDialogPresentation };

export const StepsDialogContext =
  React.createContext<StepsDialogContextValue | null>(null);

export const StepIndexContext = React.createContext<number>(0);

export function useStepsDialog() {
  const context = React.useContext(StepsDialogContext);
  if (!context) {
    throw new Error('useStepsDialog must be used within a StepsDialog');
  }

  return context;
}
