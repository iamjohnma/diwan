'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TruncateText } from '@/components/common/truncate-text';
import {
  STEPS_DIALOG_SLIDE_TRANSITION,
  createStepsDialogSlideVariants
} from '@/components/dialogts/common/steps-dialog/steps-dialog-slide-variants';
import { useDirection } from '@/hooks/common/direction';
import { useMouseImmediatePress } from '@/hooks/common/mouse-immediate-press';
import { cn } from '@/utils/common/cn';

export interface DialogView {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

interface DialogViewsProps {
  views: DialogView[];
  activeId: string;
  onActiveChange: (id: string) => void;
  className?: string;
  contentClassName?: string;
}

const VIEW_TRANSITION = STEPS_DIALOG_SLIDE_TRANSITION;

const INDICATOR_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35
};

export function DialogViews(props: DialogViewsProps) {
  const { views, activeId, onActiveChange } = props;
  const direction = useDirection();
  const isRtl = direction === 'rtl';
  const slideVariants = React.useMemo(
    () => createStepsDialogSlideVariants(isRtl),
    [isRtl]
  );
  const mouseImmediatePress = useMouseImmediatePress();

  const activeIndex = Math.max(
    0,
    views.findIndex((view) => view.id === activeId)
  );
  const activeView = views[activeIndex];
  const segmentWidthPercent = views.length > 0 ? 100 / views.length : 0;

  const previousIndexRef = React.useRef(activeIndex);
  const slideDirection = activeIndex >= previousIndexRef.current ? 1 : -1;
  const shouldAnimateIndicator = previousIndexRef.current !== activeIndex;
  React.useEffect(() => {
    previousIndexRef.current = activeIndex;
  }, [activeIndex]);

  const measureRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | 'auto'>('auto');
  const [animated, setAnimated] = React.useState(false);
  const lastHeightRef = React.useRef(0);

  const measureHeight = React.useCallback((animate = false) => {
    const element = measureRef.current;
    if (!element) {
      return;
    }

    const nextHeight = element.offsetHeight;
    if (nextHeight > 0 && nextHeight !== lastHeightRef.current) {
      lastHeightRef.current = nextHeight;
      setAnimated(animate);
      setHeight(nextHeight);
    }
  }, []);

  React.useLayoutEffect(() => {
    measureHeight(lastHeightRef.current !== 0);
  }, [activeIndex, measureHeight]);

  React.useEffect(() => {
    const element = measureRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => measureHeight());
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [activeIndex, measureHeight]);

  const tabGridStyle = React.useMemo(
    () => ({
      gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))`
    }),
    [views.length]
  );

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col overflow-x-hidden',
        props.className
      )}
    >
      <div
        className="relative grid w-full min-w-0 shrink-0 border-t border-border-default"
        style={tabGridStyle}
      >
        {views.map((view) => {
          const isSelected = view.id === activeId;
          const press = mouseImmediatePress.bindPress(() =>
            onActiveChange(view.id)
          );

          return (
            <button
              key={view.id}
              type="button"
              onClick={press.onClick}
              onPointerDown={press.onPointerDown}
              onPointerUp={press.onPointerUp}
              onPointerCancel={press.onPointerCancel}
              className={cn(
                'relative flex w-full min-w-0 cursor-pointer flex-col items-center justify-center border-0 bg-transparent px-2 pb-2 pt-2 text-sm shadow-none transition-colors select-none',
                'hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0 active:bg-transparent',
                '[-webkit-tap-highlight-color:transparent] [touch-action:manipulation]',
                isSelected
                  ? 'font-semibold text-primary'
                  : 'font-medium text-text-secondary hover:text-text-primary'
              )}
            >
              <TruncateText className="w-full max-w-full text-center">
                {view.label}
              </TruncateText>
            </button>
          );
        })}
        {views.length > 0 && (
          <motion.div
            className="pointer-events-none absolute top-0 z-10 h-0.5 bg-primary [inset-inline-start:var(--dialog-view-indicator-offset)] [width:var(--dialog-view-indicator-width)]"
            initial={false}
            animate={{
              '--dialog-view-indicator-offset': `${activeIndex * segmentWidthPercent}%`,
              '--dialog-view-indicator-width': `${segmentWidthPercent}%`
            }}
            transition={
              shouldAnimateIndicator ? INDICATOR_TRANSITION : { duration: 0 }
            }
          />
        )}
      </div>
      <div className="pt-3">
        <motion.div
          className={cn('relative overflow-hidden', props.contentClassName)}
          animate={{ height }}
          transition={animated ? VIEW_TRANSITION : { duration: 0 }}
        >
          <AnimatePresence
            mode="popLayout"
            initial={false}
            custom={slideDirection}
            onExitComplete={() => measureHeight()}
          >
            <motion.div
              key={activeView?.id ?? activeIndex}
              ref={measureRef}
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={VIEW_TRANSITION}
              onAnimationComplete={() => measureHeight()}
            >
              {activeView?.content}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
