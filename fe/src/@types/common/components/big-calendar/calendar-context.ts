import type {
  BigCalendarProps,
  CalendarBranchFilterProps,
  CalendarEvent,
  CalendarEventEditChanges,
  CalendarView,
  VisitCollisionInterval
} from '@/@types/common/big-calendar';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar';

export interface CalendarDragOverlayState {
  event: CalendarEvent;

  baseWidth: number;

  baseHeight: number;

  previewWidth: number | null;

  previewHeight: number | null;
}

export interface CalendarDragStateContextValue {
  dragOverlay: CalendarDragOverlayState | null;

  activeEventId: CalendarEvent['id'] | null;

  draggedOverlayHeight: number;

  draggedOverlayWidth: number | null;
}

export interface CalendarContextValue extends BigCalendarResultHook {
  /**
   * Busy intervals every conflict check must run against. Sourced from the
   * page's unfiltered visit list (with drag overrides applied) when provided,
   * otherwise falls back to the display events.
   */
  collisionIntervals: readonly VisitCollisionInterval[];

  pixelsPerHour: number;

  isZooming: boolean;

  disableDragDrop: boolean;

  onEventPress?: (event: CalendarEvent) => void;

  onEventHoverIntent?: (event: CalendarEvent) => void;

  onPatientArrivalChange?: (
    event: CalendarEvent,

    patientArrived: boolean
  ) => void;

  onMarkLateChange?: (event: CalendarEvent, isLate: boolean) => void;

  onViewPatientPress?: (event: CalendarEvent) => void;

  onViewTreatmentPlanPress?: (event: CalendarEvent) => void;

  onEventDrop?: (
    event: CalendarEvent,

    newStartDate: Date,

    newEndDate: Date
  ) => void;

  onEventDoctorChange?: (
    event: CalendarEvent,

    newDoctorId: string,

    newStartDate: Date,

    newEndDate: Date
  ) => void;

  onEventResize?: (
    event: CalendarEvent,

    newStartDate: Date,

    newEndDate: Date
  ) => void;

  onEventEdit?: (
    event: CalendarEvent,
    changes: CalendarEventEditChanges
  ) => void;

  onEventPatientChange?: (
    event: CalendarEvent,
    newPatientId: string,
    newPatientName: string
  ) => void;

  onEventsDelete?: (events: CalendarEvent[]) => void;

  onDatePress?: (date: Date) => void;

  onTimeSlotPress?: (date: Date, hour: number, minute: number) => void;

  onTimeSlotRangeSelect?: (startDate: Date, endDate: Date) => void;

  onTimeSlotWithDoctorPress?: (
    date: Date,

    hour: number,

    minute: number,

    doctorId: string
  ) => void;

  onTimeSlotRangeWithDoctorSelect?: (
    startDate: Date,

    endDate: Date,

    doctorId: string
  ) => void;

  canCreateInDoctorColumn?: (doctorId: string) => boolean;

  focusedDoctorId?: string | null;

  onFocusedDoctorChange?: (doctorId: string | null) => void;

  classNames?: BigCalendarProps['classNames'];

  renderers?: BigCalendarProps['renderers'];

  branchFilter?: CalendarBranchFilterProps;

  dayDrillDownView: CalendarView;

  patientsCount?: number;

  showDentistNameInRangeEvents: boolean;

  scrollToCurrentTimeKey?: string | number;

  selectedEventIds: Set<CalendarEvent['id']>;

  isEventSelected: (eventId: CalendarEvent['id']) => boolean;

  isEventHighlighted: (eventId: CalendarEvent['id']) => boolean;

  toggleEventSelection: (event: CalendarEvent) => void;

  selectEventRange: (event: CalendarEvent) => void;

  clearSelectedEvents: () => void;

  deleteSelectedEvents: () => void;

  setTargetDoctorId: (doctorId: string | null) => void;

  hasEscapeCancelAction: boolean;

  setEscapeCancelAction: (cancelAction: (() => void) | null) => void;

  cancelEscapeCancelAction: () => boolean;

  getEffectivePatientArrived: (event: CalendarEvent) => boolean;

  setPendingPatientArrival: (
    eventId: CalendarEvent['id'],

    patientArrived: boolean
  ) => void;

  getEffectiveVisitLate: (event: CalendarEvent) => boolean;

  setPendingVisitLate: (
    eventId: CalendarEvent['id'],

    isLate: boolean
  ) => void;
}
