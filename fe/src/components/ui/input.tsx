import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends ComponentProps<'input'> {
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
}

export function Input(props: InputProps) {
  const { className, prefixIcon, suffixIcon, ...inputProps } = props;
  const hasAdornment = !!prefixIcon || !!suffixIcon;

  if (!hasAdornment) {
    return (
      <input
        className={cn(
          'h-10 w-full rounded-lg border border-border-default bg-background-base px-app-sm text-base text-text-primary transition-colors duration-100 placeholder:text-text-tertiary hover:border-border-strong focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error',
          className
        )}
        {...inputProps}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex h-10 w-full items-center gap-2 rounded-lg border border-border-default bg-background-base px-app-sm text-base text-text-primary transition-colors duration-100 hover:border-border-strong focus-within:border-primary',
        className
      )}
    >
      {prefixIcon ? (
        <span className="flex shrink-0 items-center text-text-tertiary">
          {prefixIcon}
        </span>
      ) : null}
      <input
        className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        {...inputProps}
      />
      {suffixIcon ? (
        <span className="flex shrink-0 items-center text-text-tertiary">
          {suffixIcon}
        </span>
      ) : null}
    </div>
  );
}
