import type * as React from 'react';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { Skeleton } from '@/components/ui/skeleton';
import {
  isImageSrcCached,
  markImageSrcLoaded,
  useCachedImageSrc
} from '@/hooks/common';
import { getContrastForeground } from '@/utils/common/apply-preferences';
import { cn } from '@/lib/utils';

const AVATAR_COLOR = 'bg-primary !text-primary-foreground';
const AVATAR_COLOR_SOFT = 'bg-primary/10 !text-primary ring-1 ring-primary/20';
const AVATAR_IMAGE_FALLBACK_DELAY_MS = 200;

function getAvatarColorFromName(_name: string): string {
  return AVATAR_COLOR;
}

function getAvatarColorSoftFromName(_name: string): string {
  return AVATAR_COLOR_SOFT;
}

function getInitialsFromName(name: string): string {
  if (!name || name.trim() === '') return '?';

  return name.trim().charAt(0).toUpperCase();
}

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      size: {
        xs: 'size-6',
        sm: 'size-8',
        md: 'size-10',
        lg: 'size-12',
        xl: 'size-14',
        '2xl': 'size-16',
        '3xl': 'size-18',
        '4xl': 'size-20'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

const avatarFallbackTextVariants = cva('font-medium', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg',
      '2xl': 'text-xl',
      '3xl': 'text-2xl',
      '4xl': 'text-3xl'
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

interface AvatarProps
  extends
    React.ComponentProps<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

function Avatar(props: AvatarProps) {
  const { className, size, ...rest } = props;

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size }), className)}
      {...rest}
    />
  );
}

function AvatarImage(
  props: React.ComponentProps<typeof AvatarPrimitive.Image>
) {
  const { className, onLoadingStatusChange, src, ...rest } = props;
  const resolvedSrc = useCachedImageSrc(src, {
    keepPreviousWhileLoading: true
  });
  if (!resolvedSrc) {
    return null;
  }

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      src={resolvedSrc}
      onLoadingStatusChange={(status) => {
        if (status === 'loaded') {
          markImageSrcLoaded(src ?? resolvedSrc);
        }

        onLoadingStatusChange?.(status);
      }}
      {...rest}
    />
  );
}

interface AvatarFallbackProps
  extends
    React.ComponentProps<typeof AvatarPrimitive.Fallback>,
    VariantProps<typeof avatarFallbackTextVariants> {
  colorClassName?: string;
  importantColor?: string;
}

function AvatarFallback(props: AvatarFallbackProps) {
  const { className, size, colorClassName, importantColor, style, ...rest } =
    props;
  const fallbackRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const fallback = fallbackRef.current;
    if (!fallback || !importantColor) {
      return;
    }

    fallback.style.setProperty('color', importantColor, 'important');

    return () => {
      fallback.style.removeProperty('color');
    };
  }, [importantColor, style]);

  return (
    <AvatarPrimitive.Fallback
      ref={fallbackRef}
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full',
        colorClassName || 'bg-muted text-muted-foreground',
        avatarFallbackTextVariants({ size }),
        className
      )}
      style={style}
      {...rest}
    />
  );
}

interface UserAvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  style?: React.CSSProperties;
  color?: string | null;
  showSkeletonWhileImageLoading?: boolean;
  /** Rendered instead of the name initial — for entities whose "name" is a phone number. */
  fallbackIcon?: React.ReactNode;

  variant?: 'default' | 'soft';
}

type AvatarImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

function resolveAvatarForeground(
  backgroundColor: string | undefined
): string | undefined {
  if (!backgroundColor) return undefined;

  return getContrastForeground(backgroundColor);
}

function resolveAvatarBackgroundColor(
  color: string | null | undefined
): string | undefined {
  const trimmed = color?.trim();

  return trimmed ? trimmed : undefined;
}

const UserAvatar = memo(function UserAvatar(props: UserAvatarProps) {
  const initials = getInitialsFromName(props.name);
  const avatarStateKey = props.imageUrl ?? 'no-image';
  const variant = props.variant ?? 'default';
  const [imageLoadingStatus, setImageLoadingStatus] =
    useState<AvatarImageLoadingStatus>(() => {
      if (!props.imageUrl) return 'error';

      return isImageSrcCached(props.imageUrl) ? 'loaded' : 'idle';
    });
  const colorClassName =
    variant === 'soft'
      ? getAvatarColorSoftFromName(props.name)
      : getAvatarColorFromName(props.name);
  const customBg =
    resolveAvatarBackgroundColor(props.color) ?? props.style?.backgroundColor;
  const dynamicForeground = resolveAvatarForeground(customBg);

  const avatarStyle = useMemo(() => {
    if (!customBg) return props.style;

    return {
      ...props.style,
      backgroundColor: customBg
    };
  }, [props.style, customBg]);

  const fallbackStyle = useMemo(() => {
    if (!dynamicForeground) return avatarStyle;

    return {
      ...avatarStyle,
      color: dynamicForeground
    };
  }, [avatarStyle, dynamicForeground]);

  useEffect(() => {
    if (!props.imageUrl) {
      setImageLoadingStatus('error');
    } else {
      setImageLoadingStatus(
        isImageSrcCached(props.imageUrl) ? 'loaded' : 'idle'
      );
    }
  }, [props.imageUrl]);

  const shouldShowImageSkeleton =
    !!props.showSkeletonWhileImageLoading &&
    !!props.imageUrl &&
    imageLoadingStatus !== 'loaded' &&
    imageLoadingStatus !== 'error';

  return (
    <Avatar
      key={avatarStateKey}
      size={props.size}
      className={props.className}
      style={avatarStyle}
    >
      {props.imageUrl && (
        <AvatarImage
          src={props.imageUrl}
          alt={props.name}
          loading="eager"
          decoding="sync"
          onLoadingStatusChange={(status) => {
            setImageLoadingStatus(status as AvatarImageLoadingStatus);
          }}
        />
      )}
      {shouldShowImageSkeleton ? (
        <Skeleton className="absolute inset-0 rounded-full" />
      ) : (
        <AvatarFallback
          size={props.size}
          colorClassName={dynamicForeground ? undefined : colorClassName}
          className={props.fallbackClassName}
          delayMs={
            props.imageUrl && imageLoadingStatus !== 'error'
              ? AVATAR_IMAGE_FALLBACK_DELAY_MS
              : undefined
          }
          importantColor={dynamicForeground}
          style={fallbackStyle}
        >
          {props.fallbackIcon ?? initials}
        </AvatarFallback>
      )}
    </Avatar>
  );
});

export { UserAvatar };
