import type { ComponentProps } from 'react';
import type { Dialog as DialogPrimitive } from 'radix-ui';

export interface DialogContextValue {
  dialogId: string;
  open: boolean;
  isMobile: boolean;
  disableAnimations: boolean;
  onClose: () => void;
  onEnterSubmit?: () => void;
  isEnterDisabled?: () => boolean;
}

type DialogContentPrimitiveProps = ComponentProps<
  typeof DialogPrimitive.Content
>;

export type DialogInteractOutsideEvent = Parameters<
  NonNullable<DialogContentPrimitiveProps['onInteractOutside']>
>[0];

export type DialogPointerDownOutsideEvent = Parameters<
  NonNullable<DialogContentPrimitiveProps['onPointerDownOutside']>
>[0];
