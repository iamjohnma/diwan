import { type CSSProperties, type ReactNode } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';

interface EventBadgeStatusIconProps {
  event: CalendarEvent;
  /** The already-resolved status glyph (lock / check / clock / tooth). */
  icon: ReactNode;
  containerClassName: string;
  containerStyle?: CSSProperties;
  isDragging?: boolean;
}

/**
 * The little status box in the badge's top corner. It's inert for most states,
 * but when the visit is flagged late (the clock glyph) it doubles as a quick
 * "remove late mark" control â€” clicking it opens the unmark confirmation
 * dialog instead of making the user open the full appointment card.
 */
export function EventBadgeStatusIcon(props: EventBadgeStatusIconProps) {
  return (
    <div className={props.containerClassName} style={props.containerStyle}>
      {props.icon}
    </div>
  );
}
