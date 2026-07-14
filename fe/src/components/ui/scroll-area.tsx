import type * as React from 'react';
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { useDirection } from '@/hooks/common/direction';
import { cn } from '@/utils/common/cn';

interface ScrollAreaProps extends React.ComponentProps<
  typeof ScrollAreaPrimitive.Root
> {
  hideScrollbar?: boolean;
}

function ScrollArea(props: ScrollAreaProps) {
  const { className, children, hideScrollbar = false, ...rootProps } = props;
  const direction = useDirection();

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      dir={direction}
      className={cn('relative overflow-hidden', className)}
      {...rootProps}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="h-full w-full rounded-[inherit] overscroll-contain outline-none focus-visible:ring-1 focus-visible:ring-border-default"
        style={{ direction }}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar
        className={hideScrollbar ? 'pointer-events-none opacity-0' : undefined}
      />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar(
  props: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
) {
  const { className, orientation = 'vertical', ...scrollbarProps } = props;

  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' &&
          'h-full w-2.5 border-s border-s-transparent',
        orientation === 'horizontal' &&
          'h-2.5 flex-col border-t border-t-transparent',
        className
      )}
      {...scrollbarProps}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border-default"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
