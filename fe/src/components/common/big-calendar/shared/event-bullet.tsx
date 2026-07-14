import { cva } from 'class-variance-authority';
import type { EventColor } from '@/@types/common/big-calendar';

const eventBulletVariants = cva('size-2 rounded-full', {
  variants: {
    color: {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      red: 'bg-red-600',
      yellow: 'bg-yellow-600',
      purple: 'bg-purple-600',
      gray: 'bg-neutral-600',
      orange: 'bg-orange-600'
    }
  },
  defaultVariants: {
    color: 'blue'
  }
});

interface EventBulletProps {
  color: EventColor;
  className?: string;
}

export function EventBullet(props: EventBulletProps) {
  return (
    <div
      className={eventBulletVariants({
        color: props.color,
        className: props.className
      })}
    />
  );
}
