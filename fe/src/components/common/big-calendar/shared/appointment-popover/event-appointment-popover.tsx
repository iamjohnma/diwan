import type { ReactNode } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';

interface EventAppointmentPopoverProps {
  children: ReactNode;
  event: CalendarEvent;
  isDragging: boolean;
}

export function EventAppointmentPopover(props: EventAppointmentPopoverProps) {
  return <>{props.children}</>;
}
