'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { StepsDialogContext } from '@/components/dialogts/common/steps-dialog/context';
import { cn } from '@/utils/common/cn';

export function StepsDialogOverlay(
  props: React.ComponentProps<typeof DialogPrimitive.Overlay>
) {
  const context = React.useContext(StepsDialogContext);
  const disableAnimations = context?.disableAnimations ?? false;

  return (
    <DialogPrimitive.Overlay forceMount asChild {...props}>
      <div
        data-slot="steps-dialog-overlay"
        className={cn(
          'pointer-events-auto fixed inset-0 bg-black/40 backdrop-blur-[2px]',
          !disableAnimations &&
            'data-[state=open]:animate-[dialog-overlay-enter_120ms_cubic-bezier(0.16,1,0.3,1)_both]',
          !disableAnimations &&
            'data-[state=closed]:animate-[dialog-overlay-exit_100ms_cubic-bezier(0.4,0,1,1)_both]',
          props.className
        )}
      />
    </DialogPrimitive.Overlay>
  );
}
