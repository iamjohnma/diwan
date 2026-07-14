import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Card(props: ComponentProps<'section'>) {
  const { className, ...cardProps } = props;

  return (
    <section
      className={cn(
        'rounded-xl border border-border-default bg-(--background-card) shadow-xs',
        className
      )}
      {...cardProps}
    />
  );
}

export function CardHeader(props: ComponentProps<'header'>) {
  const { className, ...headerProps } = props;

  return (
    <header
      className={cn('flex flex-col gap-y-app-xs p-app-lg pb-app-md', className)}
      {...headerProps}
    />
  );
}

export function CardTitle(props: ComponentProps<'h2'>) {
  const { className, ...titleProps } = props;

  return (
    <h2
      className={cn('text-xl text-text-primary', className)}
      {...titleProps}
    />
  );
}

export function CardDescription(props: ComponentProps<'p'>) {
  const { className, ...descriptionProps } = props;

  return (
    <p
      className={cn('text-sm text-text-secondary', className)}
      {...descriptionProps}
    />
  );
}

export function CardContent(props: ComponentProps<'div'>) {
  const { className, ...contentProps } = props;

  return <div className={cn('p-app-lg pt-0', className)} {...contentProps} />;
}
