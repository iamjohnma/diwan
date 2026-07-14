'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { cn } from '@/utils/common/cn';

const DISABLED_ANIMATION = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0 }
};

interface DialogLoadingOverlayProps {
  isLoading: boolean;
  /** Per-surface extras: z-index and corner rounding matching the host container. */
  className?: string;
  disableAnimations?: boolean;
  /** Fade duration in seconds. */
  fadeDuration?: number;
}

/**
 * Blurred loading overlay shared by the base dialog and
 * StepsDialogStep so the busy state looks and animates the same everywhere.
 */
export function DialogLoadingOverlay(props: DialogLoadingOverlayProps) {
  const { t } = useTranslation();
  const animation = props.disableAnimations
    ? DISABLED_ANIMATION
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: props.fadeDuration ?? 0.15 }
      };

  return (
    <AnimatePresence>
      {props.isLoading && (
        <motion.div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm',
            props.className
          )}
          layout={false}
          initial={animation.initial}
          animate={animation.animate}
          exit={animation.exit}
          transition={animation.transition}
        >
          <LoadingSpinner color="primary" size="sm" removePadding />
          <span className="sr-only">{t('common.loading')}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
