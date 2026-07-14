import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton(props: ComponentProps<'div'>) {
  const { className, ...skeletonProps } = props;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-background-elevated',
        className
      )}
      {...skeletonProps}
    />
  );
}
