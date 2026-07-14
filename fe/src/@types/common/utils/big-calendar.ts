import type {
  CalendarDragType,
  CalendarEvent
} from '@/@types/common/big-calendar';

export type NavigationDirection = 'previous' | 'next';

export interface EventDateRange {
  start: Date;
  end: Date;
}

export type CalendarEventTimeLike = Pick<
  CalendarEvent,
  'startDate' | 'endDate'
>;

export type CalendarEventTimeLikeWithId = CalendarEventTimeLike &
  Pick<CalendarEvent, 'id'>;

export interface OverlapPosition {
  column: number;
  totalColumns: number;
}

export interface OverlapLayoutResult {
  positions: Map<CalendarEvent['id'], OverlapPosition>;
}

export interface ColumnDragTargetsInput {
  dragType: CalendarDragType | null;
  activeEvent: CalendarEvent | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizeDeltaMinutes: number;
  resizingTopEventId: CalendarEvent['id'] | null;
  resizeTopDeltaMinutes: number;
  visibleSegments: readonly Pick<CalendarEvent, 'id'>[];
}

export interface ColumnDragTargets {
  dragType: CalendarDragType | null;
  movingEventId: CalendarEvent['id'] | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizeDeltaMinutes: number;
  resizingTopEventId: CalendarEvent['id'] | null;
  resizeTopDeltaMinutes: number;
}

export interface OverlapLayoutEntry {
  event: CalendarEventTimeLikeWithId;
  index: number;
  start: Date;
  end: Date;
}
