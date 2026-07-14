import {
  CALENDAR_ZOOM_MAX,
  CALENDAR_ZOOM_MIN,
  CALENDAR_ZOOM_STEPS
} from '@/constants/common/big-calendar';

export {
  CALENDAR_ZOOM_MAX,
  CALENDAR_ZOOM_MIN,
  CALENDAR_ZOOM_STEP,
  CALENDAR_ZOOM_STEPS
} from '@/constants/common/big-calendar';

function clampCalendarZoom(value: number): number {
  return Math.min(CALENDAR_ZOOM_MAX, Math.max(CALENDAR_ZOOM_MIN, value));
}

export function snapCalendarZoom(value: number): number {
  const clamped = clampCalendarZoom(value);

  return CALENDAR_ZOOM_STEPS.reduce((closest, step) =>
    Math.abs(clamped - step) < Math.abs(clamped - closest) ? step : closest
  );
}

export function getAdjacentCalendarZoom(
  current: number,
  direction: 'in' | 'out'
): number {
  const snappedCurrent = snapCalendarZoom(current);
  const currentIndex = (CALENDAR_ZOOM_STEPS as readonly number[]).indexOf(
    snappedCurrent
  );
  if (currentIndex < 0) {
    return snappedCurrent;
  }

  const nextIndex =
    direction === 'in'
      ? Math.min(currentIndex + 1, CALENDAR_ZOOM_STEPS.length - 1)
      : Math.max(currentIndex - 1, 0);

  return CALENDAR_ZOOM_STEPS[nextIndex] ?? snappedCurrent;
}
