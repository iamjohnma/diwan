'use client';

import { type ReactNode, useCallback, useState } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { type VariantProps, cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

const SIZE_TRANSITION = { type: 'spring', bounce: 0, duration: 0.25 } as const;
const CONTENT_TRANSITION = { duration: 0.15, ease: 'easeOut' } as const;

const TooltipCreateHandle = TooltipPrimitive.createHandle;

function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={0} {...props} />;
}

type TooltipRootProps = TooltipPrimitive.Root.Props & {
  allowTriggerPress?: boolean;
};

function Tooltip(props: TooltipRootProps) {
  const { allowTriggerPress, onOpenChange, ...rest } = props;

  return (
    <TooltipPrimitive.Root
      disableHoverablePopup
      {...rest}
      onOpenChange={(open, eventDetails) => {
        if (!allowTriggerPress && eventDetails.reason === 'trigger-press') {
          eventDetails.cancel();
        }
        onOpenChange?.(open, eventDetails);
      }}
    />
  );
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

const tooltipPopupVariants = cva(
  'relative flex h-(--popup-height,auto) w-(--popup-width,auto) origin-(--transform-origin) text-balance rounded-md border bg-clip-padding text-xs shadow-black/5 shadow-md transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-sm data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:duration-0',
  {
    variants: {
      variant: {
        default: 'bg-popover text-popover-foreground',
        info: 'border-primary/20 bg-primary-light text-primary',
        error: 'border-black/10 bg-[var(--error-bg)] text-[var(--error)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

interface AnimatedTooltipContentProps {
  contentKey: string | number | boolean;
  children: ReactNode;
}

function AnimatedTooltipContent(props: AnimatedTooltipContentProps) {
  const [width, setWidth] = useState<number | undefined>(undefined);

  const measureRef = useCallback((node: HTMLSpanElement | null) => {
    if (node) {
      setWidth(node.getBoundingClientRect().width);
    }
  }, []);

  return (
    <motion.div
      animate={width !== undefined ? { width } : undefined}
      initial={false}
      transition={SIZE_TRANSITION}
      className="relative min-h-5 overflow-clip"
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.span
          key={String(props.contentKey)}
          ref={measureRef}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={CONTENT_TRANSITION}
          className="absolute top-0 start-0 block w-max"
        >
          {props.children}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

function TooltipPopup(
  props: TooltipPrimitive.Popup.Props & {
    align?: TooltipPrimitive.Positioner.Props['align'];
    side?: TooltipPrimitive.Positioner.Props['side'];
    sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset'];
    collisionPadding?: TooltipPrimitive.Positioner.Props['collisionPadding'];
    contentKey?: string | number | boolean;
    positionerClassName?: string;
    viewportClassName?: string;
  } & VariantProps<typeof tooltipPopupVariants>
) {
  const {
    className,
    align = 'center',
    sideOffset = 4,
    side = 'top',
    collisionPadding = 16,
    variant,
    children,
    contentKey,
    positionerClassName,
    viewportClassName,
    ...popupProps
  } = props;

  const content =
    contentKey !== undefined ? (
      <AnimatedTooltipContent contentKey={contentKey}>
        {children}
      </AnimatedTooltipContent>
    ) : (
      children
    );

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        className={cn(
          'z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none',
          positionerClassName
        )}
        collisionPadding={collisionPadding}
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(tooltipPopupVariants({ variant }), className)}
          data-slot="tooltip-popup"
          {...popupProps}
        >
          <TooltipPrimitive.Viewport
            className={cn(
              'relative size-full overflow-clip px-(--viewport-inline-padding) py-1 [--viewport-inline-padding:--spacing(2)] data-instant:transition-none **:data-current:data-ending-style:opacity-0 **:data-current:data-starting-style:opacity-0 **:data-previous:data-ending-style:opacity-0 **:data-previous:data-starting-style:opacity-0 **:data-previous:w-[calc(var(--popup-width)-2*var(--viewport-inline-padding))] **:data-previous:truncate **:data-current:opacity-100 **:data-previous:opacity-100 **:data-current:transition-opacity **:data-previous:transition-opacity **:data-current:duration-200 **:data-previous:duration-150',
              viewportClassName
            )}
            data-slot="tooltip-viewport"
          >
            <div className="whitespace-normal break-words">{content}</div>
          </TooltipPrimitive.Viewport>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export {
  TooltipCreateHandle,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPopup
};
