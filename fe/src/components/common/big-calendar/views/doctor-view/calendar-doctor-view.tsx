import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import type {
  CalendarDoctor,
  CalendarEvent
} from '@/@types/common/big-calendar';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { CalendarTimeGutter } from '@/components/common/big-calendar/shared/calendar-time-gutter';
import { CalendarTimeline } from '@/components/common/big-calendar/shared/calendar-timeline';
import {
  useColumnOverflow,
  useHorizontalColumnOverflow
} from '@/components/common/big-calendar/shared/overflow-indicators';
import {
  HorizontalScrollHints,
  VerticalScrollHints
} from '@/components/common/big-calendar/shared/scroll-hints';
import { applyResizePreviewToEvents } from '@/components/common/big-calendar/shared/time-slot-grid';
import { DoctorViewColumnsGrid } from '@/components/common/big-calendar/views/doctor-view/calendar-doctor-view/doctor-view-columns-grid';
import { DoctorViewEmptyState } from '@/components/common/big-calendar/views/doctor-view/calendar-doctor-view/doctor-view-empty-state';
import {
  DoctorViewStickyHeader,
  type DoctorViewStickyHeaderProps
} from '@/components/common/big-calendar/views/doctor-view/calendar-doctor-view/doctor-view-sticky-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TIME_COLUMN_WIDTH,
  TIME_COLUMN_WIDTH_MOBILE
} from '@/constants/common/big-calendar';
import {
  useDoctorViewDnd,
  useDoctorViewLayout
} from '@/hooks/common/big-calendar';
import {
  getForcedEventIds,
  useTimeGridSegments
} from '@/hooks/common/big-calendar/time-grid-segments';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useTranslation } from 'react-i18next';
import { getVisibleHours } from '@/utils/common/big-calendar';
import {
  clampMoveDeltaMinutes,
  detectVisitCollision,
  getVisitCollisionReasonKey
} from '@/utils/common/big-calendar-collision';
import type { CalendarEventRenderSegment } from '@/utils/common/big-calendar-segments';
import { buildDayWindowsForDates } from '@/utils/common/big-calendar-segments';
import { getVisibleMinuteWindow } from '@/utils/common/big-calendar-virtualization';
import { cn } from '@/utils/common/cn';
import {
  createDateInTimeZone,
  getTimePartsInTimeZone,
  getWeekdayIndexInTimeZone
} from '@/utils/common/time-zone';

const DOCTOR_HEADER_HEIGHT = 64;
const DOCTOR_EVENT_WINDOW_OVERSCAN_MINUTES = 0;
const EMPTY_DOCTORS: CalendarDoctor[] = [];
const EMPTY_EVENTS: CalendarEvent[] = [];

const EMPTY_SEGMENTS_BY_DOCTOR_ID = new Map<
  string,
  CalendarEventRenderSegment[]
>();

interface DoctorViewStickyHeaderDragShieldProps extends Omit<
  DoctorViewStickyHeaderProps,
  'headerRef'
> {
  activeEvent: CalendarEvent | null;
  sourceHeaderRef: RefObject<HTMLDivElement | null>;
  viewportElement: HTMLElement | null;
}

const DoctorViewStickyHeaderDragShield = memo(
  function DoctorViewStickyHeaderDragShield(
    props: DoctorViewStickyHeaderDragShieldProps
  ) {
    const [shieldRect, setShieldRect] = useState<DOMRect | null>(null);

    useLayoutEffect(() => {
      if (!props.activeEvent) {
        setShieldRect(null);

        return;
      }

      const viewport = props.viewportElement;
      if (!viewport) {
        setShieldRect(
          props.sourceHeaderRef.current?.getBoundingClientRect() ?? null
        );

        return;
      }

      let rafId: number | null = null;
      const updateShieldRect = () => {
        setShieldRect(
          props.sourceHeaderRef.current?.getBoundingClientRect() ?? null
        );
      };
      const scheduleShieldRectUpdate = () => {
        if (rafId !== null) return;

        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateShieldRect();
        });
      };

      updateShieldRect();
      viewport.addEventListener('scroll', scheduleShieldRectUpdate, {
        passive: true
      });

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        viewport.removeEventListener('scroll', scheduleShieldRectUpdate);
      };
    }, [props.activeEvent, props.sourceHeaderRef, props.viewportElement]);

    if (!props.activeEvent || !shieldRect) return null;

    return createPortal(
      <div
        className="pointer-events-none fixed z-41 overflow-hidden bg-background"
        style={{
          top: shieldRect.top,
          left: shieldRect.left,
          width: shieldRect.width,
          height: shieldRect.height
        }}
      >
        <DoctorViewStickyHeader
          timeColumnWidth={props.timeColumnWidth}
          totalColumnsWidth={props.totalColumnsWidth}
          doctors={props.doctors}
          eventsByDoctorId={props.eventsByDoctorId}
          columnWidth={props.columnWidth}
          isRtl={props.isRtl}
          timeZone={props.timeZone}
          onTimeZoneChange={props.onTimeZoneChange}
          focusedDoctorId={props.focusedDoctorId}
          onFocusedDoctorChange={props.onFocusedDoctorChange}
        />
      </div>,
      document.body
    );
  }
);

const CalendarDoctorViewInner = function CalendarDoctorViewInner() {
  const { t, i18n } = useTranslation();
  const calendar = useCalendarContext();
  const { isMobile } = useBreakpoint();
  const pixelsPerHour = calendar.pixelsPerHour;
  const timeColumnWidth = isMobile
    ? TIME_COLUMN_WIDTH_MOBILE
    : TIME_COLUMN_WIDTH;
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastScrollToNowTargetRef = useRef<{
    key: string | number | undefined;
    timeZone: string;
  } | null>(null);

  const locale = i18n.language === 'ar' ? ar : enUS;
  const isRtlLayout = i18n.dir() === 'rtl';
  const selectedTimeZone = calendar.timeZone;
  const doctors = calendar.doctors ?? EMPTY_DOCTORS;
  const visibleDoctorIds = useMemo(
    () => new Set(doctors.map((doctor) => doctor.id)),
    [doctors]
  );
  const selectedDate = calendar.selectedDate;
  const selectedDateParts = useMemo(
    () => ({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate()
    }),
    [selectedDate]
  );
  const selectedDateInTimeZone = useMemo(
    () =>
      createDateInTimeZone(
        { ...selectedDateParts, hour: 12, minute: 0 },
        selectedTimeZone
      ),
    [selectedDateParts, selectedTimeZone]
  );
  const selectedDayWindow = useMemo(
    () => buildDayWindowsForDates([selectedDate], selectedTimeZone)[0] ?? null,
    [selectedDate, selectedTimeZone]
  );
  const selectedDayIndex = useMemo(
    () => getWeekdayIndexInTimeZone(selectedDateInTimeZone, selectedTimeZone),
    [selectedDateInTimeZone, selectedTimeZone]
  );
  const timelineDays = useMemo(
    () => [selectedDateInTimeZone],
    [selectedDateInTimeZone]
  );
  const onTimeSlotWithDoctorPress = calendar.onTimeSlotWithDoctorPress;
  const onTimeSlotRangeWithDoctorSelect =
    calendar.onTimeSlotRangeWithDoctorSelect;
  const onEventDoctorChange = calendar.onEventDoctorChange;
  const setTargetDoctorId = calendar.setTargetDoctorId;
  const canCreateInDoctorColumnRule = calendar.canCreateInDoctorColumn;

  const layout = useDoctorViewLayout({
    scrollAreaRef,
    containerRef,
    doctorCount: doctors.length,
    isDraggingRef,
    timeColumnWidth
  });

  const doctorViewEvents = useMemo(() => {
    if (!selectedDayWindow) return EMPTY_EVENTS;

    return calendar.events.filter((event) => {
      if (!event.dentistId || !visibleDoctorIds.has(event.dentistId)) {
        return false;
      }

      const eventStart = parseISO(event.startDate);
      const eventEnd = parseISO(event.endDate);

      return (
        eventStart < selectedDayWindow.end && eventEnd > selectedDayWindow.start
      );
    });
  }, [calendar.events, selectedDayWindow, visibleDoctorIds]);

  const getClampedMoveDeltaMinutes = useCallback(
    (
      event: CalendarEvent,
      desiredDeltaMinutes: number,
      targetDentistId: string | null
    ) =>
      clampMoveDeltaMinutes(
        {
          start: parseISO(event.startDate),
          end: parseISO(event.endDate),
          desiredDeltaMinutes,
          patientId: event.patientId,
          dentistId: targetDentistId,
          ignoreEventId: event.id,
          ignoreVisitId: event.visitId ?? null
        },
        calendar.collisionIntervals
      ),
    [calendar.collisionIntervals]
  );

  const dnd = useDoctorViewDnd({
    pixelsPerHour,
    isRtlLayout,
    viewportElement: layout.viewportElement,
    columnWidth: layout.columnWidth,
    timeColumnWidth,
    doctors,
    isDraggingRef,
    onEventDoctorChange,
    setTargetDoctorId,
    getClampedMoveDeltaMinutes
  });

  const { hours, earliestEventHour } = useMemo(
    () =>
      getVisibleHours(
        calendar.visibleHours,
        doctorViewEvents,
        selectedTimeZone
      ),
    [calendar.visibleHours, doctorViewEvents, selectedTimeZone]
  );

  const visibleHoursEndExclusive = hours.at(-1)! + 1;
  const totalRowsHeight = hours.length * pixelsPerHour;
  const totalColumnsWidth = doctors.length * layout.columnWidth;
  const columnOffsetMultiplier = isRtlLayout ? -1 : 1;

  const rowViewportHeight = Math.max(
    0,
    layout.scrollState.viewportHeight - DOCTOR_HEADER_HEIGHT
  );
  const visibleMinuteWindow = useMemo(
    () =>
      getVisibleMinuteWindow(
        layout.scrollState.scrollTop,
        rowViewportHeight,
        earliestEventHour,
        DOCTOR_EVENT_WINDOW_OVERSCAN_MINUTES,
        pixelsPerHour
      ),
    [
      earliestEventHour,
      rowViewportHeight,
      layout.scrollState.scrollTop,
      pixelsPerHour
    ]
  );

  const sourceEventById = useMemo(
    () => new Map(doctorViewEvents.map((event) => [event.id, event] as const)),
    [doctorViewEvents]
  );

  const previewDoctorViewEvents = useMemo(() => {
    if (
      dnd.dragType === 'move' &&
      dnd.activeEvent !== null &&
      dnd.movePreview.dragOverDoctorId !== null
    ) {
      const targetDoctorId = dnd.movePreview.dragOverDoctorId;

      return doctorViewEvents.map((event) => {
        if (event.id !== dnd.activeEvent?.id) return event;

        return { ...event, dentistId: targetDoctorId };
      });
    }

    return applyResizePreviewToEvents(doctorViewEvents, dnd);
  }, [
    doctorViewEvents,
    dnd.activeEvent,
    dnd.dragType,
    dnd.movePreview.dragOverDoctorId,
    dnd.resizeDeltaMinutes,
    dnd.resizeTopDeltaMinutes,
    dnd.resizingEventId,
    dnd.resizingTopEventId
  ]);

  const forcedEventIds = useMemo(
    () =>
      getForcedEventIds({
        activeEvent: dnd.activeEvent,
        resizingEventId: dnd.resizingEventId,
        resizingTopEventId: dnd.resizingTopEventId
      }),
    [dnd.activeEvent, dnd.resizingEventId, dnd.resizingTopEventId]
  );

  const getDoctorGroupKey = useCallback(
    (segment: CalendarEventRenderSegment) => segment.doctorId,
    []
  );

  const {
    segmentsByKey: segmentsByDoctorId,
    stableVisibleSegmentsByKey: stableVisibleSegmentsByDoctorId,
    hasFirstPainted
  } = useTimeGridSegments({
    previewEvents: previewDoctorViewEvents,
    dayWindows: selectedDayWindow ? [selectedDayWindow] : [],
    timeZone: selectedTimeZone,
    sourceEventById,
    getGroupKey: getDoctorGroupKey,
    visibleMinuteWindow,
    isZooming: calendar.isZooming,
    forcedEventIds
  });

  const segmentsForGrid = hasFirstPainted
    ? stableVisibleSegmentsByDoctorId
    : EMPTY_SEGMENTS_BY_DOCTOR_ID;

  const eventsByDoctorId = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    for (const event of doctorViewEvents) {
      const dentistId = event.dentistId;
      if (!dentistId) continue;
      const existing = result.get(dentistId);
      if (existing) {
        existing.push(event);
      } else {
        result.set(dentistId, [event]);
      }
    }

    return result;
  }, [doctorViewEvents]);

  const doctorsWithNoVisits = useMemo(() => {
    const result = new Set<string>();
    for (const doctor of doctors) {
      const events = eventsByDoctorId.get(doctor.id);
      if (!events || events.length === 0) result.add(doctor.id);
    }

    return result;
  }, [doctors, eventsByDoctorId]);

  const { hasAnyAbove, hasAnyBelow } = useColumnOverflow({
    scrollAreaRef,
    eventsByColumnId: segmentsByDoctorId,
    earliestEventHour,
    headerOffset: DOCTOR_HEADER_HEIGHT,
    pixelsPerHour
  });

  const { hasAnyLeft, hasAnyRight } = useHorizontalColumnOverflow({
    scrollAreaRef,
    doctors,
    eventsByColumnId: eventsByDoctorId,
    columnWidth: layout.columnWidth,
    stickyColumnWidth: timeColumnWidth,
    isRtl: isRtlLayout
  });

  const handleTimeSlotClick = useCallback(
    (doctorId: string, hour: number, minute: number) => {
      const selectedInstant = createDateInTimeZone(
        { ...selectedDateParts, hour, minute },
        selectedTimeZone
      );

      onTimeSlotWithDoctorPress?.(
        selectedInstant,
        selectedInstant.getHours(),
        selectedInstant.getMinutes(),
        doctorId
      );
    },
    [onTimeSlotWithDoctorPress, selectedDateParts, selectedTimeZone]
  );

  const minuteToDate = useCallback(
    (minute: number) =>
      createDateInTimeZone(
        {
          ...selectedDateParts,
          hour: Math.floor(minute / 60),
          minute: minute % 60
        },
        selectedTimeZone
      ),
    [selectedDateParts, selectedTimeZone]
  );

  const getRangeCollision = useCallback(
    (doctorId: string, startMinute: number, endMinute: number) =>
      detectVisitCollision(
        {
          start: minuteToDate(startMinute),
          end: minuteToDate(endMinute),
          dentistId: doctorId
        },
        calendar.collisionIntervals
      ),
    [calendar.collisionIntervals, minuteToDate]
  );

  const checkRangeCollision = useCallback(
    (doctorId: string, startMinute: number, endMinute: number) =>
      getRangeCollision(doctorId, startMinute, endMinute) !== null,
    [getRangeCollision]
  );

  const handleTimeSlotRangeSelect = useCallback(
    (doctorId: string, startMinute: number, endMinute: number) => {
      const collision = getRangeCollision(doctorId, startMinute, endMinute);
      if (collision) {
        toast.error(t(getVisitCollisionReasonKey(collision.reason)));

        return;
      }

      onTimeSlotRangeWithDoctorSelect?.(
        minuteToDate(startMinute),
        minuteToDate(endMinute),
        doctorId
      );
    },
    [getRangeCollision, minuteToDate, onTimeSlotRangeWithDoctorSelect, t]
  );

  const canCreateInDoctorColumn = useCallback(
    (doctorId: string) => {
      if (!onTimeSlotWithDoctorPress) return false;

      return canCreateInDoctorColumnRule?.(doctorId) ?? true;
    },
    [canCreateInDoctorColumnRule, onTimeSlotWithDoctorPress]
  );

  useLayoutEffect(() => {
    if (!layout.viewportElement) return;
    if (!selectedTimeZone) return;

    const previousTarget = lastScrollToNowTargetRef.current;
    if (
      previousTarget !== null &&
      previousTarget.key === calendar.scrollToCurrentTimeKey &&
      previousTarget.timeZone === selectedTimeZone
    ) {
      return;
    }

    const nowParts = getTimePartsInTimeZone(new Date(), selectedTimeZone);
    const targetMinutes = nowParts.hour * 60 + nowParts.minute;
    const firstVisibleMinute = earliestEventHour * 60;
    const minutesFromTop = Math.max(0, targetMinutes - firstVisibleMinute);
    const vpHeight = Math.max(
      0,
      layout.viewportElement.clientHeight - DOCTOR_HEADER_HEIGHT
    );
    const targetScrollTop =
      (minutesFromTop / 60) * pixelsPerHour - vpHeight / 2;
    const maxScrollTop = Math.max(
      0,
      layout.viewportElement.scrollHeight - layout.viewportElement.clientHeight
    );

    layout.viewportElement.scrollTop = Math.min(
      maxScrollTop,
      Math.max(0, targetScrollTop)
    );
    layout.syncScrollState();
    lastScrollToNowTargetRef.current = {
      key: calendar.scrollToCurrentTimeKey,
      timeZone: selectedTimeZone
    };
  }, [
    calendar.scrollToCurrentTimeKey,
    earliestEventHour,
    layout.syncScrollState,
    layout.viewportElement,
    pixelsPerHour,
    selectedTimeZone
  ]);

  if (doctors.length === 0) {
    return <DoctorViewEmptyState />;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden contain-[layout]',
        calendar.classNames?.doctorView
      )}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef} type="always">
          <div
            className="flex flex-col"
            style={{
              minWidth: `${timeColumnWidth + totalColumnsWidth}px`
            }}
          >
            <DoctorViewStickyHeader
              headerRef={stickyHeaderRef}
              timeColumnWidth={timeColumnWidth}
              totalColumnsWidth={totalColumnsWidth}
              doctors={doctors}
              eventsByDoctorId={eventsByDoctorId}
              columnWidth={layout.columnWidth}
              isRtl={isRtlLayout}
              timeZone={calendar.timeZone}
              onTimeZoneChange={calendar.setTimeZone}
              focusedDoctorId={calendar.focusedDoctorId}
              onFocusedDoctorChange={calendar.onFocusedDoctorChange}
            />
            <div className="relative flex" data-calendar-zoom-content>
              <CalendarTimeGutter
                variant="doctor"
                hours={hours}
                pixelsPerHour={pixelsPerHour}
                totalRowsHeight={totalRowsHeight}
                columnWidth={timeColumnWidth}
                locale={locale}
              />
              <DoctorViewColumnsGrid
                doctors={doctors}
                hours={hours}
                totalRowsHeight={totalRowsHeight}
                totalColumnsWidth={totalColumnsWidth}
                columnWidth={layout.columnWidth}
                columnOffsetMultiplier={columnOffsetMultiplier}
                pixelsPerHour={pixelsPerHour}
                selectedTimeZone={selectedTimeZone}
                selectedDayIndex={selectedDayIndex}
                selectedDayWindow={selectedDayWindow}
                workingHours={calendar.workingHours}
                disableDragDrop={calendar.disableDragDrop}
                segmentsByDoctorId={segmentsByDoctorId}
                stableVisibleSegmentsByDoctorId={segmentsForGrid}
                doctorsWithNoVisits={doctorsWithNoVisits}
                activeEvent={dnd.activeEvent}
                dragType={dnd.dragType}
                resizingEventId={dnd.resizingEventId}
                resizeDeltaMinutes={dnd.resizeDeltaMinutes}
                resizingTopEventId={dnd.resizingTopEventId}
                resizeTopDeltaMinutes={dnd.resizeTopDeltaMinutes}
                snappedDeltaMinutesRef={dnd.snappedDeltaMinutesRef}
                dragOverDoctorIdRef={dnd.dragOverDoctorIdRef}
                canCreateInDoctorColumn={canCreateInDoctorColumn}
                onTimeSlotClick={handleTimeSlotClick}
                onTimeSlotRangeSelect={
                  onTimeSlotRangeWithDoctorSelect
                    ? handleTimeSlotRangeSelect
                    : undefined
                }
                checkRangeCollision={
                  onTimeSlotRangeWithDoctorSelect
                    ? checkRangeCollision
                    : undefined
                }
              />
              <CalendarTimeline
                firstVisibleHour={earliestEventHour}
                lastVisibleHour={visibleHoursEndExclusive}
                days={timelineDays}
                timeZone={selectedTimeZone}
                markerStickyOffsetPx={timeColumnWidth}
                lineStickyOffsetPx={timeColumnWidth}
              />
            </div>
          </div>
          <DoctorViewStickyHeaderDragShield
            activeEvent={dnd.activeEvent}
            sourceHeaderRef={stickyHeaderRef}
            viewportElement={layout.viewportElement}
            timeColumnWidth={timeColumnWidth}
            totalColumnsWidth={totalColumnsWidth}
            doctors={doctors}
            eventsByDoctorId={eventsByDoctorId}
            columnWidth={layout.columnWidth}
            isRtl={isRtlLayout}
            timeZone={calendar.timeZone}
            onTimeZoneChange={calendar.setTimeZone}
            focusedDoctorId={calendar.focusedDoctorId}
            onFocusedDoctorChange={calendar.onFocusedDoctorChange}
          />
          <ScrollBar orientation="horizontal" />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
        <VerticalScrollHints
          showAbove={hasAnyAbove}
          showBelow={hasAnyBelow}
          topOffset="5rem"
          bottomOffset="1rem"
        />
        <HorizontalScrollHints
          showLeft={hasAnyLeft}
          showRight={hasAnyRight}
          leftOffset={isRtlLayout ? '0.5rem' : `${timeColumnWidth + 8}px`}
          rightOffset={isRtlLayout ? `${timeColumnWidth + 8}px` : '0.5rem'}
          topOffset={`${DOCTOR_HEADER_HEIGHT}px`}
        />
      </div>
    </div>
  );
};

export const CalendarDoctorView = memo(CalendarDoctorViewInner);
