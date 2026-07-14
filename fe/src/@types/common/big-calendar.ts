import type { ReactNode } from 'react';

export type CalendarView = 'range' | 'month' | 'doctor';

export type CalendarDragType = 'move' | 'resize' | 'resize-top';

export type RangeDays = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type EventColor =
  'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'gray';

export interface CalendarUser {
  id: string;
  name: string;
  picturePath: string | null;
}

export interface CalendarDoctor {
  id: string;
  name: string;
  avatar: string | null;
  specialty: string;
  color: string;
  isArchived?: boolean;
}

export interface VisitCollisionInterval {
  id: string | number;
  visitId?: string | null;
  startDate: string;
  endDate: string;
  patientId?: string | null;
  dentistId?: string | null;
}

type InvoiceStatus = 'pending' | 'partial' | 'awaiting_clearance' | 'paid';

export interface CalendarEvent {
  id: number | string;
  title?: string | null;
  startDate: string;
  endDate: string;
  patientName: string;
  visitType?: string | null;
  color: EventColor;
  description: string;
  user: CalendarUser;
  patientId?: string;
  dentistId?: string;
  branchId?: string | null;
  treatmentPlanId?: string | null;
  visitId?: string | null;
  invoiceId?: string | null;
  invoiceStatus?: InvoiceStatus | null;
  /** This visit's total cost (visit.totalPrice). */
  invoiceTotal?: number | null;
  /** Amount already paid on this visit's invoice. */
  invoicePaidAmount?: number | null;
  isReadOnly?: boolean;
  /**
   * Allows only calendar move/resize interactions while the create mutation is
   * waiting for a real visit id. All other read-only gates remain in force.
   */
  isPendingCreate?: boolean;
  canDelete?: boolean;
  readOnlyReasons?: Array<'DENTIST_ARCHIVED' | 'PATIENT_ARCHIVED'>;
  isLate?: boolean;
  patientArrived?: boolean | null;
  patientArrivedAt?: string | null;
  status?: string;
}

/**
 * Field-level edits applied together from the appointment editor popover.
 * Only the provided fields are changed (partial patch).
 */
export interface CalendarEventEditChanges {
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  dentistId?: string;
  branchId?: string;
  visitType?: string | null;
}

export interface CalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}

export interface WorkingHours {
  [key: number]: { from: number; to: number };
}

export interface VisibleHours {
  from: number;
  to: number;
}

interface CalendarClassNames {
  root?: string;
  header?: string;
  viewContainer?: string;
  monthView?: string;
  rangeView?: string;
  weekView?: string;
  dayView?: string;
  doctorView?: string;
}

interface CalendarRenderers {
  renderHeaderActions?: () => ReactNode;
  doctorViewEmptyState?: {
    title: string;
    description?: string;
  };
}

export interface CalendarBranchFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  branches: readonly { id: string; name: string }[];
  disabled?: boolean;
}

export interface BigCalendarProps {
  events: CalendarEvent[];
  /**
   * Complete, unfiltered busy intervals for the loaded window (every dentist
   * and patient, across branches and permission scopes). All conflict checks â€”
   * red drag selection, drop overlays, move/resize blocking, edit validation â€”
   * run against these instead of `events`, so display filters (branch filter,
   * own-dentist scope, focused doctor) can never hide a double-booking. Falls
   * back to `events` when omitted.
   */
  collisionIntervals?: VisitCollisionInterval[];
  users: CalendarUser[];
  doctors?: CalendarDoctor[];
  disableDragDrop?: boolean;
  isInteractive?: boolean;
  view?: CalendarView;
  defaultView?: CalendarView;
  availableViews?: readonly CalendarView[];
  viewLabels?: Partial<Record<CalendarView, string>>;
  onViewChange?: (view: CalendarView) => void;
  rangeDays?: RangeDays;
  defaultRangeDays?: RangeDays;
  onRangeDaysChange?: (rangeDays: RangeDays) => void;
  selectedDate?: Date;
  defaultSelectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
  selectedUserId?: string | 'all';
  defaultSelectedUserId?: string | 'all';
  onSelectedUserIdChange?: (userId: string | 'all') => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  visibleHours?: VisibleHours;
  workingHours?: WorkingHours;
  className?: string;
  classNames?: CalendarClassNames;
  renderers?: CalendarRenderers;
  branchFilter?: CalendarBranchFilterProps;
  /**
   * Disables pressing an event badge to navigate. Use on surfaces where the
   * badge would only lead back to the page it lives on (e.g. the patient
   * detail visit history), so the badge stays inert on click while drag,
   * resize, and multi-select keep working.
   */
  disableEventPress?: boolean;
  onEventPress?: (event: CalendarEvent) => void;
  onPatientArrivalChange?: (
    event: CalendarEvent,
    patientArrived: boolean
  ) => void;
  onMarkLateChange?: (event: CalendarEvent, isLate: boolean) => void;
  onViewPatientPress?: (event: CalendarEvent) => void;
  /**
   * Open the visit's treatment plan. Only invoked for events that carry a
   * {@link CalendarEvent.treatmentPlanId}; the popover falls back to
   * {@link onViewPatientPress} when a visit has no plan.
   */
  onViewTreatmentPlanPress?: (event: CalendarEvent) => void;
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date
  ) => boolean | void;
  onEventDoctorChange?: (
    event: CalendarEvent,
    newDoctorId: string,
    newStartDate: Date,
    newEndDate: Date
  ) => boolean | void;
  onEventResize?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date
  ) => boolean | void;
  onEventEdit?: (
    event: CalendarEvent,
    changes: CalendarEventEditChanges
  ) => void;
  /**
   * Reassign the appointment to a different patient. Wired separately from
   * {@link onEventEdit} since the visit edit patch handles it as a special move
   * (it re-points the visit's invoice and recomputes both patients). The name is
   * passed through for optimistic display.
   */
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
  onFullScreenToggle?: () => void;
  isFullScreen?: boolean;
  showViewSwitcher?: boolean;
  showDateNavigator?: boolean;
  showFullScreenButton?: boolean;
  showCountSection?: boolean;
  countValue?: number;
  countLabel?: string;
  patientsCount?: number;
  showCalendarWhenNoPatients?: boolean;
  showDentistNameInRangeEvents?: boolean;
  highlightedEventIds?: ReadonlySet<CalendarEvent['id']>;
  scrollToCurrentTimeKey?: string | number;
}

export interface BigCalendarPropsHook {
  events: CalendarEvent[];
  users: CalendarUser[];
  doctors?: CalendarDoctor[];
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  rangeDays?: RangeDays;
  defaultRangeDays?: RangeDays;
  onRangeDaysChange?: (rangeDays: RangeDays) => void;
  selectedDate?: Date;
  defaultSelectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
  selectedUserId?: string | 'all';
  defaultSelectedUserId?: string | 'all';
  onSelectedUserIdChange?: (userId: string | 'all') => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  visibleHours?: VisibleHours;
  workingHours?: WorkingHours;
}

export interface CalendarEventWithPosition extends CalendarEvent {
  position: number;
}
