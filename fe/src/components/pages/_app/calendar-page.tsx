import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircleIcon,
  ClockIcon,
  TrashIcon,
  XIcon
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type {
  CalendarEvent,
  CalendarEventEditChanges,
  CalendarView,
  RangeDays
} from '@/@types/common/big-calendar';
import { BigCalendar } from '@/components/common/big-calendar/big-calendar';
import {
  Button,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import {
  MOCK_CALENDAR_BRANCHES,
  MOCK_CALENDAR_LAWYERS,
  MOCK_CALENDAR_USERS,
  buildMockCalendarEvents
} from '@/constants/pages/_app/mock-calendar';
import { useDocumentTitle } from '@/hooks/core';

const WORKING_HOURS = Object.fromEntries(
  Array.from({ length: 7 }, (_, day) => [day, { from: 8, to: 18 }])
);

interface EventEditorProps {
  event: CalendarEvent;
  onClose: () => void;
  onChange: (changes: Partial<CalendarEvent>) => void;
  onDelete: () => void;
}

function EventEditor(props: EventEditorProps) {
  const translation = useTranslation();
  const dateLocale =
    translation.i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US';
  const dateFormatter = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit'
  });

  return createPortal(
    <section
      aria-label={translation.t('calendarPage.eventDetails')}
      className="fixed inset-x-4 top-20 z-70 flex max-w-sm flex-col overflow-hidden rounded-xl border border-border-default bg-background-surface shadow-xs md:start-auto md:end-6 md:w-full"
    >
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-text-tertiary">
            {translation.t('calendarPage.eventDetails')}
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">
            {dateFormatter.format(new Date(props.event.startDate))}
          </p>
        </div>
        <IconButton
          aria-label={translation.t('calendarPage.close')}
          icon={XIcon}
          size="equal"
          variant="ghost"
          tooltip={translation.t('calendarPage.close')}
          onClick={props.onClose}
        />
      </div>
      <div className="flex flex-col gap-4 p-4">
        <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
          {translation.t('calendarPage.clientOrCase')}
          <input
            className="h-10 rounded-lg border border-border-default bg-background-base px-3 text-sm text-text-primary outline-none focus:border-primary"
            value={props.event.patientName}
            onChange={(event) =>
              props.onChange({ patientName: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
          {translation.t('calendarPage.appointmentType')}
          <input
            className="h-10 rounded-lg border border-border-default bg-background-base px-3 text-sm text-text-primary outline-none focus:border-primary"
            value={props.event.visitType ?? ''}
            onChange={(event) =>
              props.onChange({ visitType: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
          {translation.t('calendarPage.assignedLawyer')}
          <Select
            value={props.event.dentistId}
            onValueChange={(value) => {
              const lawyer = MOCK_CALENDAR_LAWYERS.find(
                (candidate) => candidate.id === value
              );
              if (!lawyer) return;
              props.onChange({
                dentistId: lawyer.id,
                user: {
                  id: lawyer.id,
                  name: lawyer.name,
                  picturePath: lawyer.avatar
                }
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {MOCK_CALENDAR_LAWYERS.find(
                  (lawyer) => lawyer.id === props.event.dentistId
                )?.name ?? props.event.user.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MOCK_CALENDAR_LAWYERS.map((lawyer) => (
                <SelectItem
                  key={lawyer.id}
                  value={lawyer.id}
                  itemLabel={lawyer.name}
                >
                  {lawyer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-text-secondary">
          {translation.t('calendarPage.notes')}
          <textarea
            className="min-h-20 resize-none rounded-lg border border-border-default bg-background-base px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
            value={props.event.description}
            onChange={(event) =>
              props.onChange({ description: event.target.value })
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={props.event.patientArrived ? 'primary' : 'outline'}
            prefixIcon={CheckCircleIcon}
            onClick={() =>
              props.onChange({ patientArrived: !props.event.patientArrived })
            }
          >
            {props.event.patientArrived
              ? translation.t('calendarPage.arrived')
              : translation.t('calendarPage.markArrived')}
          </Button>
          <Button
            variant={props.event.isLate ? 'secondary' : 'outline'}
            prefixIcon={ClockIcon}
            onClick={() => props.onChange({ isLate: !props.event.isLate })}
          >
            {props.event.isLate
              ? translation.t('calendarPage.late')
              : translation.t('calendarPage.markLate')}
          </Button>
        </div>
      </div>
      <div className="border-t border-border-default p-3">
        <Button
          className="w-full"
          variant="destructive"
          prefixIcon={TrashIcon}
          onClick={props.onDelete}
        >
          {translation.t('calendarPage.deleteAppointment')}
        </Button>
      </div>
    </section>,
    document.body
  );
}

export function CalendarPage() {
  const translation = useTranslation();
  useDocumentTitle(translation.t('calendarPage.title'));
  const nextEventIdRef = useRef(1);
  const [events, setEvents] = useState<CalendarEvent[]>(
    buildMockCalendarEvents
  );
  const [view, setView] = useState<CalendarView>('doctor');
  const [rangeDays, setRangeDays] = useState<RangeDays>(3);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [branchScope, setBranchScope] = useState('all');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [focusedLawyerId, setFocusedLawyerId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<
    CalendarEvent['id'] | null
  >(null);

  const visibleEvents = useMemo(
    () =>
      branchScope === 'all'
        ? events
        : events.filter((event) => event.branchId === branchScope),
    [branchScope, events]
  );
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const patchEvent = (
    eventId: CalendarEvent['id'],
    changes: Partial<CalendarEvent>
  ) => {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, ...changes } : event
      )
    );
  };

  const handleEventTimeChange = (
    event: CalendarEvent,
    startDate: Date,
    endDate: Date
  ) => {
    patchEvent(event.id, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
  };

  const handleEventEdit = (
    event: CalendarEvent,
    changes: CalendarEventEditChanges
  ) => {
    const lawyer = changes.dentistId
      ? MOCK_CALENDAR_LAWYERS.find(
          (candidate) => candidate.id === changes.dentistId
        )
      : undefined;
    patchEvent(event.id, {
      ...(changes.startDate
        ? { startDate: changes.startDate.toISOString() }
        : {}),
      ...(changes.endDate ? { endDate: changes.endDate.toISOString() } : {}),
      ...(changes.notes === undefined ? {} : { description: changes.notes }),
      ...(changes.visitType === undefined
        ? {}
        : { visitType: changes.visitType }),
      ...(changes.branchId ? { branchId: changes.branchId } : {}),
      ...(lawyer
        ? {
            dentistId: lawyer.id,
            user: {
              id: lawyer.id,
              name: lawyer.name,
              picturePath: lawyer.avatar
            }
          }
        : {})
    });
  };

  const createEvent = (startDate: Date, endDate: Date, lawyerId?: string) => {
    const lawyer =
      MOCK_CALENDAR_LAWYERS.find((candidate) => candidate.id === lawyerId) ??
      MOCK_CALENDAR_LAWYERS[0];
    if (!lawyer) return;
    const id = `mock-new-${nextEventIdRef.current++}`;
    const newEvent: CalendarEvent = {
      id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      patientName: translation.t('calendarPage.newAppointment'),
      title: translation.t('calendarPage.newAppointment'),
      visitType: translation.t('calendarPage.defaultVisitType'),
      color: 'blue',
      description: '',
      dentistId: lawyer.id,
      branchId: branchScope === 'all' ? 'ramallah' : branchScope,
      status: 'scheduled',
      user: { id: lawyer.id, name: lawyer.name, picturePath: lawyer.avatar }
    };
    setEvents((current) => [...current, newEvent]);
    setSelectedEventId(id);
  };

  const createFromSlot = (
    date: Date,
    hour: number,
    minute: number,
    lawyerId?: string
  ) => {
    const startDate = new Date(date);
    startDate.setHours(hour, minute, 0, 0);
    createEvent(
      startDate,
      new Date(startDate.getTime() + 45 * 60_000),
      lawyerId
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background-base">
      <BigCalendar
        events={visibleEvents}
        collisionIntervals={events}
        users={MOCK_CALENDAR_USERS}
        doctors={MOCK_CALENDAR_LAWYERS}
        view={view}
        availableViews={['range', 'month', 'doctor']}
        viewLabels={{
          range: translation.t('calendarPage.viewLabels.range'),
          month: translation.t('calendarPage.viewLabels.month'),
          doctor: translation.t('calendarPage.viewLabels.doctor')
        }}
        onViewChange={setView}
        rangeDays={rangeDays}
        onRangeDaysChange={setRangeDays}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        visibleHours={{ from: 7, to: 20 }}
        workingHours={WORKING_HOURS}
        isFullScreen={isFullScreen}
        onFullScreenToggle={() => setIsFullScreen((current) => !current)}
        focusedDoctorId={focusedLawyerId}
        onFocusedDoctorChange={setFocusedLawyerId}
        onTimeSlotPress={(date, hour, minute) =>
          createFromSlot(date, hour, minute)
        }
        onTimeSlotRangeSelect={(startDate, endDate) =>
          createEvent(startDate, endDate)
        }
        onTimeSlotWithDoctorPress={(date, hour, minute, lawyerId) =>
          createFromSlot(date, hour, minute, lawyerId)
        }
        onTimeSlotRangeWithDoctorSelect={(startDate, endDate, lawyerId) =>
          createEvent(startDate, endDate, lawyerId)
        }
        canCreateInDoctorColumn={() => true}
        onEventPress={(event) => setSelectedEventId(event.id)}
        onEventDrop={handleEventTimeChange}
        onEventResize={handleEventTimeChange}
        onEventEdit={handleEventEdit}
        onEventDoctorChange={(event, lawyerId, startDate, endDate) => {
          const lawyer = MOCK_CALENDAR_LAWYERS.find(
            (candidate) => candidate.id === lawyerId
          );
          if (!lawyer) return false;
          patchEvent(event.id, {
            dentistId: lawyer.id,
            user: {
              id: lawyer.id,
              name: lawyer.name,
              picturePath: lawyer.avatar
            },
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          });
        }}
        onPatientArrivalChange={(event, patientArrived) =>
          patchEvent(event.id, { patientArrived })
        }
        onMarkLateChange={(event, isLate) => patchEvent(event.id, { isLate })}
        onEventsDelete={(deletedEvents) => {
          const deletedIds = new Set(deletedEvents.map((event) => event.id));
          setEvents((current) =>
            current.filter((event) => !deletedIds.has(event.id))
          );
          setSelectedEventId(null);
        }}
        showViewSwitcher
        showFullScreenButton
        showDentistNameInRangeEvents
        branchFilter={{
          value: branchScope,
          onValueChange: setBranchScope,
          branches: MOCK_CALENDAR_BRANCHES
        }}
        countValue={visibleEvents.length}
        countLabel={translation.t('calendarPage.countLabel')}
        patientsCount={events.length}
        showCalendarWhenNoPatients
      />
      {selectedEvent && (
        <EventEditor
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onChange={(changes) => patchEvent(selectedEvent.id, changes)}
          onDelete={() => {
            setEvents((current) =>
              current.filter((event) => event.id !== selectedEvent.id)
            );
            setSelectedEventId(null);
          }}
        />
      )}
    </div>
  );
}
