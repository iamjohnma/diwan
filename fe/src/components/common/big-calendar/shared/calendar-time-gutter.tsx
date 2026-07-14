import { memo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { TIME_COLUMN_WIDTH } from '@/constants/common/big-calendar';
import { cn } from '@/utils/common/cn';

interface CalendarTimeGutterProps {
  hours: number[];
  pixelsPerHour: number;
  totalRowsHeight: number;
  locale: Locale;
  variant?: 'doctor' | 'range';
  columnWidth?: number;
}

export const CalendarTimeGutter = memo(function CalendarTimeGutter(
  props: CalendarTimeGutterProps
) {
  const variant = props.variant ?? 'range';
  const isDoctor = variant === 'doctor';
  const columnWidth = props.columnWidth ?? TIME_COLUMN_WIDTH;
  const hourFormat = isDoctor ? 'h a' : 'hh a';

  const hourRows = (
    <div className="relative" style={{ height: `${props.totalRowsHeight}px` }}>
      {props.hours.map((hour, hourIndex) => (
        <div
          key={hour}
          className="absolute inset-x-0"
          style={{
            height: `${props.pixelsPerHour}px`,
            transform: `translateY(${hourIndex * props.pixelsPerHour}px)`
          }}
        >
          <div
            className={cn(
              'absolute flex items-center',
              isDoctor
                ? '-top-2.5 inset-x-0 z-0 h-5 justify-center'
                : '-top-3 end-1 md:end-2 h-6'
            )}
          >
            {hourIndex !== 0 && (
              <span
                className={cn(
                  isDoctor
                    ? 'text-[10px] leading-none text-text-secondary md:text-xs'
                    : 'text-xs text-muted-foreground'
                )}
              >
                {format(new Date().setHours(hour, 0, 0, 0), hourFormat, {
                  locale: props.locale
                })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (isDoctor) {
    return (
      <div
        className="sticky start-0 z-[12] shrink-0 border-e bg-background"
        style={{ width: `${columnWidth}px` }}
      >
        {hourRows}
      </div>
    );
  }

  return (
    <div
      className="relative min-w-[60px] w-12 md:w-18 shrink-0"
      style={{ height: `${props.totalRowsHeight}px` }}
    >
      {hourRows}
    </div>
  );
});
