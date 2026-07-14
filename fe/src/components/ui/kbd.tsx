import type { ComponentProps } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const kbdVariants = cva(
  'inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-0.5 text-xs font-medium text-text-secondary select-none',
  {
    variants: {
      variant: {
        default: 'bg-background-muted',
        outline:
          'border border-border-default bg-background-base text-text-tertiary'
      },
      size: {
        sm: 'h-5 min-w-5 px-0.5 text-xs',
        md: 'h-6 min-w-6 rounded-md px-1 text-xs'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm'
    }
  }
);

const KEY_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  enter: '↵',
  escape: 'Esc',
  delete: 'Del',
  backspace: '⌫',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  k: 'K'
};

interface KbdProps
  extends
    Omit<ComponentProps<'kbd'>, 'children'>,
    VariantProps<typeof kbdVariants> {
  keyId: string;
}

function getKeyDisplay(keyId: string): string {
  const normalized = keyId.toLowerCase();
  const mapped = KEY_LABELS[normalized];
  if (mapped) {
    return mapped;
  }

  if (normalized.length === 1) {
    return normalized.toUpperCase();
  }

  return keyId;
}

export function Kbd(props: KbdProps) {
  const { className, variant, size, keyId, ...kbdProps } = props;

  return (
    <kbd
      className={cn(kbdVariants({ variant, size }), className)}
      {...kbdProps}
    >
      {getKeyDisplay(keyId)}
    </kbd>
  );
}

export function KbdGroup(props: ComponentProps<'div'>) {
  const { className, ...groupProps } = props;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 ltr:flex-row rtl:flex-row-reverse',
        className
      )}
      {...groupProps}
    />
  );
}
