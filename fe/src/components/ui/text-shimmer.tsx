import {
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  memo
} from 'react';
import { cn } from '@/lib/utils';
import { clamp } from '@/utils/common/math';

type TextShimmerProps = {
  as?: ElementType;
  active?: boolean;
  duration?: number;
  spread?: number;
  reverse?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

function TextShimmerInner(props: TextShimmerProps) {
  const {
    as: Component = 'span',
    active = true,
    className,
    duration = 2.5,
    spread = 24,
    reverse = false,
    children,
    style,
    ...rest
  } = props;

  if (!active) {
    return (
      <Component
        className={cn(
          'inline font-medium leading-relaxed text-text-secondary',
          className
        )}
        style={style}
        {...rest}
      >
        {children}
      </Component>
    );
  }

  const dynamicSpread = clamp(spread, 8, 45);
  const shimmerStyle = {
    ...style,
    '--shimmer-duration': `${duration}s`,
    '--shimmer-bg-size': `${220 + dynamicSpread * 2}%`,
    color: 'transparent',
    WebkitTextFillColor: 'transparent'
  } as CSSProperties;

  return (
    <Component
      className={cn(
        'inline font-medium leading-relaxed',
        reverse ? 'text-shimmer-reverse' : 'text-shimmer',
        className
      )}
      style={shimmerStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

export const TextShimmer = memo(TextShimmerInner);
