import type { MinuteWindow } from '@/@types/common/utils/big-calendar-virtualization';
import { DEFAULT_PIXELS_PER_HOUR } from '@/constants/common/big-calendar';

export type { MinuteWindow } from '@/@types/common/utils/big-calendar-virtualization';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export { EVENT_WINDOW_OVERSCAN_MINUTES } from '@/constants/common/big-calendar';

export function getVisibleMinuteWindow(
  scrollTop: number,
  viewportHeight: number,
  earliestEventHour: number,
  overscanMinutes: number,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR
): MinuteWindow {
  if (viewportHeight <= 0) {
    return { start: 0, end: MINUTES_PER_DAY };
  }

  const safeScrollTop = Math.max(0, scrollTop);
  const safeOverscan = Math.max(0, overscanMinutes);

  const visibleStartMinutes =
    earliestEventHour * MINUTES_PER_HOUR +
    (safeScrollTop / pixelsPerHour) * MINUTES_PER_HOUR;
  const visibleEndMinutes =
    earliestEventHour * MINUTES_PER_HOUR +
    ((safeScrollTop + viewportHeight) / pixelsPerHour) * MINUTES_PER_HOUR;

  return {
    start: Math.max(0, Math.floor(visibleStartMinutes - safeOverscan)),
    end: Math.min(MINUTES_PER_DAY, Math.ceil(visibleEndMinutes + safeOverscan))
  };
}

export function eventIntersectsMinuteWindow(
  startMinutes: number,
  endMinutes: number,
  windowStart: number,
  windowEnd: number
): boolean {
  const normalizedEnd =
    endMinutes > startMinutes ? endMinutes : startMinutes + 1;

  return startMinutes < windowEnd && normalizedEnd > windowStart;
}
