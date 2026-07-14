import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Label(props: ComponentProps<'label'>) {
  const { className, ...labelProps } = props;

  return (
    <label
      className={cn(
        'flex select-none items-center gap-x-app-xs text-sm font-medium text-text-primary',
        className
      )}
      {...labelProps}
    />
  );
}
