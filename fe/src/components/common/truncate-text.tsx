import { useMemo } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import type { TruncateTextElement } from '@/@types/common/components/truncate-text';
import { useDirection } from '@/hooks/common';
import { useTruncateText } from '@/hooks/common';
import { cn } from '@/lib/utils';
import { getTextDirection } from '@/utils/common/text-direction';

function getTruncateAlignmentClass(documentDir: 'ltr' | 'rtl') {
  return documentDir === 'rtl' ? 'text-right' : 'text-left';
}

function resolveTruncateDirection(
  dir: string | undefined,
  children: ReactNode,
  documentDir: 'ltr' | 'rtl'
): 'ltr' | 'rtl' | undefined {
  if (dir === 'ltr' || dir === 'rtl') {
    return dir;
  }

  if (typeof children !== 'string') {
    return undefined;
  }

  const textDir = getTextDirection(children);

  return textDir === documentDir ? undefined : textDir;
}

type TruncateTextProps<T extends TruncateTextElement = 'span'> = Omit<
  ComponentPropsWithoutRef<T>,
  'children'
> & {
  children: ReactNode;
  as?: T;
  title?: string;
  // Lines the text may wrap onto before it clamps with an ellipsis. 1 (the
  // default) keeps the classic single-line truncate; higher values switch to a
  // line clamp with the same direction handling and overflow tooltip.
  lines?: number;
};

export function TruncateText<T extends TruncateTextElement = 'span'>(
  props: TruncateTextProps<T>
) {
  const { as, children, className, dir, title, lines, style, ...rest } = props;
  const Component = (as ?? 'span') as ElementType;
  const documentDir = useDirection();
  const truncateText = useTruncateText({
    children,
    title
  });
  const resolvedDir = useMemo(
    () => resolveTruncateDirection(dir, children, documentDir),
    [children, dir, documentDir]
  );
  const isMultiline = (lines ?? 1) > 1;

  return (
    <Component
      {...rest}
      ref={truncateText.elementRef}
      title={truncateText.title}
      dir={resolvedDir}
      className={cn(
        'block min-w-0 max-w-full',
        isMultiline ? 'whitespace-normal' : 'truncate',
        resolvedDir === 'ltr' && 'truncate-ltr',
        resolvedDir === 'rtl' && 'truncate-rtl',
        getTruncateAlignmentClass(documentDir),
        className
      )}
      // Inline clamp styles support any line count without depending on
      // Tailwind emitting a matching line-clamp-N utility.
      style={
        isMultiline
          ? {
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: lines,
              overflow: 'hidden',
              ...style
            }
          : style
      }
    >
      {children}
    </Component>
  );
}
