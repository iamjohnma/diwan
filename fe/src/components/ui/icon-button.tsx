import * as React from 'react';
import type { Icon, IconProps } from '@phosphor-icons/react';
import { type VariantProps, cva } from 'class-variance-authority';
import {
  DynamicTooltipProvider,
  type DynamicTooltipProviderProps,
  DynamicTooltipTrigger,
  type DynamicTooltipVariant,
  useOptionalDynamicTooltipHandleContext
} from '@/components/common';
import {
  LoadingSpinner,
  type LoadingSpinnerProps
} from '@/components/common';
import {
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { TOOLTIP_HOVER_OPEN_DELAY_MS } from '@/constants/common/tooltip';
import { cn } from '@/lib/utils';
import { hapticFromPointerEvent } from '@/utils/common/haptics';

const iconButtonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent outline-none cursor-pointer transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-100 ease-[var(--motion-ease-out)] overflow-hidden focus-visible:ring-0.4',
  {
    variants: {
      variant: {
        default:
          'bg-background-base hover:bg-background-surface active:bg-background-elevated focus-visible:ring-border-default/50',
        primary:
          'text-primary-foreground hover:bg-primary-hover active:bg-primary-active bg-primary focus-visible:bg-primary/70 border-transparent',
        secondary:
          'text-secondary-foreground active:bg-secondary-active hover:bg-secondary-hover bg-secondary focus-visible:bg-secondary/70 border-secondary',
        outline:
          'bg-background-base border-border-default active:bg-background-elevated hover:bg-background-surface',
        ghost:
          'hover:text-secondary-foreground hover:bg-secondary active:bg-secondary-active focus-visible:bg-secondary',
        destructive:
          'text-white bg-destructive border-destructive hover:bg-destructive/90 focus-visible:ring-destructive/50',
        success:
          'text-success bg-success/8 border-success/22 hover:border-success/32 hover:bg-success/12 active:bg-success/12 focus-visible:ring-success/20',
        lightDestructive:
          'text-destructive bg-destructive/10 hover:bg-destructive/15 active:bg-destructive/15 focus-visible:ring-destructive/30',
        emptyDestructive:
          'text-destructive hover:bg-destructive/10 active:bg-destructive/15 focus-visible:ring-destructive/30',
        pagination:
          'text-text-secondary hover:bg-background-elevated bg-background-surface border-border-default',
        paginationActive:
          'text-primary bg-secondary hover:bg-secondary-hover border-primary/30'
      },
      size: {
        equal: 'size-9 p-0 text-sm',
        iconXs: 'size-7 p-0 text-xs',
        iconSm: 'size-8 p-0 text-sm',
        iconMd: 'size-10 p-0 text-sm',
        iconLg: 'size-10 p-0 text-sm',
        iconMdResponsive: 'size-9 md:size-10 p-0 text-sm'
      },
      disabled: {
        true: 'opacity-50 pointer-events-none'
      },
      roundness: {
        default: 'rounded-lg',
        full: 'rounded-full'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'iconMd',
      roundness: 'default'
    }
  }
);

const DEFAULT_ICON_PROPS: IconProps = {
  weight: 'regular',
  className: 'size-5 shrink-0'
};

function renderIcon(
  icon: Icon | React.ReactNode,
  iconProps?: Partial<IconProps>
) {
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (typeof icon === 'function' || typeof icon === 'object') {
    return React.createElement(icon as Icon, {
      ...DEFAULT_ICON_PROPS,
      ...iconProps,
      className: cn(DEFAULT_ICON_PROPS.className, iconProps?.className)
    });
  }

  return icon;
}

export type IconButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof iconButtonVariants> & {
    icon?: Icon | React.ReactNode;
    iconProps?: Partial<IconProps>;
    tooltip?: React.ReactNode;
    tooltipVariant?: DynamicTooltipVariant;
    tooltipContentProps?: Omit<
      React.ComponentProps<typeof TooltipPopup>,
      'children'
    >;
    loading?: boolean;
    loadingProps?: Partial<LoadingSpinnerProps>;

    suppressDefaultHaptic?: boolean;

    tooltipAllowTriggerPress?: boolean;
  };

type IconButtonTooltipGroupProps = DynamicTooltipProviderProps;

function IconButton(props: IconButtonProps) {
  const {
    icon,
    iconProps,
    tooltip,
    tooltipVariant,
    tooltipContentProps,
    className,
    variant,
    size,
    roundness,
    disabled,
    loading,
    loadingProps,
    suppressDefaultHaptic = false,
    tooltipAllowTriggerPress = false,
    children,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    ...buttonProps
  } = props;

  const tooltipHandleRef = React.useRef<ReturnType<
    typeof TooltipCreateHandle
  > | null>(null);
  if (tooltipHandleRef.current === null) {
    tooltipHandleRef.current = TooltipCreateHandle();
  }
  const optionalDynamicTooltipHandleContext =
    useOptionalDynamicTooltipHandleContext();
  const tooltipTriggerId = React.useId().replace(/:/g, '');
  const touchTooltipHoldTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const openedByTouchLongPressRef = React.useRef(false);

  const clearTouchTooltipHold = React.useCallback(() => {
    if (touchTooltipHoldTimerRef.current != null) {
      clearTimeout(touchTooltipHoldTimerRef.current);
      touchTooltipHoldTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearTouchTooltipHold();
    };
  }, [clearTouchTooltipHold]);

  const {
    className: loadingClassName,
    color: loadingColor,
    ...restLoadingProps
  } = loadingProps ?? {};

  const spinnerColorByVariant =
    variant === 'primary'
      ? 'primaryForeground'
      : variant === 'destructive'
        ? 'white'
        : 'default';
  const resolvedSpinnerColor = loadingColor ?? spinnerColorByVariant;

  const iconNode =
    icon !== undefined ? renderIcon(icon, iconProps) : (children ?? null);
  const useOverlayTooltip =
    tooltip != null &&
    tooltip !== false &&
    !(typeof tooltip === 'string' && tooltip.length === 0);
  const useSharedTooltip =
    useOverlayTooltip && optionalDynamicTooltipHandleContext != null;

  const tooltipHandle = tooltipHandleRef.current;
  const activeTooltipHandle =
    optionalDynamicTooltipHandleContext ?? tooltipHandle;

  const button = (
    <button
      {...buttonProps}
      data-slot="icon-button"
      data-loading={loading ? '' : undefined}
      className={cn(
        iconButtonVariants({
          variant,
          size,
          roundness,
          disabled: disabled || loading
        }),
        variant === 'success' &&
          'border-transparent hover:border-transparent active:border-transparent',
        className
      )}
      disabled={disabled || loading}
      onPointerDown={(event) => {
        if (suppressDefaultHaptic) {
          onPointerDown?.(event);
        }
        if (useOverlayTooltip && event.pointerType !== 'touch') {
          clearTouchTooltipHold();
          activeTooltipHandle.close();
        }
        if (
          useOverlayTooltip &&
          event.pointerType === 'touch' &&
          !(disabled || loading)
        ) {
          clearTouchTooltipHold();
          openedByTouchLongPressRef.current = false;
          touchTooltipHoldTimerRef.current = setTimeout(() => {
            touchTooltipHoldTimerRef.current = null;
            openedByTouchLongPressRef.current = true;
            activeTooltipHandle.open(tooltipTriggerId);
          }, TOOLTIP_HOVER_OPEN_DELAY_MS);
        }
        if (!suppressDefaultHaptic) {
          onPointerDown?.(event);
        }
        if (
          event.defaultPrevented ||
          disabled ||
          loading ||
          suppressDefaultHaptic
        ) {
          return;
        }
        hapticFromPointerEvent(event);
      }}
      onPointerUp={(event) => {
        if (useOverlayTooltip && event.pointerType === 'touch') {
          clearTouchTooltipHold();
          if (openedByTouchLongPressRef.current) {
            openedByTouchLongPressRef.current = false;
            activeTooltipHandle.close();
          }
        }
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        if (useOverlayTooltip && event.pointerType === 'touch') {
          clearTouchTooltipHold();
          if (openedByTouchLongPressRef.current) {
            openedByTouchLongPressRef.current = false;
            activeTooltipHandle.close();
          }
        }
        onPointerCancel?.(event);
      }}
    >
      {loading ? (
        <LoadingSpinner
          className={cn('size-5', loadingClassName)}
          color={resolvedSpinnerColor}
          size="xxs"
          removePadding
          {...restLoadingProps}
        />
      ) : (
        iconNode
      )}
    </button>
  );

  if (!useOverlayTooltip) {
    return button;
  }

  if (useSharedTooltip) {
    return (
      <DynamicTooltipTrigger
        disabled={disabled || loading}
        id={tooltipTriggerId}
        label={tooltip}
        render={button}
        variant={tooltipVariant}
      />
    );
  }

  return (
    <TooltipProvider delay={TOOLTIP_HOVER_OPEN_DELAY_MS} timeout={0}>
      <Tooltip
        allowTriggerPress={tooltipAllowTriggerPress}
        handle={tooltipHandle}
      >
        <TooltipTrigger
          delay={TOOLTIP_HOVER_OPEN_DELAY_MS}
          handle={tooltipHandle}
          id={tooltipTriggerId}
          render={button}
        />
        <TooltipPopup variant={tooltipVariant} {...tooltipContentProps}>
          {tooltip}
        </TooltipPopup>
      </Tooltip>
    </TooltipProvider>
  );
}

function IconButtonTooltipGroup(props: IconButtonTooltipGroupProps) {
  return (
    <DynamicTooltipProvider
      {...props}
      align={props.align ?? 'center'}
      motionAxis={props.motionAxis ?? 'horizontal'}
      openDelay={props.openDelay ?? TOOLTIP_HOVER_OPEN_DELAY_MS}
      side={props.side ?? 'top'}
      sideOffset={props.sideOffset ?? 4}
    />
  );
}

export { IconButton, IconButtonTooltipGroup, iconButtonVariants };
