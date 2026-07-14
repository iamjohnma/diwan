import { useCallback } from 'react';
import { parseISO } from 'date-fns';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import {
  calculateSnappedMoveMinutes,
  calculateSnappedResizeMinutes,
  calculateSnappedResizeTopMinutes,
  snapRawMinutes
} from '@/utils/common/big-calendar';

/**
 * The three snapped-minute calculators every drag surface needs (move,
 * bottom-edge resize, top-edge resize), memoized against the current zoom.
 * Callers that need extra clamping (working hours, collision clamps) layer it
 * on top of these base values.
 */
export function useSnapMinuteCalculators(pixelsPerHour: number) {
  const calculateMoveMinutes = useCallback(
    (deltaY: number, originalStartDate: Date) =>
      calculateSnappedMoveMinutes(deltaY, originalStartDate, pixelsPerHour),
    [pixelsPerHour]
  );

  const calculateResizeMinutes = useCallback(
    (deltaY: number, event: CalendarEvent | null) => {
      if (!event) return snapRawMinutes(deltaY, pixelsPerHour);

      return calculateSnappedResizeMinutes(
        deltaY,
        parseISO(event.endDate),
        parseISO(event.startDate),
        pixelsPerHour
      );
    },
    [pixelsPerHour]
  );

  const calculateResizeTopMinutes = useCallback(
    (deltaY: number, event: CalendarEvent | null) => {
      if (!event) return snapRawMinutes(deltaY, pixelsPerHour);

      return calculateSnappedResizeTopMinutes(
        deltaY,
        parseISO(event.startDate),
        parseISO(event.endDate),
        pixelsPerHour
      );
    },
    [pixelsPerHour]
  );

  return {
    calculateMoveMinutes,
    calculateResizeMinutes,
    calculateResizeTopMinutes
  };
}
