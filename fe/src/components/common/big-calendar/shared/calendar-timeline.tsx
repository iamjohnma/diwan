import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentTime } from '@/hooks/common/current-time';
import { cn } from '@/utils/common/cn';
import {
  formatTimeInTimeZone,
  getDateKeyInTimeZone,
  getTimePartsInTimeZone
} from '@/utils/common/time-zone';

interface CalendarTimelineProps {
  firstVisibleHour: number;
  lastVisibleHour: number;
  days?: Date[];
  timeZone?: string;
  markerStickyOffsetPx?: number | string;
  lineStickyOffsetPx?: number | string;
}

function getOffsetCssValue(offset: number | string) {
  return typeof offset === 'number' ? `${offset}px` : offset;
}

export const CalendarTimeline = memo(function CalendarTimeline(
  props: CalendarTimelineProps
) {
  const { i18n } = useTranslation();
  const currentTime = useCurrentTime();
  const locale = i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US';
  const currentTimeParts = getTimePartsInTimeZone(currentTime, props.timeZone);
  const todayKey = getDateKeyInTimeZone(currentTime, props.timeZone);

  const getCurrentTimePosition = () => {
    const minutes = currentTimeParts.hour * 60 + currentTimeParts.minute;
    const visibleStartMinutes = props.firstVisibleHour * 60;
    const visibleEndMinutes = props.lastVisibleHour * 60;
    const visibleRangeMinutes = visibleEndMinutes - visibleStartMinutes;

    return ((minutes - visibleStartMinutes) / visibleRangeMinutes) * 100;
  };

  const formatCurrentTime = () =>
    formatTimeInTimeZone(currentTime, props.timeZone, locale);

  const days = props.days?.length ? props.days : [currentTime];

  const currentHour = currentTimeParts.hour;
  if (
    currentHour < props.firstVisibleHour ||
    currentHour >= props.lastVisibleHour
  )
    return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0"
      style={{ top: `${getCurrentTimePosition()}%` }}
    >
      <div
        className="sticky start-0 z-[16] flex w-0 shrink-0"
        style={
          props.markerStickyOffsetPx !== undefined
            ? {
                insetInlineStart: getOffsetCssValue(props.markerStickyOffsetPx)
              }
            : undefined
        }
      >
        <div className="pointer-events-none absolute start-0 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary rtl:translate-x-1/2" />
        <div className="pointer-events-none absolute end-full top-1/2 me-0.5 -translate-y-1/2 whitespace-nowrap rounded bg-primary px-1 py-0.5 text-[10px] font-medium leading-none text-[var(--text-inverted)] md:me-2 md:px-1.5 md:text-xs md:leading-normal">
          {formatCurrentTime()}
        </div>
      </div>
      <div
        className="pointer-events-none absolute top-0 z-[11] grid h-0 min-w-0"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          insetInlineStart:
            props.lineStickyOffsetPx !== undefined
              ? getOffsetCssValue(props.lineStickyOffsetPx)
              : 0,
          insetInlineEnd: 0
        }}
      >
        {days.map((day) => {
          const isTodayCell =
            getDateKeyInTimeZone(day, props.timeZone) === todayKey;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'pointer-events-none h-0',
                isTodayCell
                  ? 'border-t-2 border-[color:var(--primary)]'
                  : 'border-t border-[color:var(--primary)] opacity-40'
              )}
            />
          );
        })}
      </div>
    </div>
  );
});
