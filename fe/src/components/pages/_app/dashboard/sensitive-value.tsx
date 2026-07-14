import type { ReactNode } from 'react';
import { EyeIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const STATIC_MASK = '●●●●●';

interface SensitiveValueProps {
  children: ReactNode;
  className?: string;
  hidden: boolean;
}

export function DashboardSensitiveValue(props: SensitiveValueProps) {
  return (
    <span className={cn('relative inline-block', props.className)}>
      <motion.span
        animate={{ opacity: props.hidden ? 0 : 1, y: props.hidden ? 6 : 0 }}
        className="block tabular-nums"
        initial={false}
        transition={{ duration: 0.2 }}
      >
        {props.children}
      </motion.span>
      <motion.span
        animate={{ opacity: props.hidden ? 1 : 0, y: props.hidden ? 0 : -6 }}
        aria-hidden
        className="absolute inset-0 select-none tracking-widest"
        initial={false}
        transition={{ duration: 0.2 }}
      >
        {STATIC_MASK}
      </motion.span>
    </span>
  );
}

interface SensitiveSectionProps {
  children: ReactNode;
  className?: string;
  hidden: boolean;
  onReveal: () => void;
}

export function DashboardSensitiveSection(props: SensitiveSectionProps) {
  const translation = useTranslation();

  return (
    <div className={cn('relative', props.className)}>
      {props.children}
      <AnimatePresence>
        {props.hidden ? (
          <motion.button
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            aria-label={translation.t('dashboard.privacy.reveal')}
            className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-background-base/30"
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            initial={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            onClick={props.onReveal}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            type="button"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-background-surface/80 shadow-xs">
              <EyeIcon
                className="size-5 text-text-secondary"
                weight="duotone"
              />
            </span>
            <span className="text-xs font-medium text-text-secondary">
              {translation.t('dashboard.privacy.clickToReveal')}
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
