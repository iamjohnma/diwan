import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { UsersIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  BigCalendarProps,
  CalendarEvent,
  CalendarView
} from '@/@types/common/big-calendar';
import { canAutoScrollCalendarElement } from '@/components/common/big-calendar/calendar-auto-scroll';
import {
  CalendarContext,
  CalendarDragStateContext
} from '@/components/common/big-calendar/calendar-context';
import { CalendarDragOverlay } from '@/components/common/big-calendar/calendar-drag-overlay';
import { CalendarTouchSensor } from '@/components/common/big-calendar/dnd/calendar-touch-sensor';
import { CalendarHeader } from '@/components/common/big-calendar/header/calendar-header';
import { CalendarDoctorView } from '@/components/common/big-calendar/views/doctor-view/calendar-doctor-view';
import { CalendarMonthView } from '@/components/common/big-calendar/views/month-view/calendar-month-view';
import { CalendarRangeView } from '@/components/common/big-calendar/views/range-view/calendar-range-view';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { Kbd } from '@/components/ui/kbd';
import {
  CALENDAR_TOUCH_DRAG_ACTIVATION_DELAY_MS,
  CALENDAR_TOUCH_DRAG_HOLD_TOLERANCE_PX
} from '@/constants/common/big-calendar';
import {
  useBigCalendar,
  useBigCalendarContextValue,
  useBigCalendarDragStateValue,
  useCalendarDragHandlers,
  useCalendarEventsWithOverrides,
  useCalendarHeaderProps,
  useCalendarHotkeys,
  useCalendarZoom,
  useDragScroll,
  useEscapeCancelAction,
  useEventSelection,
  usePatientArrivalOptimistic,
  useVisitLateOptimistic
} from '@/hooks/common/big-calendar';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/common/direction';
import { useUserPreferencesStore } from '@/stores/user-preferences';
import {
  CALENDAR_VIEW_ORDER,
  DEFAULT_VISIBLE_HOURS,
  DEFAULT_WORKING_HOURS
} from '@/utils/common/big-calendar';
import { cn } from '@/utils/common/cn';

function resolveAvailableViews(
  views: BigCalendarProps['availableViews']
): readonly CalendarView[] {
  if (!views) {
    return CALENDAR_VIEW_ORDER;
  }

  const orderedViews = CALENDAR_VIEW_ORDER.filter((view) =>
    views.includes(view)
  );

  return orderedViews.length > 0 ? orderedViews : CALENDAR_VIEW_ORDER;
}

interface BigCalendarDragStateProviderProps {
  children: ReactNode;
  dragHandlers: ReturnType<typeof useCalendarDragHandlers>;
}

const BigCalendarDragStateProvider = memo(function BigCalendarDragStateProvider(
  props: BigCalendarDragStateProviderProps
) {
  const bigCalendarDragStateValue = useBigCalendarDragStateValue({
    dragHandlers: props.dragHandlers
  });

  return (
    <CalendarDragStateContext.Provider value={bigCalendarDragStateValue}>
      {props.children}
    </CalendarDragStateContext.Provider>
  );
});

function BigCalendarComponent(props: BigCalendarProps) {
  const { t } = useTranslation();
  const direction = useDirection();
  const { isMobile, isBelow } = useBreakpoint();
  const calendarZoom = useUserPreferencesStore(
    (s) => s.appearance.calendarZoom
  );
  const [hideEscapeHint, setHideEscapeHint] = useState(true);
  // In full screen the calendar root sits on the dialog layer (z-50). Popovers
  // it spawns (the appointment actions card / context menu) default to the
  // base-popover layer (z-45), so they'd render *behind* the opaque full-screen
  // surface. Portal them into this in-surface container instead â€” the same
  // floating-layer trick dialogs/drawers use to keep their own popovers on top.
  const rootRef = useRef<HTMLDivElement>(null);
  const escapeCancelAction = useEscapeCancelAction();
  const { isFullScreen, onFullScreenToggle, onEventPress, disableEventPress } =
    props;
  const isInteractive = props.isInteractive ?? true;
  const focusedDoctorId = props.focusedDoctorId;
  const hasFocusedDoctor = !!focusedDoctorId && !!props.onFocusedDoctorChange;
  const escapeHintKey = hasFocusedDoctor
    ? focusedDoctorId
    : isFullScreen
      ? 'full-screen'
      : null;
  const escapeHintText = hasFocusedDoctor
    ? t('bigCalendar.focusedDoctor.escapeHint')
    : t('bigCalendar.fullScreen.escapeHint');

  const effectiveRangeDays = isMobile ? 1 : props.rangeDays;
  const availableViews = useMemo(
    () => resolveAvailableViews(props.availableViews),
    [props.availableViews]
  );
  const fallbackView = availableViews[0] ?? 'range';
  const mobileFallbackView =
    availableViews.find((view) => view !== 'month') ?? fallbackView;
  const dayDrillDownView = availableViews.includes('range')
    ? 'range'
    : availableViews.includes('doctor')
      ? 'doctor'
      : fallbackView;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 3 }
    }),
    useSensor(CalendarTouchSensor, {
      activationConstraint: {
        delay: CALENDAR_TOUCH_DRAG_ACTIVATION_DELAY_MS,
        tolerance: CALENDAR_TOUCH_DRAG_HOLD_TOLERANCE_PX
      }
    })
  );

  const workingHours = props.workingHours ?? DEFAULT_WORKING_HOURS;
  const doctorById = useMemo(
    () =>
      new Map(
        (props.doctors ?? []).map((doctor) => [doctor.id, doctor] as const)
      ),
    [props.doctors]
  );

  const calendarState = useBigCalendar({
    events: props.events,
    users: props.users,
    doctors: props.doctors,
    view: props.view,
    defaultView: props.defaultView,
    onViewChange: props.onViewChange,
    rangeDays: effectiveRangeDays,
    defaultRangeDays: isMobile ? 1 : props.defaultRangeDays,
    onRangeDaysChange: props.onRangeDaysChange,
    selectedDate: props.selectedDate,
    defaultSelectedDate: props.defaultSelectedDate,
    onSelectedDateChange: props.onSelectedDateChange,
    selectedUserId: props.selectedUserId,
    defaultSelectedUserId: props.defaultSelectedUserId,
    onSelectedUserIdChange: props.onSelectedUserIdChange,
    weekStartsOn: props.weekStartsOn ?? 0,
    visibleHours: props.visibleHours ?? DEFAULT_VISIBLE_HOURS,
    workingHours
  });

  const dragHandlers = useCalendarDragHandlers({
    calendarZoom,
    direction,
    rangeDays: props.rangeDays,
    events: calendarState.events,
    collisionIntervals: props.collisionIntervals,
    doctorById,
    onEventDrop: props.onEventDrop,
    onEventResize: props.onEventResize,
    onEventDoctorChange: props.onEventDoctorChange
  });

  const dragScrollControls = useMemo(
    () => ({
      subscribeDragState: dragHandlers.subscribeDragState,
      getIsDraggingEvent: dragHandlers.getIsDraggingEvent
    }),
    [dragHandlers.subscribeDragState, dragHandlers.getIsDraggingEvent]
  );

  useDragScroll(dragScrollControls, rootRef);

  const canAutoScrollElement = useCallback((element: Element) => {
    return canAutoScrollCalendarElement(element, rootRef.current);
  }, []);

  const {
    events: eventsWithOverrides,
    filteredEvents: filteredEventsWithOverrides
  } = useCalendarEventsWithOverrides({ calendarState, dragHandlers });

  const collisionIntervals = useMemo(
    () =>
      props.collisionIntervals
        ? props.collisionIntervals.map(
            dragHandlers.applyPendingOverridesToInterval
          )
        : eventsWithOverrides,
    [
      props.collisionIntervals,
      dragHandlers.applyPendingOverridesToInterval,
      eventsWithOverrides
    ]
  );

  const eventSelection = useEventSelection({
    filteredEvents: filteredEventsWithOverrides,
    eventsWithOverrides,
    onEventsDelete: props.onEventsDelete
  });

  const calendarHeaderProps = useCalendarHeaderProps({
    props,
    calendarState,
    filteredEvents: filteredEventsWithOverrides,
    eventSelection,
    availableViews
  });

  const handleInternalEventPress = useCallback(
    (event: CalendarEvent) => {
      onEventPress?.(event);
    },
    [onEventPress]
  );

  const { handleCalendarZoomWheel, isZooming } = useCalendarZoom({
    view: calendarState.view,
    getIsDraggingEvent: dragHandlers.getIsDraggingEvent,
    pixelsPerHour: dragHandlers.pixelsPerHour,
    rootRef
  });

  const { view: calendarView, setView: setCalendarView } = calendarState;

  useEffect(() => {
    if (!availableViews.includes(calendarView)) {
      setCalendarView(isMobile ? mobileFallbackView : fallbackView);

      return;
    }

    if (
      isMobile &&
      calendarView === 'month' &&
      mobileFallbackView !== 'month'
    ) {
      setCalendarView(mobileFallbackView);
    }
  }, [
    availableViews,
    calendarView,
    fallbackView,
    isMobile,
    mobileFallbackView,
    setCalendarView
  ]);

  const reservedKeys = useCalendarHotkeys({
    enabled: isInteractive,
    rootRef,
    view: calendarState.view,
    isFullScreen,
    onFullScreenToggle,
    getIsEventInteractionActive: dragHandlers.getIsEventInteractionActive,
    scrollStepPx: dragHandlers.pixelsPerHour,
    hasEscapeCancelAction: escapeCancelAction.hasEscapeCancelAction,
    cancelEscapeCancelAction: escapeCancelAction.cancelEscapeCancelAction,
    goToToday: calendarState.goToToday,
    setRangeDays: calendarState.setRangeDays,
    hasSelection: eventSelection.selectedEventIds.size > 0,
    deleteSelectedEvents: eventSelection.deleteSelectedEvents
  });

  useEffect(() => {
    if (!hasFocusedDoctor) {
      return;
    }

    escapeCancelAction.setEscapeCancelAction(() => {
      props.onFocusedDoctorChange?.(null);
    });

    return () => {
      escapeCancelAction.setEscapeCancelAction(null);
    };
  }, [
    escapeCancelAction.setEscapeCancelAction,
    hasFocusedDoctor,
    props.onFocusedDoctorChange
  ]);

  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isFullScreen]);

  useEffect(() => {
    if (!escapeHintKey) return;

    const showTimer = setTimeout(() => setHideEscapeHint(false), 0);
    const hideTimer = setTimeout(() => setHideEscapeHint(true), 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      setHideEscapeHint(true);
    };
  }, [escapeHintKey]);

  const handleRootClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Preserve the selection while a multi-select modifier is held so an
      // empty-area click mid-selection doesn't wipe it.
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;

      eventSelection.clearSelectedEvents();
    },
    [eventSelection.clearSelectedEvents]
  );

  const patientArrival = usePatientArrivalOptimistic(eventsWithOverrides);
  const visitLate = useVisitLateOptimistic(eventsWithOverrides);

  const contextValue = useBigCalendarContextValue({
    props,
    calendarState,
    dragHandlers,
    events: eventsWithOverrides,
    collisionIntervals,
    filteredEvents: filteredEventsWithOverrides,
    eventSelection,
    isZooming,
    availableViews,
    dayDrillDownView,
    highlightedEventIds: props.highlightedEventIds,
    escapeCancel: escapeCancelAction,
    patientArrival,
    visitLate,
    onEventPress: disableEventPress ? undefined : handleInternalEventPress,
    onEventHoverIntent: undefined
  });

  return (
    <DndContext
      sensors={sensors}
      autoScroll={{
        layoutShiftCompensation: false,
        acceleration: 10,
        interval: 5,
        threshold: { x: 0.15, y: 0.2 },
        canScroll: canAutoScrollElement
      }}
      onDragStart={dragHandlers.handleDragStart}
      onDragMove={dragHandlers.handleDragMove}
      onDragEnd={dragHandlers.handleDragEnd}
      onDragCancel={dragHandlers.handleDragCancel}
    >
      <CalendarContext.Provider value={contextValue}>
        <BigCalendarDragStateProvider dragHandlers={dragHandlers}>
          <div
            ref={rootRef}
            className={cn(
              'relative isolate flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden',
              props.isFullScreen && 'fixed inset-0 z-50 bg-background',
              props.className,
              props.classNames?.root
            )}
            data-dms-reserved-keys={reservedKeys}
            onClick={isInteractive ? handleRootClick : undefined}
            onWheel={isInteractive ? handleCalendarZoomWheel : undefined}
          >
            <div className="relative z-40 min-w-0 shrink-0 overflow-x-hidden">
              <CalendarHeader {...calendarHeaderProps} />
            </div>
            <div
              className={cn(
                'relative isolate flex-1 min-h-0 w-full min-w-0 overflow-hidden contain-[layout]',
                props.classNames?.viewContainer
              )}
            >
              {props.patientsCount === 0 &&
              !props.showCalendarWhenNoPatients ? (
                <div className="flex h-full min-h-0">
                  <Empty className="h-full w-full">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UsersIcon className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>
                        {t('reservations.noPatients.title')}
                      </EmptyTitle>
                      <EmptyDescription>
                        {t('reservations.noPatients.description')}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <>
                  {calendarState.view === 'month' && <CalendarMonthView />}
                  {calendarState.view === 'range' && <CalendarRangeView />}
                  {calendarState.view === 'doctor' && <CalendarDoctorView />}
                </>
              )}
            </div>
            <CalendarDragOverlay />
            {escapeHintKey && !isBelow('2xl') && (
              <AnimatePresence>
                {!hideEscapeHint && (
                  <motion.div
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute bottom-6 inset-s-1/2 -translate-x-1/2 rtl:translate-x-1/2 flex items-center gap-2 rounded-lg bg-foreground/90 px-4 py-2.5 text-sm text-background shadow-lg backdrop-blur-sm"
                  >
                    <Kbd
                      keyId="escape"
                      className="rounded bg-background/20 px-1.5 py-0.5 font-mono text-xs text-background"
                    />
                    <span>{escapeHintText}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </BigCalendarDragStateProvider>
      </CalendarContext.Provider>
    </DndContext>
  );
}

export const BigCalendar = memo(BigCalendarComponent);

BigCalendar.displayName = 'BigCalendar';
