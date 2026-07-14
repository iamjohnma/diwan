import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BigCalendarPropsHook,
  CalendarDoctor,
  CalendarEvent,
  CalendarUser,
  CalendarView,
  RangeDays,
  VisibleHours,
  WorkingHours
} from '@/@types/common/big-calendar';
import {
  buildCalendarPreferencesUpdate,
  scheduleUserPreferencesUpdate
} from '@/lib/convex/user-preferences-sync';
import { useUserPreferencesStore } from '@/stores/user-preferences';
import {
  DEFAULT_VISIBLE_HOURS,
  DEFAULT_WORKING_HOURS,
  filterEventsByView,
  navigateDate
} from '@/utils/common/big-calendar';
import { getSystemTimeZone } from '@/utils/common/time-zone';

export interface BigCalendarResultHook {
  view: CalendarView;
  setView: (view: CalendarView) => void;
  rangeDays: RangeDays;
  setRangeDays: (rangeDays: RangeDays) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date | undefined) => void;
  selectedUserId: string | 'all';
  setSelectedUserId: (userId: string | 'all') => void;
  filteredEvents: CalendarEvent[];
  users: CalendarUser[];
  doctors: CalendarDoctor[];
  events: CalendarEvent[];
  workingHours: WorkingHours;
  visibleHours: VisibleHours;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  timeZone: string;
  setTimeZone: (timeZone: string) => void;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
}

function syncCalendarPreferences() {
  scheduleUserPreferencesUpdate(
    buildCalendarPreferencesUpdate(useUserPreferencesStore.getState().calendar)
  );
}

function patchField<T>(
  controlled: T | undefined,
  setInternal: (value: T) => void,
  value: T,
  options?: {
    onChange?: (value: T) => void;
    setStored?: (value: T) => void;
    persist?: boolean;
  }
) {
  if (controlled === undefined) setInternal(value);
  options?.setStored?.(value);
  if (options?.persist) syncCalendarPreferences();
  options?.onChange?.(value);
}

export function useBigCalendar(
  props: BigCalendarPropsHook
): BigCalendarResultHook {
  const storedPreferences = useUserPreferencesStore((state) => state.calendar);
  const setStoredView = useUserPreferencesStore(
    (state) => state.setCalendarView
  );
  const setStoredRangeDays = useUserPreferencesStore(
    (state) => state.setCalendarRangeDays
  );
  const setStoredTimeZone = useUserPreferencesStore(
    (state) => state.setCalendarTimeZone
  );

  const [internalView, setInternalView] = useState<CalendarView>(
    () => props.defaultView ?? storedPreferences.view
  );
  const [internalRangeDays, setInternalRangeDays] = useState<RangeDays>(
    () => props.defaultRangeDays ?? storedPreferences.rangeDays
  );
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(
    () => props.defaultSelectedDate ?? new Date()
  );
  const [internalSelectedUserId, setInternalSelectedUserId] = useState<
    string | 'all'
  >(() => props.defaultSelectedUserId ?? 'all');
  const [systemTimeZone, setSystemTimeZone] = useState(getSystemTimeZone);

  const view = props.view ?? internalView;
  const rangeDays = props.rangeDays ?? internalRangeDays;
  const selectedDate = props.selectedDate ?? internalSelectedDate;
  const selectedUserId = props.selectedUserId ?? internalSelectedUserId;
  const weekStartsOn = props.weekStartsOn ?? 0;
  const timeZone =
    storedPreferences.timeZoneMode === 'manual'
      ? storedPreferences.timeZone
      : systemTimeZone;

  useEffect(() => {
    const syncSystemTimeZone = () => {
      const nextTimeZone = getSystemTimeZone();
      setSystemTimeZone((current) =>
        current === nextTimeZone ? current : nextTimeZone
      );
    };

    syncSystemTimeZone();
    window.addEventListener('focus', syncSystemTimeZone);
    document.addEventListener('visibilitychange', syncSystemTimeZone);
    const intervalId = window.setInterval(syncSystemTimeZone, 60_000);

    return () => {
      window.removeEventListener('focus', syncSystemTimeZone);
      document.removeEventListener('visibilitychange', syncSystemTimeZone);
      window.clearInterval(intervalId);
    };
  }, []);

  const setView = useCallback(
    (newView: CalendarView) =>
      patchField(props.view, setInternalView, newView, {
        setStored: setStoredView,
        persist: true,
        onChange: props.onViewChange
      }),
    [props.view, props.onViewChange, setStoredView]
  );

  const setRangeDays = useCallback(
    (newRangeDays: RangeDays) =>
      patchField(props.rangeDays, setInternalRangeDays, newRangeDays, {
        setStored: setStoredRangeDays,
        persist: true,
        onChange: props.onRangeDaysChange
      }),
    [props.rangeDays, props.onRangeDaysChange, setStoredRangeDays]
  );

  const setSelectedDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      patchField(props.selectedDate, setInternalSelectedDate, date, {
        onChange: props.onSelectedDateChange
      });
    },
    [props.selectedDate, props.onSelectedDateChange]
  );

  const setSelectedUserId = useCallback(
    (userId: string | 'all') =>
      patchField(props.selectedUserId, setInternalSelectedUserId, userId, {
        onChange: props.onSelectedUserIdChange
      }),
    [props.selectedUserId, props.onSelectedUserIdChange]
  );

  const setTimeZone = useCallback(
    (nextTimeZone: string) => {
      if (!nextTimeZone) return;
      const currentSystemTimeZone = getSystemTimeZone();
      const nextMode =
        nextTimeZone === currentSystemTimeZone ? 'system' : 'manual';

      setStoredTimeZone(nextTimeZone, nextMode);
      syncCalendarPreferences();
      if (nextMode === 'system') setSystemTimeZone(currentSystemTimeZone);
    },
    [setStoredTimeZone]
  );

  const filteredEvents = useMemo(
    () =>
      filterEventsByView(
        props.events,
        selectedDate,
        selectedUserId,
        view,
        weekStartsOn,
        rangeDays,
        timeZone
      ),
    [
      props.events,
      rangeDays,
      selectedDate,
      selectedUserId,
      timeZone,
      view,
      weekStartsOn
    ]
  );

  const goToToday = useCallback(
    () => setSelectedDate(new Date()),
    [setSelectedDate]
  );
  const goToPrevious = useCallback(
    () =>
      setSelectedDate(navigateDate(selectedDate, view, 'previous', rangeDays)),
    [selectedDate, view, rangeDays, setSelectedDate]
  );
  const goToNext = useCallback(
    () => setSelectedDate(navigateDate(selectedDate, view, 'next', rangeDays)),
    [selectedDate, view, rangeDays, setSelectedDate]
  );

  return {
    view,
    setView,
    rangeDays,
    setRangeDays,
    selectedDate,
    setSelectedDate,
    selectedUserId,
    setSelectedUserId,
    filteredEvents,
    users: props.users,
    doctors: props.doctors ?? [],
    events: props.events,
    workingHours: props.workingHours ?? DEFAULT_WORKING_HOURS,
    visibleHours: props.visibleHours ?? DEFAULT_VISIBLE_HOURS,
    weekStartsOn,
    timeZone,
    setTimeZone,
    goToToday,
    goToPrevious,
    goToNext
  };
}
