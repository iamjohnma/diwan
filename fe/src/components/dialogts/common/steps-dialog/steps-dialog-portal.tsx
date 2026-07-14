'use client';

import type * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';

export function StepsDialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>
) {
  return (
    <DialogPrimitive.Portal
      data-slot="steps-dialog-portal"
      {...props}
      forceMount
    />
  );
}
