import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';

interface EventSelectionPropsHook {
  filteredEvents: CalendarEvent[];
  eventsWithOverrides: CalendarEvent[];
  onEventsDelete?: (events: CalendarEvent[]) => void;
}

function compareEventsForSelectionOrder(a: CalendarEvent, b: CalendarEvent) {
  const startDelta =
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  if (startDelta !== 0) {
    return startDelta;
  }

  return String(a.id).localeCompare(String(b.id));
}

export function useEventSelection(props: EventSelectionPropsHook) {
  const [selectedEventIds, setSelectedEventIds] = useState(
    () => new Set<CalendarEvent['id']>()
  );
  // Anchor for Windows-style shift+click range selection. Held in a ref so it
  // survives re-renders without forcing one; it is only read at click time.
  const selectionAnchorIdRef = useRef<CalendarEvent['id'] | null>(null);

  const selectedEvents = useMemo(
    () =>
      selectedEventIds.size === 0
        ? []
        : props.eventsWithOverrides.filter((event) =>
            selectedEventIds.has(event.id)
          ),
    [props.eventsWithOverrides, selectedEventIds]
  );

  const isEventSelected = useCallback(
    (eventId: CalendarEvent['id']) => selectedEventIds.has(eventId),
    [selectedEventIds]
  );

  const toggleEventSelection = useCallback((event: CalendarEvent) => {
    selectionAnchorIdRef.current = event.id;
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(event.id)) next.delete(event.id);
      else next.add(event.id);

      return next;
    });
  }, []);

  // Selects every selectable visible event between the current anchor and the
  // clicked event (inclusive), replacing the selection â€” mirroring how
  // shift+click selects a contiguous range in Windows Explorer. The anchor
  // stays fixed so repeated shift+clicks re-range from the same origin.
  const selectEventRange = useCallback(
    (event: CalendarEvent) => {
      const ordered = props.filteredEvents
        .filter((candidate) => !candidate.isReadOnly)
        .sort(compareEventsForSelectionOrder);

      const targetIndex = ordered.findIndex((item) => item.id === event.id);
      if (targetIndex === -1) return;

      const anchorId = selectionAnchorIdRef.current;
      const anchorIndex =
        anchorId === null
          ? -1
          : ordered.findIndex((item) => item.id === anchorId);

      if (anchorIndex === -1) {
        selectionAnchorIdRef.current = event.id;
        setSelectedEventIds(new Set([event.id]));

        return;
      }

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangeIds = ordered.slice(start, end + 1).map((item) => item.id);

      setSelectedEventIds(new Set(rangeIds));
    },
    [props.filteredEvents]
  );

  const clearSelectedEvents = useCallback(() => {
    selectionAnchorIdRef.current = null;
    setSelectedEventIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const deleteSelectedEvents = useCallback(() => {
    if (!props.onEventsDelete || selectedEventIds.size === 0) return;
    const deletableEvents = selectedEvents.filter((event) => !event.isReadOnly);
    if (deletableEvents.length === 0) return;
    props.onEventsDelete(deletableEvents);
  }, [props.onEventsDelete, selectedEventIds.size, selectedEvents]);

  useEffect(() => {
    setSelectedEventIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(props.filteredEvents.map((event) => event.id));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));

      return next.size === prev.size ? prev : next;
    });
  }, [props.filteredEvents]);

  return useMemo(
    () => ({
      selectedEventIds,
      selectedEvents,
      isEventSelected,
      toggleEventSelection,
      selectEventRange,
      clearSelectedEvents,
      deleteSelectedEvents
    }),
    [
      selectedEventIds,
      selectedEvents,
      isEventSelected,
      toggleEventSelection,
      selectEventRange,
      clearSelectedEvents,
      deleteSelectedEvents
    ]
  );
}
