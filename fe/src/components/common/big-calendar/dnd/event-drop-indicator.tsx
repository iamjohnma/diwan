import { cn } from '@/utils/common/cn';

interface EventDropIndicatorProps {
  variant?: 'default' | 'flush';
  tone?: 'default' | 'collision';
}

export function EventDropIndicator(props: EventDropIndicatorProps) {
  const variant = props.variant ?? 'default';
  const tone = props.tone ?? 'default';
  const isFlush = variant === 'flush';
  const isCollision = tone === 'collision';

  return (
    <div
      className={cn(
        'pointer-events-none absolute h-full',
        isFlush ? 'inset-0' : 'inset-x-0 px-1'
      )}
    >
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-md border-2 border-dashed',
          isCollision
            ? 'border-destructive bg-destructive/10'
            : 'border-primary bg-transparent',
          !isFlush && 'mx-1'
        )}
      />
    </div>
  );
}
