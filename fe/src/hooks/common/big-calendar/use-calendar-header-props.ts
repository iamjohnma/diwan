import { useMemo } from 'react';
import type {
  BigCalendarProps,
  CalendarEvent,
  CalendarView
} from '@/@types/common/big-calendar';
import type { CalendarHeaderProps } from '@/components/common/big-calendar/header/calendar-header';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar/big-calendar';
import type { useEventSelection } from '@/hooks/common/big-calendar/event-selection';

interface UseCalendarHeaderPropsOptions {
  props: BigCalendarProps;
  calendarState: BigCalendarResultHook;
  filteredEvents: CalendarEvent[];
  eventSelection: ReturnType<typeof useEventSelection>;
  availableViews: readonly CalendarView[];
}

export function useCalendarHeaderProps(
  options: UseCalendarHeaderPropsOptions
): CalendarHeaderProps {
  const {
    props,
    calendarState,
    filteredEvents,
    eventSelection,
    availableViews
  } = options;

  return useMemo<CalendarHeaderProps>(
    () => ({
      events: filteredEvents,
      selectedEventIds: eventSelection.selectedEventIds,
      deleteSelectedEvents: eventSelection.deleteSelectedEvents,
      onEventsDelete: props.onEventsDelete,
      showCountSection: props.showCountSection,
      countValue: props.countValue,
      countLabel: props.countLabel,
      headerClassName: props.classNames?.header,
      isFullScreen: props.isFullScreen,
      showDateNavigator: props.showDateNavigator ?? true,
      showViewSwitcher: props.showViewSwitcher ?? true,
      showFullScreenButton: props.showFullScreenButton ?? false,
      renderHeaderActions: props.renderers?.renderHeaderActions,
      branchFilter: props.branchFilter,
      dateNavigatorProps: {
        view: calendarState.view,
        selectedDate: calendarState.selectedDate,
        weekStartsOn: calendarState.weekStartsOn,
        rangeDays: calendarState.rangeDays,
        setSelectedDate: calendarState.setSelectedDate,
        goToPrevious: calendarState.goToPrevious,
        goToNext: calendarState.goToNext
      },
      rangeDaysSelectProps: {
        view: calendarState.view,
        rangeDays: calendarState.rangeDays,
        setRangeDays: calendarState.setRangeDays
      },
      viewSwitcherProps: {
        view: calendarState.view,
        setView: calendarState.setView,
        availableViews,
        viewLabels: props.viewLabels
      },
      fullScreenButtonProps: {
        isFullScreen: props.isFullScreen,
        onFullScreenToggle: props.onFullScreenToggle
      }
    }),
    [
      filteredEvents,
      eventSelection.selectedEventIds,
      eventSelection.deleteSelectedEvents,
      props.onEventsDelete,
      props.showCountSection,
      props.countValue,
      props.countLabel,
      props.classNames?.header,
      props.isFullScreen,
      props.showDateNavigator,
      props.showViewSwitcher,
      props.showFullScreenButton,
      props.renderers,
      props.branchFilter,
      props.onFullScreenToggle,
      props.viewLabels,
      calendarState.view,
      calendarState.selectedDate,
      calendarState.weekStartsOn,
      calendarState.rangeDays,
      calendarState.setSelectedDate,
      calendarState.goToPrevious,
      calendarState.goToNext,
      calendarState.setRangeDays,
      calendarState.setView,
      availableViews
    ]
  );
}
