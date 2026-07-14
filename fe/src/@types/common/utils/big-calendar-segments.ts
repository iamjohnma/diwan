import type { CalendarEvent } from '@/@types/common/big-calendar';

export interface CalendarDayWindow {
  dayKey: string;
  start: Date;
  end: Date;
}

export interface TimeGridMinuteBounds {
  startMinutes: number;
  endMinutes: number;
}

export interface CalendarEventRenderSegment extends TimeGridMinuteBounds {
  id: CalendarEvent['id'];
  segmentKey: string;
  dragInstanceId: string;
  event: CalendarEvent;
  startDate: string;
  endDate: string;
  dayKey: string;
  doctorId?: string;
  isStartSegment: boolean;
  isEndSegment: boolean;
}
