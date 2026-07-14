'use client';

import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

export type FloatingSlabVariant = 'default' | 'destructive' | 'error';

interface FloatingSlabLayout {
  top: number;
  height: number;
  insetInlineStart: number;
  width: number;
}

export interface FloatingSlabState {
  layout: FloatingSlabLayout;
  itemKey: string;
  variant?: FloatingSlabVariant;
  instantTransition?: boolean;
}

const SLAB_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 38,
  mass: 0.85,
  opacity: { duration: 0.15 }
};

const SLAB_BACKGROUND_CLASSES = {
  default: 'bg-secondary',
  destructive: 'bg-destructive/10',
  error: 'bg-error/10'
} satisfies Record<FloatingSlabVariant, string>;

function getOffsetTopWithinContainer(
  itemEl: HTMLElement,
  containerEl: HTMLElement
) {
  const itemRect = itemEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  return itemRect.top - containerRect.top + containerEl.scrollTop;
}

export function getFloatingSlabLayout(
  itemEl: HTMLElement,
  containerEl: HTMLElement
): FloatingSlabLayout {
  const style = getComputedStyle(containerEl);
  const padStart = parseFloat(style.paddingInlineStart) || 0;
  const padEnd = parseFloat(style.paddingInlineEnd) || 0;
  const innerWidth = containerEl.clientWidth - padStart - padEnd;

  return {
    top: getOffsetTopWithinContainer(itemEl, containerEl),
    height: itemEl.offsetHeight,
    insetInlineStart: padStart,
    width: Math.max(0, innerWidth)
  };
}

function slabBackgroundClass(variant: FloatingSlabVariant | undefined): string {
  return SLAB_BACKGROUND_CLASSES[variant ?? 'default'];
}

export function isSlabOverItem(
  slab: FloatingSlabState | null | undefined,
  itemKey: string
): boolean {
  if (slab == null) return false;

  return String(slab.itemKey) === String(itemKey);
}

interface FloatingListSlabLayerProps {
  slab: FloatingSlabState | null;
  show: boolean;
  motionKey: string;
  roundedClassName?: string;
}

export function FloatingListSlabLayer(props: FloatingListSlabLayerProps) {
  const { slab, show, motionKey, roundedClassName = 'rounded-sm' } = props;

  return (
    <AnimatePresence>
      {slab != null && show ? (
        <motion.div
          key={motionKey}
          className={cn(
            'pointer-events-none absolute z-10 transition-colors duration-200',
            roundedClassName,
            slabBackgroundClass(slab.variant)
          )}
          style={{
            insetInlineStart: slab.layout.insetInlineStart,
            width: slab.layout.width
          }}
          initial={false}
          animate={{
            top: slab.layout.top,
            height: slab.layout.height,
            opacity: 1
          }}
          exit={{ opacity: 0 }}
          transition={
            slab.instantTransition
              ? { duration: 0, ease: 'linear' }
              : SLAB_SPRING
          }
        />
      ) : null}
    </AnimatePresence>
  );
}
