import type { CalendarEvent } from '@/@types/common/big-calendar';
import {
  readEventPatientArrived,
  usePendingEventFlag
} from '@/hooks/common/big-calendar/use-pending-event-flag';

export function usePatientArrivalOptimistic(events: CalendarEvent[]) {
  const pendingFlag = usePendingEventFlag(events, readEventPatientArrived);

  return {
    getEffectivePatientArrived: pendingFlag.getEffectiveFlag,
    setPendingPatientArrival: pendingFlag.setPendingFlag
  };
}
