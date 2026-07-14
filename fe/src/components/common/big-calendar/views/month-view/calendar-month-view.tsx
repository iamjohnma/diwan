import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import type { CalendarEventWithPosition } from '@/@types/common/big-calendar';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { DayCell } from '@/components/common/big-calendar/views/month-view/day-cell';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import {
  getCalendarCells,
  getMonthCellEvents
} from '@/utils/common/big-calendar';
import { cn } from '@/utils/common/cn';
import {
  getDateKeyFromDate,
  getDateKeyInTimeZone
} from '@/utils/common/time-zone';

const EMPTY_CELL_EVENTS: CalendarEventWithPosition[] = [];
const EMPTY_EVENTS_BY_CELL_KEY = new Map<string, CalendarEventWithPosition[]>();

function CalendarMonthViewInner() {
  const { i18n } = useTranslation();
  const calendar = useCalendarContext();

  const locale = i18n.language === 'ar' ? ar : enUS;
  const selectedTimeZone = calendar.timeZone;

  const cells = useMemo(
    () => getCalendarCells(calendar.selectedDate, calendar.weekStartsOn),
    [calendar.selectedDate, calendar.weekStartsOn]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), {
      weekStartsOn: calendar.weekStartsOn
    });

    return Array.from({ length: 7 }).map((_, i) =>
      format(addDays(start, i), 'EEEE', { locale })
    );
  }, [calendar.weekStartsOn, locale]);

  const todayKey = useMemo(
    () => getDateKeyInTimeZone(new Date(), selectedTimeZone),
    [selectedTimeZone]
  );

  const eventsByCellKey = useMemo(() => {
    const result = new Map<string, CalendarEventWithPosition[]>();
    for (const cell of cells) {
      const key = getDateKeyFromDate(cell.date);
      const cellEvents = getMonthCellEvents(
        cell.date,
        calendar.filteredEvents,
        selectedTimeZone
      );
      if (cellEvents.length > 0) {
        result.set(key, cellEvents);
      }
    }

    return result;
  }, [cells, calendar.filteredEvents, selectedTimeZone]);

  const [hasFirstPainted, setHasFirstPainted] = useState(false);
  useEffect(() => {
    setHasFirstPainted(true);
  }, []);
  const eventsByCellKeyForGrid = hasFirstPainted
    ? eventsByCellKey
    : EMPTY_EVENTS_BY_CELL_KEY;

  const navigateToDay = useCallback(
    (date: Date) => {
      calendar.setSelectedDate(date);
      if (calendar.dayDrillDownView === 'range') {
        calendar.setRangeDays(1);
      }
      calendar.setView(calendar.dayDrillDownView);
    },
    [
      calendar.dayDrillDownView,
      calendar.setSelectedDate,
      calendar.setRangeDays,
      calendar.setView
    ]
  );

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden',
        calendar.classNames?.monthView
      )}
    >
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              'flex items-center justify-center border-s py-2',
              index === 0 && 'border-s-0'
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {day}
            </span>
          </div>
        ))}
      </div>
      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            const cellKey = getDateKeyFromDate(cell.date);

            return (
              <DayCell
                key={cell.date.toISOString()}
                cell={cell}
                events={
                  eventsByCellKeyForGrid.get(cellKey) ?? EMPTY_CELL_EVENTS
                }
                isFirstColumn={index % 7 === 0}
                todayKey={todayKey}
                onNavigateToDay={navigateToDay}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export const CalendarMonthView = memo(CalendarMonthViewInner);
