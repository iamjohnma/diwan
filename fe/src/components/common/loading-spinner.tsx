import type { RefAttributes } from 'react';
import { type IconProps, SpinnerIcon } from '@phosphor-icons/react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const loadingSpinnerVariants = cva('animate-spin', {
  variants: {
    color: {
      primary: 'text-primary',
      white: 'text-white',
      primaryForeground: 'text-primary-foreground',
      default: 'text-text-secondary',
      inherit: 'text-current'
    },
    size: {
      xxs: 'size-5',
      xs: 'size-5',
      sm: 'size-8',
      md: 'size-12',
      lg: 'size-16'
    },
    removePadding: {
      true: 'ms-0',
      false: 'ms-1'
    }
  },
  defaultVariants: {
    color: 'default',
    size: 'md'
  }
});

export type LoadingSpinnerProps = Omit<IconProps, 'ref'> &
  RefAttributes<SVGSVGElement> &
  VariantProps<typeof loadingSpinnerVariants>;

export function LoadingSpinner(props: LoadingSpinnerProps) {
  return (
    <SpinnerIcon
      className={cn(
        loadingSpinnerVariants({
          color: props.color,
          size: props.size,
          removePadding: props.removePadding ?? false
        }),
        props.className
      )}
      weight="regular"
    />
  );
}
