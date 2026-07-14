import { createContext, useContext } from 'react';
import type {
  CalendarContextValue,
  CalendarDragStateContextValue
} from '@/@types/common/components/big-calendar/calendar-context';

export type { CalendarContextValue } from '@/@types/common/components/big-calendar/calendar-context';

export const CalendarContext = createContext<CalendarContextValue | null>(null);
export const CalendarDragStateContext =
  createContext<CalendarDragStateContextValue | null>(null);

export function useCalendarContext(): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error(
      'useCalendarContext must be used within a CalendarProvider'
    );
  }

  return context;
}

export function useCalendarDragState(): CalendarDragStateContextValue {
  const context = useContext(CalendarDragStateContext);
  if (!context) {
    throw new Error(
      'useCalendarDragState must be used within a CalendarProvider'
    );
  }

  return context;
}
