import { useMemo } from 'react';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar/big-calendar';
import type { useCalendarDragHandlers } from '@/hooks/common/big-calendar/calendar-drag-handlers';
import { filterEventsByView } from '@/utils/common/big-calendar';

interface UseCalendarEventsWithOverridesProps {
  calendarState: BigCalendarResultHook;
  dragHandlers: ReturnType<typeof useCalendarDragHandlers>;
}

export function useCalendarEventsWithOverrides(
  props: UseCalendarEventsWithOverridesProps
) {
  const { calendarState, dragHandlers } = props;
  const hasPendingOverrides =
    dragHandlers.pendingMoves.size > 0 || dragHandlers.pendingResizes.size > 0;

  const events = useMemo(() => {
    if (!hasPendingOverrides) {
      return calendarState.events;
    }

    return calendarState.events.map(dragHandlers.applyPendingOverrides);
  }, [
    calendarState.events,
    dragHandlers.applyPendingOverrides,
    hasPendingOverrides
  ]);

  const filteredEvents = useMemo(() => {
    if (!hasPendingOverrides) {
      return calendarState.filteredEvents;
    }

    return filterEventsByView(
      events,
      calendarState.selectedDate,
      calendarState.selectedUserId,
      calendarState.view,
      calendarState.weekStartsOn,
      calendarState.rangeDays,
      calendarState.timeZone
    );
  }, [
    calendarState.filteredEvents,
    calendarState.rangeDays,
    calendarState.selectedDate,
    calendarState.selectedUserId,
    calendarState.timeZone,
    calendarState.view,
    calendarState.weekStartsOn,
    events,
    hasPendingOverrides
  ]);

  return { events, filteredEvents };
}
