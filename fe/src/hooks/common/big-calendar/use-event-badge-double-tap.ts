import type { CalendarEvent } from '@/@types/common/big-calendar';

const handleClickCapture = () => undefined;
const cancelPendingPress = () => undefined;

export function useEventBadgeDoubleTap(_event: CalendarEvent) {
  return {
    isEnabled: false,
    handleClickCapture,
    cancelPendingPress
  };
}
