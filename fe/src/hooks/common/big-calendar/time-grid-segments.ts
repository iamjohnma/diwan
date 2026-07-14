import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import type {
  CalendarDayWindow,
  CalendarEventRenderSegment
} from '@/utils/common/big-calendar-segments';
import { buildEventRenderSegments } from '@/utils/common/big-calendar-segments';
import { eventIntersectsMinuteWindow } from '@/utils/common/big-calendar-virtualization';

function segmentsEqual(
  previous: CalendarEventRenderSegment,
  next: CalendarEventRenderSegment
) {
  if (previous === next) return true;

  // The event objects are rebuilt on every render, so reference equality can't
  // be used here. We compare every event field that the badge renders or that
  // the badge-derived interactions (context menu, hover actions, editor popover)
  // read â€” otherwise an optimistic edit (e.g. reassigning the patient from the
  // context menu) would keep the stale segment reference and the badge would not
  // update until a full refetch.
  return (
    previous.segmentKey === next.segmentKey &&
    previous.startDate === next.startDate &&
    previous.endDate === next.endDate &&
    previous.startMinutes === next.startMinutes &&
    previous.endMinutes === next.endMinutes &&
    previous.event.id === next.event.id &&
    previous.event.startDate === next.event.startDate &&
    previous.event.endDate === next.event.endDate &&
    previous.event.patientName === next.event.patientName &&
    previous.event.title === next.event.title &&
    previous.event.visitType === next.event.visitType &&
    previous.event.description === next.event.description &&
    previous.event.color === next.event.color &&
    previous.event.patientId === next.event.patientId &&
    previous.event.dentistId === next.event.dentistId &&
    previous.event.user.id === next.event.user.id &&
    previous.event.user.name === next.event.user.name &&
    previous.event.treatmentPlanId === next.event.treatmentPlanId &&
    previous.event.visitId === next.event.visitId &&
    previous.event.invoiceId === next.event.invoiceId &&
    previous.event.status === next.event.status &&
    previous.event.isReadOnly === next.event.isReadOnly &&
    previous.event.invoiceStatus === next.event.invoiceStatus &&
    previous.event.isLate === next.event.isLate &&
    previous.event.patientArrived === next.event.patientArrived &&
    previous.event.patientArrivedAt === next.event.patientArrivedAt
  );
}

function groupSegmentsByKey(
  segments: CalendarEventRenderSegment[],
  getGroupKey: (
    segment: CalendarEventRenderSegment
  ) => string | null | undefined
) {
  const result = new Map<string, CalendarEventRenderSegment[]>();
  for (const segment of segments) {
    const key = getGroupKey(segment);
    if (!key) continue;
    const existing = result.get(key);
    if (existing) {
      existing.push(segment);
    } else {
      result.set(key, [segment]);
    }
  }

  return result;
}

export function getForcedEventIds(options: {
  activeEvent: CalendarEvent | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizingTopEventId: CalendarEvent['id'] | null;
}) {
  const result = new Set<CalendarEvent['id']>();
  if (options.activeEvent) result.add(options.activeEvent.id);
  if (options.resizingEventId !== null) result.add(options.resizingEventId);
  if (options.resizingTopEventId !== null) {
    result.add(options.resizingTopEventId);
  }

  return result;
}

interface UseTimeGridSegmentsOptions {
  previewEvents: CalendarEvent[];
  dayWindows: CalendarDayWindow[];
  timeZone: string;
  sourceEventById: ReadonlyMap<CalendarEvent['id'], CalendarEvent>;
  getGroupKey: (
    segment: CalendarEventRenderSegment
  ) => string | null | undefined;
  visibleMinuteWindow: { start: number; end: number };
  isZooming: boolean;
  forcedEventIds: ReadonlySet<CalendarEvent['id']>;
}

export function useTimeGridSegments(options: UseTimeGridSegmentsOptions) {
  const segments = useMemo(
    () =>
      buildEventRenderSegments(
        options.previewEvents,
        options.dayWindows,
        options.timeZone,
        options.sourceEventById as Map<CalendarEvent['id'], CalendarEvent>
      ),
    [
      options.previewEvents,
      options.dayWindows,
      options.timeZone,
      options.sourceEventById
    ]
  );

  const segmentsByKey = useMemo(
    () => groupSegmentsByKey(segments, options.getGroupKey),
    [segments, options.getGroupKey]
  );

  const visibleSegmentsByKey = useMemo(() => {
    const isVisible = (segment: CalendarEventRenderSegment) =>
      options.isZooming ||
      options.forcedEventIds.has(segment.id) ||
      eventIntersectsMinuteWindow(
        segment.startMinutes,
        segment.endMinutes,
        options.visibleMinuteWindow.start,
        options.visibleMinuteWindow.end
      );

    return groupSegmentsByKey(segments.filter(isVisible), options.getGroupKey);
  }, [
    options.forcedEventIds,
    options.getGroupKey,
    options.isZooming,
    options.visibleMinuteWindow,
    segments
  ]);

  const previousVisibleSegmentsRef = useRef<
    Map<string, CalendarEventRenderSegment[]>
  >(new Map());

  const stableVisibleSegmentsByKey = useMemo(() => {
    const previous = previousVisibleSegmentsRef.current;
    const result = new Map<string, CalendarEventRenderSegment[]>();
    let hasChanges = false;

    for (const [key, nextSegments] of visibleSegmentsByKey) {
      const prevSegments = previous.get(key);
      if (prevSegments && prevSegments.length === nextSegments.length) {
        const sameSegments = nextSegments.every((segment, index) =>
          segmentsEqual(prevSegments[index]!, segment)
        );
        if (sameSegments) {
          result.set(key, prevSegments);
          continue;
        }
      }
      hasChanges = true;
      result.set(key, nextSegments);
    }

    for (const key of previous.keys()) {
      if (!visibleSegmentsByKey.has(key)) hasChanges = true;
    }

    if (!hasChanges && result.size === previous.size) return previous;

    previousVisibleSegmentsRef.current = result;

    return result;
  }, [visibleSegmentsByKey]);

  const [hasFirstPainted, setHasFirstPainted] = useState(false);
  useEffect(() => {
    setHasFirstPainted(true);
  }, []);

  return {
    segments,
    segmentsByKey,
    stableVisibleSegmentsByKey,
    hasFirstPainted
  };
}
