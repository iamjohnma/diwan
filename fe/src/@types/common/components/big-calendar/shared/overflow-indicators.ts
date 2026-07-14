import type { RefObject } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import type { TimeGridMinuteBounds } from '@/utils/common/big-calendar-segments';

interface ScrollAreaViewportState {
  scrollTop: number;
  viewportHeight: number;
  scrollLeft: number;
  viewportWidth: number;
}

export interface ColumnOverflowPropsHook {
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  eventsByColumnId: Map<string, TimeGridMinuteBounds[]>;
  earliestEventHour: number;
  headerOffset?: number;
  pixelsPerHour?: number;
  scrollState?: Pick<ScrollAreaViewportState, 'scrollTop' | 'viewportHeight'>;
}

export interface ColumnOverflowState {
  hasAnyAbove: boolean;
  hasAnyBelow: boolean;
}

export interface HorizontalColumnOverflowPropsHook {
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  doctors: Array<{ id: string }>;
  eventsByColumnId: Map<string, CalendarEvent[]>;
  columnWidth: number;
  stickyColumnWidth: number;
  isRtl: boolean;
  scrollState?: Pick<ScrollAreaViewportState, 'scrollLeft' | 'viewportWidth'>;
}

export interface HorizontalOverflowState {
  hasAnyLeft: boolean;
  hasAnyRight: boolean;
}
