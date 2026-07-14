import { memo, useCallback, useMemo, useRef } from 'react';
import { addDays } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { CalendarTimeGutter } from '@/components/common/big-calendar/shared/calendar-time-gutter';
import { CalendarTimeline } from '@/components/common/big-calendar/shared/calendar-timeline';
import { useColumnOverflow } from '@/components/common/big-calendar/shared/overflow-indicators';
import { VerticalScrollHints } from '@/components/common/big-calendar/shared/scroll-hints';
import { applyResizePreviewToEvents } from '@/components/common/big-calendar/shared/time-slot-grid';
import { RangeViewCompactNotice } from '@/components/common/big-calendar/views/range-view/calendar-range-view/range-view-compact-notice';
import { RangeViewGridBody } from '@/components/common/big-calendar/views/range-view/calendar-range-view/range-view-grid-body';
import { RangeViewHeader } from '@/components/common/big-calendar/views/range-view/calendar-range-view/range-view-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRangeViewDnd } from '@/hooks/common/big-calendar/range-view-dnd';
import {
  getForcedEventIds,
  useTimeGridSegments
} from '@/hooks/common/big-calendar/time-grid-segments';
import { useCalendarViewportScrollState } from '@/hooks/common/big-calendar/use-calendar-viewport-scroll-state';
import { useScrollToNow } from '@/hooks/common/big-calendar/use-scroll-to-now';
import { useTranslation } from 'react-i18next';
import {
  getRangeStartDate,
  getVisibleHours
} from '@/utils/common/big-calendar';
import type { CalendarEventRenderSegment } from '@/utils/common/big-calendar-segments';
import { buildDayWindowsForDates } from '@/utils/common/big-calendar-segments';
import {
  EVENT_WINDOW_OVERSCAN_MINUTES,
  getVisibleMinuteWindow
} from '@/utils/common/big-calendar-virtualization';
import { cn } from '@/utils/common/cn';
import {
  createDateInTimeZone,
  getDateKeyInTimeZone
} from '@/utils/common/time-zone';

const EMPTY_SEGMENTS_BY_DAY_KEY = new Map<
  string,
  CalendarEventRenderSegment[]
>();

function CalendarRangeViewInner() {
  const { i18n } = useTranslation();
  const calendar = useCalendarContext();
  const locale = i18n.language === 'ar' ? ar : enUS;
  const selectedTimeZone = calendar.timeZone;
  const onTimeSlotPress = calendar.onTimeSlotPress;
  const onTimeSlotRangeSelect = calendar.onTimeSlotRangeSelect;
  const pixelsPerHour = calendar.pixelsPerHour;
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const dnd = useRangeViewDnd({
    pixelsPerHour,
    rangeDays: calendar.rangeDays,
    selectedTimeZone,
    workingHours: calendar.workingHours,
    gridRef,
    direction: i18n.dir()
  });

  const { viewportElement, scrollState } = useCalendarViewportScrollState({
    scrollAreaRef,
    isDraggingRef: dnd.isDraggingRef
  });

  const todayKey = useMemo(
    () => getDateKeyInTimeZone(new Date(), selectedTimeZone),
    [selectedTimeZone]
  );

  const { hours, earliestEventHour, latestEventHour } = useMemo(
    () =>
      getVisibleHours(
        calendar.visibleHours,
        calendar.filteredEvents,
        selectedTimeZone
      ),
    [calendar.visibleHours, calendar.filteredEvents, selectedTimeZone]
  );

  const rangeStart = getRangeStartDate(
    calendar.selectedDate,
    calendar.rangeDays,
    calendar.weekStartsOn
  );

  const rangeDates = useMemo(
    () =>
      Array.from({ length: calendar.rangeDays }, (_, i) =>
        addDays(rangeStart, i)
      ),
    [calendar.rangeDays, rangeStart]
  );

  const rangeDayWindows = useMemo(
    () => buildDayWindowsForDates(rangeDates, selectedTimeZone),
    [rangeDates, selectedTimeZone]
  );

  const rangeDateKeys = useMemo(
    () => rangeDayWindows.map((dayWindow) => dayWindow.dayKey),
    [rangeDayWindows]
  );

  const rangeTimelineDays = useMemo(
    () =>
      rangeDates.map((day) => {
        return createDateInTimeZone(
          {
            year: day.getFullYear(),
            month: day.getMonth() + 1,
            day: day.getDate(),
            hour: 12,
            minute: 0
          },
          selectedTimeZone
        );
      }),
    [rangeDates, selectedTimeZone]
  );

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${calendar.rangeDays}, minmax(0, 1fr))`
    }),
    [calendar.rangeDays]
  );

  const viewClassName =
    calendar.classNames?.rangeView ??
    (calendar.rangeDays === 1
      ? calendar.classNames?.dayView
      : calendar.classNames?.weekView);

  const showCompactNotice = calendar.rangeDays > 1;

  const handleTimeSlotClick = useCallback(
    (day: Date, hour: number, minute: number) => {
      const selectedInstant = createDateInTimeZone(
        {
          year: day.getFullYear(),
          month: day.getMonth() + 1,
          day: day.getDate(),
          hour,
          minute
        },
        selectedTimeZone
      );

      onTimeSlotPress?.(
        selectedInstant,
        selectedInstant.getHours(),
        selectedInstant.getMinutes()
      );
    },
    [onTimeSlotPress, selectedTimeZone]
  );

  const handleTimeSlotRangeSelect = useCallback(
    (day: Date, startMinute: number, endMinute: number) => {
      const startHour = Math.floor(startMinute / 60);
      const startMin = startMinute % 60;
      const endHour = Math.floor(endMinute / 60);
      const endMin = endMinute % 60;
      const startDate = createDateInTimeZone(
        {
          year: day.getFullYear(),
          month: day.getMonth() + 1,
          day: day.getDate(),
          hour: startHour,
          minute: startMin
        },
        selectedTimeZone
      );

      const endDate = createDateInTimeZone(
        {
          year: day.getFullYear(),
          month: day.getMonth() + 1,
          day: day.getDate(),
          hour: endHour,
          minute: endMin
        },
        selectedTimeZone
      );

      onTimeSlotRangeSelect?.(startDate, endDate);
    },
    [onTimeSlotRangeSelect, selectedTimeZone]
  );

  const totalRowsHeight = hours.length * pixelsPerHour;

  const visibleMinuteWindow = useMemo(() => {
    return getVisibleMinuteWindow(
      scrollState.scrollTop,
      scrollState.viewportHeight,
      earliestEventHour,
      EVENT_WINDOW_OVERSCAN_MINUTES,
      pixelsPerHour
    );
  }, [
    earliestEventHour,
    scrollState.scrollTop,
    scrollState.viewportHeight,
    pixelsPerHour
  ]);

  const sourceEventById = useMemo(
    () =>
      new Map(
        calendar.filteredEvents.map((event) => [event.id, event] as const)
      ),
    [calendar.filteredEvents]
  );

  const previewEvents = useMemo(
    () => applyResizePreviewToEvents(calendar.filteredEvents, dnd),
    [
      calendar.filteredEvents,
      dnd.dragType,
      dnd.resizeDeltaMinutes,
      dnd.resizeTopDeltaMinutes,
      dnd.resizingEventId,
      dnd.resizingTopEventId
    ]
  );

  const forcedEventIds = useMemo(
    () =>
      getForcedEventIds({
        activeEvent: dnd.activeEvent,
        resizingEventId: dnd.resizingEventId,
        resizingTopEventId: dnd.resizingTopEventId
      }),
    [dnd.activeEvent, dnd.resizingEventId, dnd.resizingTopEventId]
  );

  const getDayGroupKey = useCallback(
    (segment: CalendarEventRenderSegment) => segment.dayKey,
    []
  );

  const {
    segmentsByKey: segmentsByDayKey,
    stableVisibleSegmentsByKey: stableVisibleSegmentsByDayKey,
    hasFirstPainted
  } = useTimeGridSegments({
    previewEvents,
    dayWindows: rangeDayWindows,
    timeZone: selectedTimeZone,
    sourceEventById,
    getGroupKey: getDayGroupKey,
    visibleMinuteWindow,
    isZooming: calendar.isZooming,
    forcedEventIds
  });

  useScrollToNow({
    viewportElement,
    selectedTimeZone,
    earliestEventHour,
    pixelsPerHour,
    totalRowsHeight
  });

  const { hasAnyAbove, hasAnyBelow } = useColumnOverflow({
    scrollAreaRef,
    eventsByColumnId: segmentsByDayKey,
    earliestEventHour,
    pixelsPerHour
  });

  const segmentsForGrid = hasFirstPainted
    ? stableVisibleSegmentsByDayKey
    : EMPTY_SEGMENTS_BY_DAY_KEY;

  return (
    <>
      {showCompactNotice && <RangeViewCompactNotice />}
      <div
        className={cn(
          showCompactNotice
            ? 'hidden h-full min-h-0 flex-col overflow-hidden sm:flex'
            : 'flex h-full min-h-0 flex-col overflow-hidden',
          viewClassName
        )}
      >
        <RangeViewHeader
          rangeDates={rangeDates}
          rangeDateKeys={rangeDateKeys}
          todayKey={todayKey}
          gridStyle={gridStyle}
          locale={locale}
          timeZone={calendar.timeZone}
          onTimeZoneChange={calendar.setTimeZone}
        />
        <div className="relative flex-1 min-h-0">
          <ScrollArea ref={scrollAreaRef} className="h-full" type="always">
            <div className="flex flex-col">
              <div
                className="relative flex overflow-hidden [--calendar-time-gutter-width:60px] md:[--calendar-time-gutter-width:72px]"
                data-calendar-zoom-content
              >
                <CalendarTimeGutter
                  variant="range"
                  hours={hours}
                  pixelsPerHour={pixelsPerHour}
                  totalRowsHeight={totalRowsHeight}
                  locale={locale}
                />
                <RangeViewGridBody
                  gridRef={gridRef}
                  gridStyle={gridStyle}
                  totalRowsHeight={totalRowsHeight}
                  rangeDates={rangeDates}
                  rangeDateKeys={rangeDateKeys}
                  rangeTimelineDays={rangeTimelineDays}
                  rangeDayWindows={rangeDayWindows}
                  segmentsByDayKey={segmentsByDayKey}
                  stableVisibleSegmentsByDayKey={segmentsForGrid}
                  hours={hours}
                  earliestEventHour={earliestEventHour}
                  latestEventHour={latestEventHour}
                  pixelsPerHour={pixelsPerHour}
                  selectedTimeZone={selectedTimeZone}
                  workingHours={calendar.workingHours}
                  patientsCount={calendar.patientsCount ?? 0}
                  disableDragDrop={calendar.disableDragDrop ?? false}
                  activeEvent={dnd.activeEvent}
                  dragType={dnd.dragType}
                  resizingEventId={dnd.resizingEventId}
                  resizeDeltaMinutes={dnd.resizeDeltaMinutes}
                  resizingTopEventId={dnd.resizingTopEventId}
                  resizeTopDeltaMinutes={dnd.resizeTopDeltaMinutes}
                  snappedDeltaMinutesRef={dnd.snappedDeltaMinutesRef}
                  dayOffsetRef={dnd.dayOffsetRef}
                  onTimeSlotClick={handleTimeSlotClick}
                  onTimeSlotRangeSelect={
                    onTimeSlotRangeSelect
                      ? handleTimeSlotRangeSelect
                      : undefined
                  }
                />
                <CalendarTimeline
                  firstVisibleHour={earliestEventHour}
                  lastVisibleHour={latestEventHour}
                  days={rangeTimelineDays}
                  timeZone={selectedTimeZone}
                  markerStickyOffsetPx="var(--calendar-time-gutter-width)"
                  lineStickyOffsetPx="var(--calendar-time-gutter-width)"
                />
              </div>
            </div>
          </ScrollArea>
          <VerticalScrollHints
            showAbove={hasAnyAbove}
            showBelow={hasAnyBelow}
            bottomOffset="1rem"
          />
        </div>
      </div>
    </>
  );
}

export const CalendarRangeView = memo(CalendarRangeViewInner);
