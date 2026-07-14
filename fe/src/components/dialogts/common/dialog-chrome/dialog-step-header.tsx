'use client';

import type { ComponentProps, ReactNode, Ref } from 'react';
import type { Icon, IconWeight } from '@phosphor-icons/react';
import { ArrowLeftIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/common/cn';

/** Title styling shared by every step-style dialog header (stack, steps, nested). */
export const DIALOG_STEP_TITLE_CLASS_NAME =
  'min-w-0 flex-1 truncate text-lg leading-normal font-medium';

interface DialogStepHeaderRowProps extends ComponentProps<'div'> {
  children: ReactNode;
}

/** Header container row shared by StepsDialogStep and StepsDialogNestedView. */
export function DialogStepHeaderRow(props: DialogStepHeaderRowProps) {
  const { className, ...rowProps } = props;

  return (
    <div
      className={cn(
        'flex min-w-0 shrink-0 flex-row items-center gap-2 border-b border-border-subtle bg-background px-6 pt-0 pb-3 md:pt-4',
        className
      )}
      {...rowProps}
    />
  );
}

interface DialogStepBackButtonProps {
  /** Step icon shown while the back arrow is hidden (first step / preventBack). */
  icon?: Icon;
  iconWeight?: IconWeight;
  /** When true the step icon is shown and the button is inert; otherwise a back arrow. */
  showIcon: boolean;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * The 40px header button that morphs between the step icon (inert) and a back
 * arrow (interactive), cross-fading between the two states.
 */
export function DialogStepBackButton(props: DialogStepBackButtonProps) {
  const { t } = useTranslation();
  const IconComponent = props.icon;
  const showIcon = props.showIcon && IconComponent !== undefined;

  return (
    <button
      ref={props.buttonRef}
      type="button"
      disabled={showIcon}
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background-base p-2 transition-colors',
        showIcon
          ? 'cursor-default'
          : 'cursor-pointer hover:bg-secondary-hover/50'
      )}
      onClick={props.onClick}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={
            showIcon && IconComponent
              ? `icon-${IconComponent.displayName || IconComponent.name || 'default'}`
              : 'back'
          }
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeInOut' }}
        >
          {showIcon && IconComponent ? (
            <IconComponent size={24} weight={props.iconWeight ?? 'duotone'} />
          ) : (
            <ArrowLeftIcon
              size={24}
              weight="regular"
              className="rtl:rotate-180"
            />
          )}
        </motion.div>
      </AnimatePresence>
      {!showIcon && <span className="sr-only">{t('common.back')}</span>}
    </button>
  );
}

interface DialogStepCloseButtonProps {
  onClick: () => void;
}

/** Plain close button used by headers whose close is an onClick (stack, nested view). */
export function DialogStepCloseButton(props: DialogStepCloseButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={props.onClick}
      className="ring-offset-background focus:ring-ring shrink-0 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
    >
      <XIcon className="size-5" />
      <span className="sr-only">{t('common.dialog.close')}</span>
    </button>
  );
}
