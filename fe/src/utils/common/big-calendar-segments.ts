import { addDays, differenceInMinutes, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import type {
  CalendarDayWindow,
  CalendarEventRenderSegment
} from '@/@types/common/utils/big-calendar-segments';
import {
  createDateInTimeZone,
  getDateKeyFromDate,
  getDateKeyInTimeZone,
  getTimePartsInTimeZone
} from '@/utils/common/time-zone';

export type {
  CalendarDayWindow,
  CalendarEventRenderSegment,
  TimeGridMinuteBounds
} from '@/@types/common/utils/big-calendar-segments';

const MINUTES_PER_DAY = 24 * 60;

function clampMinuteBounds(value: number): number {
  if (Number.isNaN(value)) return 0;

  return Math.max(0, Math.min(MINUTES_PER_DAY, value));
}

function toMinutesWithinDay(
  date: Date,
  dayWindow: CalendarDayWindow,
  timeZone?: string
): number {
  if (date.getTime() === dayWindow.end.getTime()) {
    return MINUTES_PER_DAY;
  }

  const { hour, minute } = timeZone
    ? getTimePartsInTimeZone(date, timeZone)
    : { hour: date.getHours(), minute: date.getMinutes() };

  return clampMinuteBounds(hour * 60 + minute);
}

function buildDayWindow(date: Date, timeZone?: string): CalendarDayWindow {
  if (timeZone) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const start = createDateInTimeZone(
      { year, month, day, hour: 0, minute: 0 },
      timeZone
    );
    const nextDate = addDays(date, 1);
    const end = createDateInTimeZone(
      {
        year: nextDate.getFullYear(),
        month: nextDate.getMonth() + 1,
        day: nextDate.getDate(),
        hour: 0,
        minute: 0
      },
      timeZone
    );

    return {
      dayKey: getDateKeyInTimeZone(start, timeZone),
      start,
      end
    };
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 1);

  return {
    dayKey: getDateKeyFromDate(start),
    start,
    end
  };
}

export function buildDayWindowsForDates(
  dates: Date[],
  timeZone?: string
): CalendarDayWindow[] {
  return dates.map((date) => buildDayWindow(date, timeZone));
}

export function eventSpansMultipleDays(
  start: Date,
  end: Date,
  timeZone?: string
): boolean {
  return (
    getDateKeyInTimeZone(start, timeZone) !==
    getDateKeyInTimeZone(end, timeZone)
  );
}

/**
 * Positions a segment inside a percentage-based day column (the range view's
 * grid and its drop overlay), relative to the visible hour window.
 */
export function getSegmentPercentPosition(
  segment: { startMinutes: number; endMinutes: number },
  firstHour: number,
  lastHour: number
): { top: number; height: number } {
  const firstHourMinutes = firstHour * 60;
  const visibleRangeMinutes = (lastHour - firstHour) * 60;
  const topMinutes = segment.startMinutes - firstHourMinutes;
  const durationMinutes = segment.endMinutes - segment.startMinutes;

  return {
    top: (topMinutes / visibleRangeMinutes) * 100,
    height: (durationMinutes / visibleRangeMinutes) * 100
  };
}

export function buildEventRenderSegments(
  events: CalendarEvent[],
  dayWindows: CalendarDayWindow[],
  timeZone?: string,
  sourceEventById?: Map<CalendarEvent['id'], CalendarEvent>
): CalendarEventRenderSegment[] {
  if (events.length === 0 || dayWindows.length === 0) {
    return [];
  }

  const segments: CalendarEventRenderSegment[] = [];

  for (const event of events) {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);

    if (!(eventStart < eventEnd)) {
      continue;
    }

    const sourceEvent = sourceEventById?.get(event.id) ?? event;

    for (const dayWindow of dayWindows) {
      if (!(eventStart < dayWindow.end && eventEnd > dayWindow.start)) {
        continue;
      }

      const clippedStart =
        eventStart > dayWindow.start ? eventStart : dayWindow.start;
      const clippedEnd = eventEnd < dayWindow.end ? eventEnd : dayWindow.end;

      if (!(clippedStart < clippedEnd)) {
        continue;
      }

      const startMinutes = toMinutesWithinDay(
        clippedStart,
        dayWindow,
        timeZone
      );
      let endMinutes = toMinutesWithinDay(clippedEnd, dayWindow, timeZone);

      if (endMinutes <= startMinutes) {
        if (clippedEnd.getTime() === dayWindow.end.getTime()) {
          endMinutes = MINUTES_PER_DAY;
        } else {
          const fallbackEnd =
            clampMinuteBounds(
              differenceInMinutes(clippedEnd, dayWindow.start)
            ) || startMinutes + 1;
          endMinutes = Math.max(startMinutes + 1, fallbackEnd);
        }
      }

      const segmentKey = `${String(event.id)}:${dayWindow.dayKey}`;

      segments.push({
        id: sourceEvent.id,
        segmentKey,
        dragInstanceId: segmentKey,
        event: sourceEvent,
        startDate: clippedStart.toISOString(),
        endDate: clippedEnd.toISOString(),
        dayKey: dayWindow.dayKey,
        doctorId: event.dentistId,
        startMinutes,
        endMinutes,
        isStartSegment: clippedStart.getTime() === eventStart.getTime(),
        isEndSegment: clippedEnd.getTime() === eventEnd.getTime()
      });
    }
  }

  return segments;
}
