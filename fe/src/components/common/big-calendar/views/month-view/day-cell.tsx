import { memo, useCallback, useMemo } from 'react';
import type {
  CalendarCell,
  CalendarEventWithPosition
} from '@/@types/common/big-calendar';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { EventBullet } from '@/components/common/big-calendar/shared/event-bullet';
import { MonthEventBadge } from '@/components/common/big-calendar/shared/month-event-badge';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/common/cn';
import { getDateKeyFromDate } from '@/utils/common/time-zone';

interface DayCellProps {
  cell: CalendarCell;
  events: CalendarEventWithPosition[];
  isFirstColumn: boolean;
  todayKey: string;
  onNavigateToDay: (date: Date) => void;
}

const MAX_VISIBLE_EVENTS = 1;

function areDayCellPropsEqual(previous: DayCellProps, next: DayCellProps) {
  return (
    previous.cell === next.cell &&
    previous.events === next.events &&
    previous.isFirstColumn === next.isFirstColumn &&
    previous.todayKey === next.todayKey &&
    previous.onNavigateToDay === next.onNavigateToDay
  );
}

function CalendarEventBullet(props: {
  event: CalendarEventWithPosition;
  className?: string;
}) {
  const calendar = useCalendarContext();
  const patientArrived = calendar.getEffectivePatientArrived(props.event);
  const isVisitLate = calendar.getEffectiveVisitLate(props.event);
  const showLateGray =
    isVisitLate && !patientArrived && !(props.event.isReadOnly ?? false);
  const derivedColor = useMemo(
    () => (showLateGray ? 'gray' : props.event.color),
    [showLateGray, props.event.color]
  );

  return <EventBullet className={props.className} color={derivedColor} />;
}

export const DayCell = memo(function DayCell(props: DayCellProps) {
  const { t } = useTranslation();
  const { day, currentMonth, date } = props.cell;

  const isTodayCell = useMemo(
    () => getDateKeyFromDate(date) === props.todayKey,
    [date, props.todayKey]
  );

  const handleCellClick = useCallback(() => {
    props.onNavigateToDay(date);
  }, [props.onNavigateToDay, date]);

  const handleNavigateToDay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      props.onNavigateToDay(date);
    },
    [props.onNavigateToDay, date]
  );

  const hiddenEventsCount = Math.max(
    0,
    props.events.length - MAX_VISIBLE_EVENTS
  );

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={handleCellClick}
      className={cn(
        'group relative flex h-[139px] flex-col gap-1 border-s border-t py-1.5 lg:pb-2 lg:pt-1',
        props.isFirstColumn && 'border-s-0',
        'cursor-pointer transition-colors hover:bg-accent/40'
      )}
    >
      <button
        onClick={handleNavigateToDay}
        className={cn(
          'relative z-10 flex size-6 translate-x-1 items-center justify-center rounded-full text-xs font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:px-2 rtl:-translate-x-1',
          !currentMonth && 'opacity-20',
          isTodayCell &&
            'bg-primary font-bold text-primary-foreground hover:bg-primary'
        )}
      >
        {day}
      </button>
      <div
        className={cn(
          'flex h-6 gap-1 px-2 lg:flex-1 lg:flex-col lg:gap-2 lg:px-0',
          !currentMonth && 'opacity-50'
        )}
      >
        {Array.from({ length: MAX_VISIBLE_EVENTS }).map((_, position) => {
          const event = props.events.find((e) => e.position === position);
          const eventKey = event
            ? `event-${event.id}-${position}`
            : `empty-${position}`;

          return (
            <div key={eventKey} className="lg:flex-1">
              {event && (
                <div data-calendar-pan-skip className="contents">
                  <CalendarEventBullet className="lg:hidden" event={event} />
                  <MonthEventBadge
                    className="hidden lg:flex"
                    event={event}
                    variant="month-cell"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hiddenEventsCount > 0 && (
        <button
          type="button"
          onClick={handleNavigateToDay}
          className={cn(
            'relative z-10 h-4.5 w-full px-1.5 text-xs font-semibold text-muted-foreground rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            !currentMonth && 'opacity-50'
          )}
        >
          <span className="sm:hidden">+{hiddenEventsCount}</span>
          <span className="hidden sm:inline">
            {t('bigCalendar.monthView.more', { count: hiddenEventsCount })}
          </span>
        </button>
      )}
    </div>
  );
}, areDayCellPropsEqual);
