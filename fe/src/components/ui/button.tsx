import { type ComponentProps, type ReactNode, isValidElement } from 'react';
import type { Icon, IconProps } from '@phosphor-icons/react';
import { type VariantProps, cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'motion/react';
import { LoadingSpinner } from '@/components/common';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'full-center relative flex cursor-pointer gap-x-app-sm rounded-lg border border-transparent font-medium outline-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-background-elevated active:bg-background-muted',
        outline:
          'border-border-default bg-background-base text-text-primary hover:bg-background-surface active:bg-background-elevated',
        ghost:
          'text-text-primary hover:bg-background-elevated active:bg-background-muted',
        destructive: 'bg-error text-text-inverted hover:opacity-90',
        link: 'justify-start w-fit gap-x-1 border-transparent bg-transparent hover:underline focus-visible:underline focus-visible:opacity-70 underline-offset-2',
        input:
          'w-full justify-start border-border-default bg-background-base text-text-tertiary shadow-none font-normal transition-[background-color,border-color,color,box-shadow] duration-[var(--motion-duration-surface)] ease-[var(--motion-ease-out)] hover:border-border-dark active:bg-background-elevated focus-visible:border-border-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-default/25'
      },
      size: {
        sm: 'h-8 px-app-sm text-sm',
        md: 'h-10 px-app-md text-sm',
        lg: 'h-11 px-app-md text-base',
        lgTall: 'h-10 px-4 py-2 text-sm',
        xl: 'h-11 px-4 py-2 text-sm',
        icon: 'size-10 p-0',
        link: 'h-auto p-0 text-sm'
      },
      layout: {
        default: '',
        full: 'w-full',
        grow: 'flex-1'
      }
    },
    compoundVariants: [
      {
        variant: 'input',
        className:
          '!h-10 !min-h-10 !px-0 !py-0 items-stretch !gap-x-0 overflow-hidden text-sm'
      }
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      layout: 'default'
    }
  }
);

const DEFAULT_ICON_PROPS: IconProps = {
  weight: 'duotone',
  className: 'size-5 shrink-0'
};

function renderIcon(icon: Icon | ReactNode, iconProps?: Partial<IconProps>) {
  if (isValidElement(icon)) {
    return icon;
  }

  if (typeof icon === 'function' || typeof icon === 'object') {
    const IconComponent = icon as Icon;

    return (
      <IconComponent
        {...DEFAULT_ICON_PROPS}
        {...iconProps}
        className={cn(DEFAULT_ICON_PROPS.className, iconProps?.className)}
      />
    );
  }

  return icon;
}

interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  /** Naab-compatible alias for `isLoading`. */
  loading?: boolean;
  prefixIcon?: Icon | ReactNode;
  prefixIconProps?: Partial<IconProps>;
  suffixIcon?: Icon | ReactNode;
  suffixIconProps?: Partial<IconProps>;
  inputSidebarExpanded?: boolean;
}

const INPUT_SIDEBAR_COLLAPSE_TRANSITION = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1]
} as const;

export function Button(props: ButtonProps) {
  const {
    className,
    variant,
    size,
    layout,
    isLoading,
    loading,
    disabled,
    children,
    type,
    prefixIcon,
    prefixIconProps,
    suffixIcon,
    suffixIconProps,
    inputSidebarExpanded,
    ...buttonProps
  } = props;

  const showLoading = isLoading ?? loading ?? false;
  const isInputVariant = variant === 'input';
  const inputSidebarCollapse =
    isInputVariant && inputSidebarExpanded !== undefined;

  const prefixContent = prefixIcon ? (
    isInputVariant ? (
      <span className="relative z-0 flex shrink-0 items-center ps-3 text-text-tertiary transition-none">
        <span className="relative flex size-4 shrink-0 items-center justify-center">
          {renderIcon(prefixIcon, prefixIconProps)}
        </span>
      </span>
    ) : (
      renderIcon(prefixIcon, prefixIconProps)
    )
  ) : null;

  const suffixContent = suffixIcon ? (
    isInputVariant ? (
      inputSidebarCollapse ? (
        <AnimatePresence initial={false}>
          {inputSidebarExpanded ? (
            <motion.span
              animate={{ opacity: 1 }}
              className="z-0 flex shrink-0 items-center pe-3 text-text-tertiary transition-none"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="input-suffix"
              transition={INPUT_SIDEBAR_COLLAPSE_TRANSITION}
            >
              {renderIcon(suffixIcon, suffixIconProps)}
            </motion.span>
          ) : null}
        </AnimatePresence>
      ) : (
        <span className="z-0 flex shrink-0 items-center pe-3 text-text-tertiary">
          {renderIcon(suffixIcon, suffixIconProps)}
        </span>
      )
    ) : (
      renderIcon(suffixIcon, suffixIconProps)
    )
  ) : null;

  return (
    <button
      className={cn(buttonVariants({ variant, size, layout }), className)}
      disabled={disabled ?? showLoading ?? false}
      type={type ?? 'button'}
      {...buttonProps}
    >
      {showLoading ? <LoadingSpinner size="xs" color="inherit" /> : null}
      {prefixContent}
      {isInputVariant ? (
        <span
          className={cn(
            'min-w-0 flex-1 self-center truncate',
            prefixIcon ? 'ps-2 pe-3' : 'px-3',
            inputSidebarCollapse &&
              'transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            inputSidebarCollapse &&
              (inputSidebarExpanded ? 'opacity-100' : 'opacity-0')
          )}
        >
          {children}
        </span>
      ) : (
        children
      )}
      {suffixContent}
    </button>
  );
}
