import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface SeparatorProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
  containerClassName?: string;
}

export function Separator(props: SeparatorProps) {
  const { className, containerClassName, orientation, ...separatorProps } =
    props;
  const resolvedOrientation = orientation ?? 'horizontal';

  return (
    <div className={cn(containerClassName)}>
      <div
        className={cn(
          'shrink-0 bg-border-default',
          resolvedOrientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className
        )}
        {...separatorProps}
      />
    </div>
  );
}
