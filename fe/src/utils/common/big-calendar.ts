import {
  type Locale,
  addDays,
  addMonths,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths
} from 'date-fns';
import type {
  CalendarCell,
  CalendarDragType,
  CalendarEvent,
  CalendarEventWithPosition,
  CalendarView,
  RangeDays,
  VisibleHours,
  WorkingHours
} from '@/@types/common/big-calendar';
import type {
  CalendarEventTimeLike,
  CalendarEventTimeLikeWithId,
  ColumnDragTargets,
  ColumnDragTargetsInput,
  EventDateRange,
  NavigationDirection,
  OverlapLayoutEntry,
  OverlapLayoutResult,
  OverlapPosition
} from '@/@types/common/utils/big-calendar';
import {
  DEFAULT_PIXELS_PER_HOUR,
  MINUTES_PER_SNAP
} from '@/constants/common/big-calendar';
import {
  createDateInTimeZone,
  getDateKeyFromDate,
  getDateKeyInTimeZone,
  getDatePartsInTimeZone,
  getTimePartsInTimeZone,
  getWeekdayIndexInTimeZone
} from '@/utils/common/time-zone';

export {
  CLICK_SLOT_MINUTES,
  CLICK_SLOTS_PER_HOUR,
  DEFAULT_PIXELS_PER_HOUR,
  DEFAULT_VISIBLE_HOURS,
  DEFAULT_WORKING_HOURS,
  MINUTES_PER_SNAP
} from '@/constants/common/big-calendar';

export const CALENDAR_VIEW_ORDER: readonly CalendarView[] = [
  'range',
  'month',
  'doctor'
];

export function getPixelsPerHour(zoom: number): number {
  return DEFAULT_PIXELS_PER_HOUR * zoom;
}
const MINUTES_PER_HOUR = 60;
const TOTAL_MONTH_CELLS = 42;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(
  year: number,
  month: number,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
): number {
  const day = new Date(year, month, 1).getDay();

  return (day - weekStartsOn + 7) % 7;
}

function getMinutesFromDate(date: Date): number {
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

function parseEventDateRange(event: CalendarEventTimeLike): EventDateRange {
  return {
    start: parseISO(event.startDate),
    end: parseISO(event.endDate)
  };
}

function compareEventStartAscending(
  a: CalendarEventTimeLike,
  b: CalendarEventTimeLike
): number {
  return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
}

function snapMinutes(value: number, mode: 'round' | 'ceil' | 'floor'): number {
  return Math[mode](value / MINUTES_PER_SNAP) * MINUTES_PER_SNAP;
}

function getSnappedVerticalDeltaMinutes(
  deltaY: number,
  date: Date,
  pixelsPerHour: number
): number {
  const originalMinutes = getMinutesFromDate(date);
  const rawDeltaMinutes = (deltaY / pixelsPerHour) * MINUTES_PER_HOUR;

  return (
    snapMinutes(originalMinutes + rawDeltaMinutes, 'round') - originalMinutes
  );
}

export function calculateSnappedMoveMinutes(
  deltaY: number,
  originalStartDate: Date,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR
): number {
  return getSnappedVerticalDeltaMinutes(
    deltaY,
    originalStartDate,
    pixelsPerHour
  );
}

export function calculateSnappedResizeMinutes(
  deltaY: number,
  originalEndDate: Date,
  originalStartDate: Date,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR
): number {
  const currentDuration = differenceInMinutes(
    originalEndDate,
    originalStartDate
  );

  return Math.max(
    MINUTES_PER_SNAP - currentDuration,
    getSnappedVerticalDeltaMinutes(deltaY, originalEndDate, pixelsPerHour)
  );
}

export function calculateSnappedResizeTopMinutes(
  deltaY: number,
  originalStartDate: Date,
  originalEndDate: Date,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR
): number {
  const currentDuration = differenceInMinutes(
    originalEndDate,
    originalStartDate
  );

  return Math.min(
    currentDuration - MINUTES_PER_SNAP,
    getSnappedVerticalDeltaMinutes(deltaY, originalStartDate, pixelsPerHour)
  );
}

export function rangeText(
  view: CalendarView,
  date: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
  locale?: Locale,
  rangeDays: RangeDays = 1
) {
  const formatString = locale?.code === 'ar' ? 'd MMM, yyyy' : 'MMM d, yyyy';
  let start: Date;
  let end: Date;

  switch (view) {
    case 'month':
      start = startOfMonth(date);
      end = endOfMonth(date);
      break;
    case 'range': {
      const rangeStart = getRangeStartDate(date, rangeDays, weekStartsOn);
      if (rangeDays === 1) {
        return format(rangeStart, formatString, { locale });
      }
      const rangeEnd = getRangeEndDate(rangeStart, rangeDays);
      start = rangeStart;
      end = rangeEnd;
      break;
    }
    case 'doctor':
      return format(startOfDay(date), formatString, { locale });
    default:
      return 'Error while formatting';
  }

  return `${format(start, formatString, { locale })} - ${format(end, formatString, { locale })}`;
}

export function navigateDate(
  date: Date,
  view: CalendarView,
  direction: NavigationDirection,
  rangeDays: RangeDays = 1
): Date {
  const dayOperation = direction === 'next' ? addDays : subDays;
  if (view === 'month') {
    const monthOperation = direction === 'next' ? addMonths : subMonths;

    return monthOperation(date, 1);
  }

  if (view === 'doctor') {
    return dayOperation(date, 1);
  }

  return dayOperation(date, rangeDays);
}

export function getRangeStartDate(
  date: Date,
  rangeDays: RangeDays,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
) {
  if (rangeDays === 1) {
    return startOfDay(date);
  }

  return startOfWeek(date, { weekStartsOn });
}

export function snapRawMinutes(deltaY: number, pixelsPerHour: number): number {
  const rawMinutes = (deltaY / pixelsPerHour) * 60;

  return Math.round(rawMinutes / MINUTES_PER_SNAP) * MINUTES_PER_SNAP;
}

export function readDragPayload(active: {
  data: { current?: Record<string, unknown> };
}) {
  const data = active.data.current;

  return {
    calendarEvent: data?.event as CalendarEvent | undefined,
    type: data?.type as CalendarDragType | undefined,
    getHeight: data?.getHeight as (() => number) | undefined
  };
}

/**
 * Resolves which drag/resize preview props a single time-grid column should
 * receive, based on whether the active drag targets an event visible in that
 * column. Shared by the doctor-view and range-view grid bodies.
 */
export function resolveColumnDragTargets(
  input: ColumnDragTargetsInput
): ColumnDragTargets {
  const hasSegment = (id: CalendarEvent['id'] | null) =>
    id !== null && input.visibleSegments.some((segment) => segment.id === id);

  const isMoveTarget =
    input.dragType === 'move' && hasSegment(input.activeEvent?.id ?? null);
  const isResizeTarget =
    input.dragType === 'resize' && hasSegment(input.resizingEventId);
  const isResizeTopTarget =
    input.dragType === 'resize-top' && hasSegment(input.resizingTopEventId);

  return {
    dragType: isMoveTarget
      ? 'move'
      : isResizeTarget
        ? 'resize'
        : isResizeTopTarget
          ? 'resize-top'
          : null,
    movingEventId: isMoveTarget ? (input.activeEvent?.id ?? null) : null,
    resizingEventId: isResizeTarget ? input.resizingEventId : null,
    resizeDeltaMinutes: isResizeTarget ? input.resizeDeltaMinutes : 0,
    resizingTopEventId: isResizeTopTarget ? input.resizingTopEventId : null,
    resizeTopDeltaMinutes: isResizeTopTarget ? input.resizeTopDeltaMinutes : 0
  };
}

function getRangeEndDate(rangeStart: Date, rangeDays: RangeDays) {
  return endOfDay(addDays(rangeStart, rangeDays - 1));
}

function getDateWindowStart(date: Date, timeZone?: string): Date {
  return timeZone
    ? createDateInTimeZone(
        {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: 0,
          minute: 0
        },
        timeZone
      )
    : startOfDay(date);
}

function getDateWindow(date: Date, days: number, timeZone?: string) {
  return {
    start: getDateWindowStart(date, timeZone),
    end: getDateWindowStart(addDays(date, days), timeZone)
  };
}

function doEntriesOverlap(a: OverlapLayoutEntry, b: OverlapLayoutEntry) {
  return doTimesOverlap(a.start, a.end, b.start, b.end);
}

export function calculateOverlapLayout(
  events: CalendarEventTimeLikeWithId[]
): OverlapLayoutResult {
  const positions = new Map<CalendarEvent['id'], OverlapPosition>();
  if (events.length === 0) {
    return { positions };
  }

  const entries = events.map((event, index) => {
    const { start, end } = parseEventDateRange(event);

    return {
      event,
      index,
      start,
      end
    };
  });

  const laneEntries: OverlapLayoutEntry[][] = [];

  for (const entry of entries) {
    let laneIndex = 0;
    while (true) {
      const lane = laneEntries[laneIndex];
      const conflicts =
        lane?.some((assignedEntry) => doEntriesOverlap(assignedEntry, entry)) ??
        false;
      if (!conflicts) {
        if (!lane) {
          laneEntries[laneIndex] = [entry];
        } else {
          lane.push(entry);
        }
        positions.set(entry.event.id, {
          column: laneIndex,
          totalColumns: 1
        });
        break;
      }

      laneIndex += 1;
    }
  }

  // Spread totalColumns across each cluster of transitively-overlapping
  // events so every event in a cluster shares the same column count.
  const visited = new Set<CalendarEvent['id']>();

  for (const entry of entries) {
    if (visited.has(entry.event.id)) {
      continue;
    }

    const stack = [entry];
    const clusterEntries: OverlapLayoutEntry[] = [];
    visited.add(entry.event.id);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      clusterEntries.push(current);

      for (const candidate of entries) {
        if (visited.has(candidate.event.id)) {
          continue;
        }
        if (!doEntriesOverlap(current, candidate)) {
          continue;
        }
        visited.add(candidate.event.id);
        stack.push(candidate);
      }
    }

    const totalColumns =
      clusterEntries.reduce(
        (max, clusterEntry) =>
          Math.max(max, positions.get(clusterEntry.event.id)?.column ?? 0),
        0
      ) + 1;

    clusterEntries.forEach((clusterEntry) => {
      const currentPosition = positions.get(clusterEntry.event.id);
      if (currentPosition) {
        currentPosition.totalColumns = totalColumns;
      }
    });
  }

  return { positions };
}

export function getOverlappingEventStyle(
  event: CalendarEventTimeLike,
  firstHour: number,
  position: OverlapPosition,
  timeZone?: string,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR
): {
  top: string;
  height: string;
  left: string;
  width: string;
} {
  const { start, end } = parseEventDateRange(event);
  const duration = differenceInMinutes(end, start);

  const { hour: startHour, minute: startMinute } = timeZone
    ? getTimePartsInTimeZone(start, timeZone)
    : { hour: start.getHours(), minute: start.getMinutes() };
  const startMinutes = startHour * MINUTES_PER_HOUR + startMinute;
  const firstHourMinutes = firstHour * MINUTES_PER_HOUR;
  const topMinutes = startMinutes - firstHourMinutes;

  const top = (topMinutes / MINUTES_PER_HOUR) * pixelsPerHour;
  const height = (duration / MINUTES_PER_HOUR) * pixelsPerHour;

  const width = 100 / position.totalColumns;
  const left = position.column * width;

  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `${left}%`,
    width: `${width}%`
  };
}

export function isWorkingHour(
  day: Date,
  hour: number,
  workingHours: WorkingHours,
  timeZone?: string
) {
  const dayIndex = (
    timeZone ? getWeekdayIndexInTimeZone(day, timeZone) : day.getDay()
  ) as keyof typeof workingHours;
  const dayHours = workingHours[dayIndex];
  if (!dayHours) return false;

  return hour >= dayHours.from && hour < dayHours.to;
}

export function getVisibleHours(
  visibleHours: VisibleHours,
  events: CalendarEvent[],
  timeZone?: string
) {
  let earliestEventHour = visibleHours.from;
  let latestEventHour = visibleHours.to;

  for (const event of events) {
    const { start: startDate, end: endTime } = parseEventDateRange(event);
    const spansMultipleDays =
      getDateKeyInTimeZone(startDate, timeZone) !==
      getDateKeyInTimeZone(endTime, timeZone);

    if (spansMultipleDays) {
      earliestEventHour = 0;
      latestEventHour = 24;
      continue;
    }

    const { hour: startHour } = timeZone
      ? getTimePartsInTimeZone(startDate, timeZone)
      : { hour: startDate.getHours() };
    const { hour: endHourBase, minute: endMinute } = timeZone
      ? getTimePartsInTimeZone(endTime, timeZone)
      : { hour: endTime.getHours(), minute: endTime.getMinutes() };

    const endHour = endHourBase + (endMinute > 0 ? 1 : 0);
    earliestEventHour = Math.min(earliestEventHour, startHour);
    latestEventHour = Math.max(latestEventHour, endHour);
  }

  latestEventHour = Math.min(latestEventHour, 24);

  const hours = Array.from(
    { length: latestEventHour - earliestEventHour },
    (_, i) => i + earliestEventHour
  );

  return { hours, earliestEventHour, latestEventHour };
}

export function getCalendarCells(
  selectedDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
): CalendarCell[] {
  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(
    currentYear,
    currentMonth,
    weekStartsOn
  );
  const daysInPrevMonth = getDaysInMonth(currentYear, currentMonth - 1);

  const prevMonthCells = Array.from({ length: firstDayOfMonth }, (_, i) => ({
    day: daysInPrevMonth - firstDayOfMonth + i + 1,
    currentMonth: false,
    date: new Date(
      currentYear,
      currentMonth - 1,
      daysInPrevMonth - firstDayOfMonth + i + 1
    )
  }));

  const currentMonthCells = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: true,
    date: new Date(currentYear, currentMonth, i + 1)
  }));

  const remainingCells =
    TOTAL_MONTH_CELLS - prevMonthCells.length - currentMonthCells.length;
  const nextMonthCells = Array.from({ length: remainingCells }, (_, i) => ({
    day: i + 1,
    currentMonth: false,
    date: new Date(currentYear, currentMonth + 1, i + 1)
  }));

  return [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];
}

export function getMonthCellEvents(
  date: Date,
  events: CalendarEvent[],
  timeZone?: string
): CalendarEventWithPosition[] {
  const dayKey = getDateKeyFromDate(date);

  return events
    .filter((event) => {
      const { start: eventStartDate } = parseEventDateRange(event);

      return getDateKeyInTimeZone(eventStartDate, timeZone) === dayKey;
    })
    .sort(compareEventStartAscending)
    .map((event, index) => ({
      ...event,
      position: index
    }));
}

export function filterEventsByView(
  events: CalendarEvent[],
  selectedDate: Date,
  selectedUserId: string | 'all',
  view: CalendarView,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
  rangeDays: RangeDays = 1,
  timeZone?: string
) {
  const selectedDateMonth = selectedDate.getMonth() + 1;
  const selectedDateYear = selectedDate.getFullYear();
  const rangeWindow =
    view === 'range'
      ? getDateWindow(
          getRangeStartDate(selectedDate, rangeDays, weekStartsOn),
          rangeDays,
          timeZone
        )
      : null;
  const doctorWindow =
    view === 'doctor' ? getDateWindow(selectedDate, 1, timeZone) : null;

  return events.filter((event) => {
    const { start: eventStartDate, end: eventEndDate } =
      parseEventDateRange(event);
    const isUserMatch =
      selectedUserId === 'all' || event.user.id === selectedUserId;
    if (!isUserMatch) {
      return false;
    }

    switch (view) {
      case 'month': {
        const eventParts = getDatePartsInTimeZone(eventStartDate, timeZone);

        return (
          eventParts.year === selectedDateYear &&
          eventParts.month === selectedDateMonth
        );
      }
      case 'range': {
        return !!(
          rangeWindow &&
          eventStartDate < rangeWindow.end &&
          eventEndDate > rangeWindow.start
        );
      }
      case 'doctor': {
        return !!(
          doctorWindow &&
          eventStartDate < doctorWindow.end &&
          eventEndDate > doctorWindow.start
        );
      }
      default:
        return false;
    }
  });
}

function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}
