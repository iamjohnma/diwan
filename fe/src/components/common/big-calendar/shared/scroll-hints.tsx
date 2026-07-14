import { type ReactNode, memo } from 'react';
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/utils/common/cn';

const SCROLL_HINT_FADE_PROPS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 }
};

interface ScrollHintFadeProps {
  show: boolean;
  className?: string;
  style: React.CSSProperties;
  children: ReactNode;
}

function ScrollHintFade(props: ScrollHintFadeProps) {
  return (
    <AnimatePresence>
      {props.show && (
        <motion.div
          {...SCROLL_HINT_FADE_PROPS}
          className={cn(
            'pointer-events-none absolute z-30 flex',
            props.className
          )}
          style={props.style}
        >
          {props.children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface HorizontalScrollHintsProps {
  showLeft: boolean;
  showRight: boolean;
  leftOffset?: string;
  rightOffset?: string;
  topOffset?: string;
  className?: string;
}

export const HorizontalScrollHints = memo(function HorizontalScrollHints(
  props: HorizontalScrollHintsProps
) {
  return (
    <>
      <ScrollHintFade
        show={props.showLeft}
        className={cn('items-center', props.className)}
        style={{
          left: props.leftOffset ?? '0.5rem',
          top: props.topOffset ?? '0',
          bottom: '0'
        }}
      >
        <CaretLeftIcon
          className="size-4 text-text-secondary animate-scroll-hint-left"
          weight="bold"
        />
      </ScrollHintFade>
      <ScrollHintFade
        show={props.showRight}
        className={cn('items-center', props.className)}
        style={{
          right: props.rightOffset ?? '0.5rem',
          top: props.topOffset ?? '0',
          bottom: '0'
        }}
      >
        <CaretRightIcon
          className="size-4 text-text-secondary animate-scroll-hint-right"
          weight="bold"
        />
      </ScrollHintFade>
    </>
  );
});

interface VerticalScrollHintsProps {
  showAbove: boolean;
  showBelow: boolean;
  topOffset?: string;
  bottomOffset?: string;
  className?: string;
}

export const VerticalScrollHints = memo(function VerticalScrollHints(
  props: VerticalScrollHintsProps
) {
  return (
    <>
      <ScrollHintFade
        show={props.showAbove}
        className={cn('inset-x-0 justify-center', props.className)}
        style={{ top: props.topOffset ?? '0.5rem' }}
      >
        <CaretUpIcon
          className="size-4 text-text-secondary animate-scroll-hint-up"
          weight="bold"
        />
      </ScrollHintFade>
      <ScrollHintFade
        show={props.showBelow}
        className={cn('inset-x-0 justify-center', props.className)}
        style={{ bottom: props.bottomOffset ?? '0.5rem' }}
      >
        <CaretDownIcon
          className="size-4 text-text-secondary animate-scroll-hint-down"
          weight="bold"
        />
      </ScrollHintFade>
    </>
  );
});
