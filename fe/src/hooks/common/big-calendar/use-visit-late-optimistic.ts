import type { CalendarEvent } from '@/@types/common/big-calendar';
import {
  readEventVisitLate,
  usePendingEventFlag
} from '@/hooks/common/big-calendar/use-pending-event-flag';

export function useVisitLateOptimistic(events: CalendarEvent[]) {
  const pendingFlag = usePendingEventFlag(events, readEventVisitLate);

  return {
    getEffectiveVisitLate: pendingFlag.getEffectiveFlag,
    setPendingVisitLate: pendingFlag.setPendingFlag
  };
}
