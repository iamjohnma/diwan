'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/common/cn';

/** Larger tap target for dialog submit/back actions on mobile only. */
export const dialogStepFooterMobileSubmitClassName =
  '[&_[data-slot=button]]:max-md:!h-12 [&_[data-slot=button]]:max-md:!min-h-12';

interface DialogStepFooterProps {
  /** Custom footer content; when provided it replaces the back/next row. */
  footer?: ReactNode;
  hideFooter?: boolean;
  showBack: boolean;
  backLabel?: ReactNode;
  nextLabel: ReactNode;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext: () => void;
}

/** Back/next footer row used by StepsDialogStep. */
export function DialogStepFooter(props: DialogStepFooterProps) {
  if (props.footer) {
    return (
      <div
        data-slot="dialog-step-footer"
        className={cn(
          'shrink-0 bg-background',
          dialogStepFooterMobileSubmitClassName
        )}
      >
        {props.footer}
      </div>
    );
  }
  if (props.hideFooter) {
    return null;
  }

  return (
    <div
      data-slot="dialog-step-footer"
      className={cn(
        'flex shrink-0 flex-row gap-2 border-t border-border-default bg-background px-6 py-5',
        dialogStepFooterMobileSubmitClassName
      )}
    >
      {props.showBack && (
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="flex-1 text-base font-medium"
          disabled={props.backDisabled}
          onClick={props.onBack}
        >
          {props.backLabel}
        </Button>
      )}
      <Button
        type="button"
        variant="primary"
        size="xl"
        className="flex-1 text-base font-medium"
        disabled={props.nextDisabled}
        onClick={props.onNext}
      >
        {props.nextLabel}
      </Button>
    </div>
  );
}
