import { useCallback, useEffect, useState } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';

export function readEventPatientArrived(event: CalendarEvent): boolean {
  return event.patientArrived ?? !!event.patientArrivedAt;
}

export function readEventVisitLate(event: CalendarEvent): boolean {
  return event.isLate ?? false;
}

export function usePendingEventFlag(
  events: CalendarEvent[],
  readServerFlag: (event: CalendarEvent) => boolean
) {
  const [pendingFlagByEventId, setPendingFlagByEventId] = useState<
    Map<string, boolean>
  >(() => new Map());

  const setPendingFlag = useCallback(
    (eventId: CalendarEvent['id'], value: boolean) => {
      setPendingFlagByEventId((prev) => {
        const next = new Map(prev);
        next.set(String(eventId), value);

        return next;
      });
    },
    []
  );

  const getEffectiveFlag = useCallback(
    (event: CalendarEvent) => {
      const key = String(event.id);
      if (!pendingFlagByEventId.has(key)) {
        return readServerFlag(event);
      }

      return pendingFlagByEventId.get(key) ?? false;
    },
    [pendingFlagByEventId, readServerFlag]
  );

  useEffect(() => {
    setPendingFlagByEventId((prev) => {
      if (prev.size === 0) return prev;
      const eventById = new Map(
        events.map((event) => [String(event.id), event] as const)
      );
      const next = new Map(prev);
      let changed = false;
      for (const [id, pendingValue] of [...next.entries()]) {
        const ev = eventById.get(id);
        if (!ev) {
          next.delete(id);
          changed = true;

          continue;
        }

        if (pendingValue === readServerFlag(ev)) {
          next.delete(id);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [events, readServerFlag]);

  return {
    getEffectiveFlag,
    setPendingFlag
  };
}
