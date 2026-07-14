import { useCallback, useRef, useState } from 'react';
import { useDndMonitor } from '@dnd-kit/core';
import { addDays, addMinutes, differenceInMinutes, parseISO } from 'date-fns';
import type {
  CalendarDragType,
  CalendarEvent,
  WorkingHours
} from '@/@types/common/big-calendar';
import type { RangeViewDndPropsHook } from '@/@types/common/components/big-calendar/views/range-view/calendar-range-view/use-range-view-dnd';
import { useSnapMinuteCalculators } from '@/hooks/common/big-calendar/drag-snap';
import { readDragPayload, snapRawMinutes } from '@/utils/common/big-calendar';
import { eventSpansMultipleDays } from '@/utils/common/big-calendar-segments';
import {
  getTimePartsInTimeZone,
  getWeekdayIndexInTimeZone
} from '@/utils/common/time-zone';

function getMinutesIntoDay(date: Date, timeZone: string): number {
  const parts = getTimePartsInTimeZone(date, timeZone);

  return parts.hour * 60 + parts.minute;
}

function getWorkingWindowMinutes(
  workingHours: WorkingHours,
  startDate: Date,
  timeZone: string,
  dayOffset = 0
): { start: number; end: number } | null {
  const weekday =
    (getWeekdayIndexInTimeZone(startDate, timeZone) + dayOffset + 7) % 7;
  const hours = workingHours[weekday];

  return hours ? { start: hours.from * 60, end: hours.to * 60 } : null;
}

export function useRangeViewDnd(props: RangeViewDndPropsHook) {
  const {
    pixelsPerHour,
    rangeDays,
    selectedTimeZone,
    workingHours,
    gridRef,
    direction
  } = props;

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [dragType, setDragType] = useState<CalendarDragType | null>(null);
  const snappedDeltaMinutesRef = useRef(0);
  const dayOffsetRef = useRef(0);
  const columnWidthRef = useRef(0);
  const isDraggingRef = useRef(false);

  const [resizingEventId, setResizingEventId] = useState<
    CalendarEvent['id'] | null
  >(null);
  const [resizeDeltaMinutes, setResizeDeltaMinutes] = useState(0);
  const [resizingTopEventId, setResizingTopEventId] = useState<
    CalendarEvent['id'] | null
  >(null);
  const [resizeTopDeltaMinutes, setResizeTopDeltaMinutes] = useState(0);

  const snap = useSnapMinuteCalculators(pixelsPerHour);

  const calculateSnappedMinutes = useCallback(
    (
      deltaY: number,
      event: CalendarEvent | null,
      targetDayOffset: number
    ): number => {
      if (!event) {
        return snapRawMinutes(deltaY, pixelsPerHour);
      }

      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);
      const snapped = snap.calculateMoveMinutes(deltaY, startDate);
      const eventDuration = differenceInMinutes(endDate, startDate);
      const proposedStart = addMinutes(
        addDays(startDate, targetDayOffset),
        snapped
      );
      const proposedEnd = addMinutes(proposedStart, eventDuration);

      if (
        eventSpansMultipleDays(startDate, endDate, selectedTimeZone) ||
        eventSpansMultipleDays(proposedStart, proposedEnd, selectedTimeZone)
      ) {
        return snapped;
      }

      const workingWindow = getWorkingWindowMinutes(
        workingHours,
        startDate,
        selectedTimeZone,
        targetDayOffset
      );
      if (!workingWindow) return snapped;

      const eventStartMinutes = getMinutesIntoDay(startDate, selectedTimeZone);
      const minOffset = workingWindow.start - eventStartMinutes;
      const maxOffset = workingWindow.end - (eventStartMinutes + eventDuration);

      return Math.max(minOffset, Math.min(maxOffset, snapped));
    },
    [workingHours, selectedTimeZone, pixelsPerHour, snap]
  );

  const calculateResizeMinutes = useCallback(
    (deltaY: number, event: CalendarEvent | null): number => {
      if (!event) {
        return snapRawMinutes(deltaY, pixelsPerHour);
      }

      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);
      const snapped = snap.calculateResizeMinutes(deltaY, event);

      if (
        eventSpansMultipleDays(startDate, endDate, selectedTimeZone) ||
        eventSpansMultipleDays(
          startDate,
          addMinutes(endDate, snapped),
          selectedTimeZone
        )
      ) {
        return snapped;
      }

      const workingWindow = getWorkingWindowMinutes(
        workingHours,
        startDate,
        selectedTimeZone
      );
      if (!workingWindow) return snapped;

      const maxResize =
        workingWindow.end - getMinutesIntoDay(endDate, selectedTimeZone);

      return Math.min(maxResize, snapped);
    },
    [workingHours, selectedTimeZone, pixelsPerHour, snap]
  );

  const calculateResizeTopMinutes = useCallback(
    (deltaY: number, event: CalendarEvent | null): number => {
      if (!event) {
        return snapRawMinutes(deltaY, pixelsPerHour);
      }

      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);
      const snapped = snap.calculateResizeTopMinutes(deltaY, event);

      if (
        eventSpansMultipleDays(startDate, endDate, selectedTimeZone) ||
        eventSpansMultipleDays(
          addMinutes(startDate, snapped),
          endDate,
          selectedTimeZone
        )
      ) {
        return snapped;
      }

      const workingWindow = getWorkingWindowMinutes(
        workingHours,
        startDate,
        selectedTimeZone
      );
      if (!workingWindow) return snapped;

      const minResize =
        workingWindow.start - getMinutesIntoDay(startDate, selectedTimeZone);

      return Math.max(minResize, snapped);
    },
    [workingHours, selectedTimeZone, pixelsPerHour, snap]
  );

  const calculateDayOffset = useCallback(
    (deltaX: number): number => {
      if (columnWidthRef.current === 0) return 0;
      const effectiveDeltaX = direction === 'rtl' ? -deltaX : deltaX;
      const offset = Math.round(effectiveDeltaX / columnWidthRef.current);

      return Math.max(-(rangeDays - 1), Math.min(rangeDays - 1, offset));
    },
    [direction, rangeDays]
  );

  const clearDragState = () => {
    isDraggingRef.current = false;
    setActiveEvent(null);
    setDragType(null);
    snappedDeltaMinutesRef.current = 0;
    dayOffsetRef.current = 0;
    setResizingEventId(null);
    setResizeDeltaMinutes(0);
    setResizingTopEventId(null);
    setResizeTopDeltaMinutes(0);
  };

  useDndMonitor({
    onDragStart(event) {
      const { calendarEvent, type } = readDragPayload(event.active);

      if (calendarEvent && type) {
        isDraggingRef.current = true;
        setDragType(type);
        if (type === 'move') {
          setActiveEvent(calendarEvent);
          snappedDeltaMinutesRef.current = 0;
          dayOffsetRef.current = 0;
          if (gridRef.current) {
            columnWidthRef.current = gridRef.current.offsetWidth / rangeDays;
          }
        } else if (type === 'resize') {
          setResizingEventId(calendarEvent.id);
          setResizeDeltaMinutes(0);
        } else if (type === 'resize-top') {
          setResizingTopEventId(calendarEvent.id);
          setResizeTopDeltaMinutes(0);
        }
      }
    },
    onDragMove(event) {
      const { calendarEvent, type } = readDragPayload(event.active);

      if (type === 'move' && calendarEvent) {
        const newDayOffset = calculateDayOffset(event.delta.x);
        snappedDeltaMinutesRef.current = calculateSnappedMinutes(
          event.delta.y,
          calendarEvent,
          newDayOffset
        );
        dayOffsetRef.current = newDayOffset;
      } else if (type === 'resize' && calendarEvent) {
        setResizeDeltaMinutes(
          calculateResizeMinutes(event.delta.y, calendarEvent)
        );
      } else if (type === 'resize-top' && calendarEvent) {
        setResizeTopDeltaMinutes(
          calculateResizeTopMinutes(event.delta.y, calendarEvent)
        );
      }
    },
    onDragEnd: clearDragState,
    onDragCancel: clearDragState
  });

  return {
    activeEvent,
    dragType,
    snappedDeltaMinutesRef,
    dayOffsetRef,
    isDraggingRef,
    resizingEventId,
    resizeDeltaMinutes,
    resizingTopEventId,
    resizeTopDeltaMinutes
  };
}
