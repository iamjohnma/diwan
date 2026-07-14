import { memo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { TimeZoneSelector } from '@/components/common/big-calendar/header/time-zone-selector';
import { cn } from '@/utils/common/cn';

interface RangeViewHeaderProps {
  rangeDates: Date[];
  rangeDateKeys: string[];
  todayKey: string;
  gridStyle: React.CSSProperties;
  locale: Locale;
  timeZone: string;
  onTimeZoneChange: (tz: string) => void;
}

export const RangeViewHeader = memo(function RangeViewHeader(
  props: RangeViewHeaderProps
) {
  return (
    <div>
      <div className="relative z-20 flex border-b border-border/80 bg-background">
        <div className="min-w-[60px] w-12 md:w-18 shrink-0">
          <TimeZoneSelector
            value={props.timeZone}
            onChange={props.onTimeZoneChange}
          />
        </div>
        <div className="grid flex-1 divide-x border-s" style={props.gridStyle}>
          {props.rangeDates.map((day, dayIndex) => {
            const dayKey = props.rangeDateKeys[dayIndex];

            return (
              <div
                key={day.toISOString()}
                className="relative py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {format(day, 'EE', { locale: props.locale })}{' '}
                <span
                  className={cn(
                    'ms-1 font-semibold text-foreground',
                    dayKey === props.todayKey &&
                      'rounded bg-(--primary) px-1.5 text-text-inverted'
                  )}
                >
                  {format(day, 'd', { locale: props.locale })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
