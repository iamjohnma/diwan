import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type {
  BigCalendarProps,
  CalendarEvent,
  CalendarView,
  VisitCollisionInterval
} from '@/@types/common/big-calendar';
import type {
  CalendarContextValue,
  CalendarDragStateContextValue
} from '@/@types/common/components/big-calendar/calendar-context';
import { MIN_BADGE_HEIGHT_PX } from '@/components/common/big-calendar/dnd/draggable-event-badge';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar/big-calendar';
import type { useCalendarDragHandlers } from '@/hooks/common/big-calendar/calendar-drag-handlers';
import type { useEventSelection } from '@/hooks/common/big-calendar/event-selection';

interface UseBigCalendarContextValueOptions {
  props: BigCalendarProps;
  calendarState: BigCalendarResultHook;
  dragHandlers: ReturnType<typeof useCalendarDragHandlers>;
  events: CalendarEvent[];
  collisionIntervals: readonly VisitCollisionInterval[];
  filteredEvents: CalendarEvent[];
  eventSelection: ReturnType<typeof useEventSelection>;
  isZooming: boolean;
  availableViews: readonly CalendarView[];
  dayDrillDownView: CalendarView;
  highlightedEventIds: BigCalendarProps['highlightedEventIds'];
  escapeCancel: {
    hasEscapeCancelAction: boolean;
    setEscapeCancelAction: (cancelAction: (() => void) | null) => void;
    cancelEscapeCancelAction: () => boolean;
  };
  patientArrival: {
    getEffectivePatientArrived: (event: CalendarEvent) => boolean;
    setPendingPatientArrival: (
      eventId: CalendarEvent['id'],
      patientArrived: boolean
    ) => void;
  };
  visitLate: {
    getEffectiveVisitLate: (event: CalendarEvent) => boolean;
    setPendingVisitLate: (
      eventId: CalendarEvent['id'],
      isLate: boolean
    ) => void;
  };
  onEventPress?: (event: CalendarEvent) => void;
  onEventHoverIntent?: (event: CalendarEvent) => void;
}

export function useBigCalendarContextValue(
  options: UseBigCalendarContextValueOptions
): CalendarContextValue {
  const {
    props,
    calendarState,
    dragHandlers,
    events,
    collisionIntervals,
    filteredEvents,
    eventSelection,
    isZooming,
    dayDrillDownView,
    highlightedEventIds,
    escapeCancel,
    patientArrival,
    visitLate,
    onEventPress,
    onEventHoverIntent
  } = options;

  const isEventHighlighted = useCallback(
    (eventId: CalendarEvent['id']) =>
      highlightedEventIds?.has(eventId) ?? false,
    [highlightedEventIds]
  );

  return useMemo(
    () => ({
      pixelsPerHour: dragHandlers.pixelsPerHour,
      isZooming,
      view: calendarState.view,
      setView: calendarState.setView,
      rangeDays: calendarState.rangeDays,
      setRangeDays: calendarState.setRangeDays,
      selectedDate: calendarState.selectedDate,
      setSelectedDate: calendarState.setSelectedDate,
      selectedUserId: calendarState.selectedUserId,
      setSelectedUserId: calendarState.setSelectedUserId,
      filteredEvents,
      users: calendarState.users,
      doctors: calendarState.doctors,
      events,
      collisionIntervals,
      workingHours: calendarState.workingHours,
      visibleHours: calendarState.visibleHours,
      weekStartsOn: calendarState.weekStartsOn,
      timeZone: calendarState.timeZone,
      setTimeZone: calendarState.setTimeZone,
      goToToday: calendarState.goToToday,
      goToPrevious: calendarState.goToPrevious,
      goToNext: calendarState.goToNext,
      disableDragDrop: props.disableDragDrop ?? false,
      onEventPress,
      onEventHoverIntent,
      onPatientArrivalChange: props.onPatientArrivalChange,
      onMarkLateChange: props.onMarkLateChange,
      onViewPatientPress: props.onViewPatientPress,
      onViewTreatmentPlanPress: props.onViewTreatmentPlanPress,
      onEventDrop: props.onEventDrop,
      onEventDoctorChange: props.onEventDoctorChange,
      onEventResize: props.onEventResize,
      onEventEdit: props.onEventEdit,
      onEventPatientChange: props.onEventPatientChange,
      onEventsDelete: props.onEventsDelete,
      onDatePress: props.onDatePress,
      onTimeSlotPress: props.onTimeSlotPress,
      onTimeSlotRangeSelect: props.onTimeSlotRangeSelect,
      onTimeSlotWithDoctorPress: props.onTimeSlotWithDoctorPress,
      onTimeSlotRangeWithDoctorSelect: props.onTimeSlotRangeWithDoctorSelect,
      canCreateInDoctorColumn: props.canCreateInDoctorColumn,
      focusedDoctorId: props.focusedDoctorId,
      onFocusedDoctorChange: props.onFocusedDoctorChange,
      classNames: props.classNames,
      renderers: props.renderers,
      branchFilter: props.branchFilter,
      dayDrillDownView,
      patientsCount: props.patientsCount,
      showDentistNameInRangeEvents: props.showDentistNameInRangeEvents ?? false,
      scrollToCurrentTimeKey: props.scrollToCurrentTimeKey,
      selectedEventIds: eventSelection.selectedEventIds,
      isEventSelected: eventSelection.isEventSelected,
      isEventHighlighted,
      toggleEventSelection: eventSelection.toggleEventSelection,
      selectEventRange: eventSelection.selectEventRange,
      clearSelectedEvents: eventSelection.clearSelectedEvents,
      deleteSelectedEvents: eventSelection.deleteSelectedEvents,
      setTargetDoctorId: dragHandlers.setTargetDoctorId,
      hasEscapeCancelAction: escapeCancel.hasEscapeCancelAction,
      setEscapeCancelAction: escapeCancel.setEscapeCancelAction,
      cancelEscapeCancelAction: escapeCancel.cancelEscapeCancelAction,
      getEffectivePatientArrived: patientArrival.getEffectivePatientArrived,
      setPendingPatientArrival: patientArrival.setPendingPatientArrival,
      getEffectiveVisitLate: visitLate.getEffectiveVisitLate,
      setPendingVisitLate: visitLate.setPendingVisitLate
    }),
    [
      dragHandlers.pixelsPerHour,
      dragHandlers.setTargetDoctorId,
      isZooming,
      calendarState.view,
      calendarState.setView,
      calendarState.rangeDays,
      calendarState.setRangeDays,
      calendarState.selectedDate,
      calendarState.setSelectedDate,
      calendarState.selectedUserId,
      calendarState.setSelectedUserId,
      calendarState.users,
      calendarState.doctors,
      calendarState.workingHours,
      calendarState.visibleHours,
      calendarState.weekStartsOn,
      calendarState.timeZone,
      calendarState.setTimeZone,
      calendarState.goToToday,
      calendarState.goToPrevious,
      calendarState.goToNext,
      filteredEvents,
      events,
      collisionIntervals,
      props.disableDragDrop,
      props.onPatientArrivalChange,
      props.onMarkLateChange,
      props.onViewPatientPress,
      props.onViewTreatmentPlanPress,
      props.onEventDrop,
      props.onEventDoctorChange,
      props.onEventResize,
      props.onEventEdit,
      props.onEventPatientChange,
      props.onEventsDelete,
      props.onDatePress,
      props.onTimeSlotPress,
      props.onTimeSlotRangeSelect,
      props.onTimeSlotWithDoctorPress,
      props.onTimeSlotRangeWithDoctorSelect,
      props.canCreateInDoctorColumn,
      props.focusedDoctorId,
      props.onFocusedDoctorChange,
      props.classNames,
      props.renderers,
      props.branchFilter,
      props.patientsCount,
      props.showDentistNameInRangeEvents,
      props.scrollToCurrentTimeKey,
      dayDrillDownView,
      onEventPress,
      onEventHoverIntent,
      isEventHighlighted,
      eventSelection.selectedEventIds,
      eventSelection.isEventSelected,
      eventSelection.toggleEventSelection,
      eventSelection.selectEventRange,
      eventSelection.clearSelectedEvents,
      eventSelection.deleteSelectedEvents,
      escapeCancel.hasEscapeCancelAction,
      escapeCancel.setEscapeCancelAction,
      escapeCancel.cancelEscapeCancelAction,
      patientArrival.getEffectivePatientArrived,
      patientArrival.setPendingPatientArrival,
      visitLate.getEffectiveVisitLate,
      visitLate.setPendingVisitLate
    ]
  );
}

interface UseBigCalendarDragStateValueOptions {
  dragHandlers: ReturnType<typeof useCalendarDragHandlers>;
}

export function useBigCalendarDragStateValue(
  options: UseBigCalendarDragStateValueOptions
): CalendarDragStateContextValue {
  const { dragHandlers } = options;
  const dragState = useSyncExternalStore(
    dragHandlers.subscribeDragState,
    dragHandlers.getDragStateSnapshot,
    dragHandlers.getDragStateSnapshot
  );

  return useMemo(
    () => ({
      dragOverlay:
        dragState.activeEvent !== null &&
        dragState.draggedOverlaySize.height > 0
          ? {
              event: dragState.activeEvent,
              baseWidth: dragState.draggedOverlaySize.width,
              baseHeight: dragState.draggedOverlaySize.height,
              previewWidth: null,
              previewHeight: null
            }
          : null,
      activeEventId: dragState.activeEventId,
      draggedOverlayHeight:
        dragState.activeEvent !== null
          ? Math.max(dragState.draggedOverlaySize.height, MIN_BADGE_HEIGHT_PX)
          : dragState.draggedOverlaySize.height,
      draggedOverlayWidth: null
    }),
    [
      dragState.activeEvent,
      dragState.activeEventId,
      dragState.draggedOverlaySize.height,
      dragState.draggedOverlaySize.width
    ]
  );
}
