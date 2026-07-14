import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent
} from '@dnd-kit/core';
import { addDays, addMinutes, differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type {
  CalendarEvent,
  VisitCollisionInterval
} from '@/@types/common/big-calendar';
import { useSnapMinuteCalculators } from '@/hooks/common/big-calendar/drag-snap';
import { useTranslation } from 'react-i18next';
import {
  MINUTES_PER_SNAP,
  getPixelsPerHour,
  readDragPayload
} from '@/utils/common/big-calendar';
import {
  clampMoveDeltaMinutes,
  detectVisitCollision,
  getVisitCollisionReasonKey
} from '@/utils/common/big-calendar-collision';
import {
  hapticCommit,
  hapticDragPick,
  hapticSnapTick,
  hapticTap
} from '@/utils/common/haptics';

interface PendingMoveOverride {
  startDate: string;
  endDate: string;
  dentistId?: string;
  isPendingCreate?: boolean;
  setAt: number;
}

interface PendingResizeOverride {
  startDate?: string;
  endDate: string;
  isPendingCreate?: boolean;
  setAt: number;
}

interface DraggedOverlaySize {
  height: number;
  width: number;
}

export interface CalendarDragStateSnapshot {
  activeEvent: CalendarEvent | null;
  activeEventId: CalendarEvent['id'] | null;
  draggedOverlaySize: DraggedOverlaySize;
  isDraggingEvent: boolean;
  isEventInteractionActive: boolean;
}

const DEFAULT_DRAG_DURATION_MINUTES = MINUTES_PER_SNAP * 2;
const PENDING_OVERRIDE_CONFIRMATION_MS = 5000;
const PENDING_OVERRIDE_EXPIRATION_MS = 30000;

function isEventEditLocked(event: CalendarEvent | null | undefined): boolean {
  return !!event?.isReadOnly && !event.isPendingCreate;
}

function getMoveDurationMinutes(calendarEvent: CalendarEvent): number {
  const duration = differenceInMinutes(
    parseISO(calendarEvent.endDate),
    parseISO(calendarEvent.startDate)
  );

  return !Number.isFinite(duration) || duration <= 0
    ? DEFAULT_DRAG_DURATION_MINUTES
    : duration;
}

function reconcilePendingOverrides<T extends { setAt: number }>(
  prev: Map<CalendarEvent['id'], T>,
  events: CalendarEvent[],
  isConfirmed: (override: T, event: CalendarEvent) => boolean
): Map<CalendarEvent['id'], T> {
  const now = Date.now();
  const next = new Map(prev);
  let changed = false;

  for (const event of events) {
    const override = next.get(event.id);
    if (!override) continue;

    if (
      (isConfirmed(override, event) &&
        now - override.setAt >= PENDING_OVERRIDE_CONFIRMATION_MS) ||
      now - override.setAt >= PENDING_OVERRIDE_EXPIRATION_MS
    ) {
      next.delete(event.id);
      changed = true;
    }
  }

  return changed ? next : prev;
}

function pruneExpiredOverrides<
  T extends { isPendingCreate?: boolean; setAt: number }
>(
  prev: Map<CalendarEvent['id'], T>,
  events: CalendarEvent[]
): Map<CalendarEvent['id'], T> {
  const now = Date.now();
  const pendingCreateEventIds = new Set(
    events.filter((event) => event.isPendingCreate).map((event) => event.id)
  );
  const next = new Map(prev);
  let changed = false;
  prev.forEach((override, eventId) => {
    if (override.isPendingCreate && pendingCreateEventIds.has(eventId)) {
      return;
    }
    if (now - override.setAt >= PENDING_OVERRIDE_EXPIRATION_MS) {
      next.delete(eventId);
      changed = true;
    }
  });

  return changed ? next : prev;
}

function resolveOverrideDate(
  move: PendingMoveOverride | undefined,
  resize: PendingResizeOverride | undefined,
  field: 'start' | 'end',
  fallback: string
): string {
  const moveValue = field === 'start' ? move?.startDate : move?.endDate;
  const resizeValue = field === 'start' ? resize?.startDate : resize?.endDate;
  if (move && resize && resizeValue !== undefined) {
    return move.setAt >= resize.setAt
      ? field === 'start'
        ? move.startDate
        : move.endDate
      : resizeValue;
  }

  return moveValue ?? resizeValue ?? fallback;
}

interface CalendarDragHandlersPropsHook {
  calendarZoom: number;
  direction: 'ltr' | 'rtl';
  rangeDays: number | undefined;
  events: CalendarEvent[];
  /**
   * Unfiltered busy intervals for the loaded window. Drop/resize collision
   * checks prefer these over `events` so display filters cannot hide a
   * conflicting appointment.
   */
  collisionIntervals?: readonly VisitCollisionInterval[];
  doctorById: Map<string, { id: string; name: string; avatar: string | null }>;
  onEventDrop?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date
  ) => boolean | void;
  onEventResize?: (
    event: CalendarEvent,
    newStartDate: Date,
    newEndDate: Date
  ) => boolean | void;
  onEventDoctorChange?: (
    event: CalendarEvent,
    newDoctorId: string,
    newStartDate: Date,
    newEndDate: Date
  ) => boolean | void;
}

export function useCalendarDragHandlers(props: CalendarDragHandlersPropsHook) {
  const { t } = useTranslation();
  const pixelsPerHour = getPixelsPerHour(props.calendarZoom);
  const dragStateRef = useRef<CalendarDragStateSnapshot>({
    activeEvent: null,
    activeEventId: null,
    draggedOverlaySize: {
      height: 0,
      width: 0
    },
    isDraggingEvent: false,
    isEventInteractionActive: false
  });
  const dragStateListenersRef = useRef(new Set<() => void>());
  const emptyOverlaySize = useMemo<DraggedOverlaySize>(
    () => ({
      height: 0,
      width: 0
    }),
    []
  );
  const [pendingMoves, setPendingMoves] = useState<
    Map<CalendarEvent['id'], PendingMoveOverride>
  >(new Map());
  const [pendingResizes, setPendingResizes] = useState<
    Map<CalendarEvent['id'], PendingResizeOverride>
  >(new Map());
  const clearActiveEventIdRafRef = useRef<number | null>(null);
  const targetDoctorIdRef = useRef<string | null>(null);
  const lastSnapMinutesRef = useRef(0);
  const applyPendingOverridesRef = useRef<
    (event: CalendarEvent) => CalendarEvent
  >((event) => event);
  const applyPendingOverridesToIntervalRef = useRef<
    (interval: VisitCollisionInterval) => VisitCollisionInterval
  >((interval) => interval);

  const setTargetDoctorId = useCallback((doctorId: string | null) => {
    const previousDoctorId = targetDoctorIdRef.current;
    targetDoctorIdRef.current = doctorId;
    // Crossing into another doctor's column is a snap-target change, exactly
    // like snapping to a new time slot vertically.
    if (
      doctorId !== null &&
      previousDoctorId !== null &&
      previousDoctorId !== doctorId &&
      dragStateRef.current.isDraggingEvent
    ) {
      hapticSnapTick();
    }
  }, []);

  const emitDragStateChange = useCallback(() => {
    dragStateListenersRef.current.forEach((listener) => listener());
  }, []);

  const setDragState = useCallback(
    (patch: Partial<CalendarDragStateSnapshot>) => {
      dragStateRef.current = {
        ...dragStateRef.current,
        ...patch
      };
      emitDragStateChange();
    },
    [emitDragStateChange]
  );

  const subscribeDragState = useCallback((listener: () => void) => {
    dragStateListenersRef.current.add(listener);

    return () => {
      dragStateListenersRef.current.delete(listener);
    };
  }, []);

  const getDragStateSnapshot = useCallback(() => dragStateRef.current, []);

  const getIsDraggingEvent = useCallback(
    () => dragStateRef.current.isDraggingEvent,
    []
  );

  const getIsEventInteractionActive = useCallback(
    () => dragStateRef.current.isEventInteractionActive,
    []
  );

  const clearActiveEventId = useCallback(
    (when: 'immediate' | 'nextFrame') => {
      if (clearActiveEventIdRafRef.current !== null) {
        cancelAnimationFrame(clearActiveEventIdRafRef.current);
        clearActiveEventIdRafRef.current = null;
      }
      if (when === 'immediate') {
        setDragState({ activeEventId: null });

        return;
      }
      clearActiveEventIdRafRef.current = requestAnimationFrame(() => {
        clearActiveEventIdRafRef.current = null;
        setDragState({ activeEventId: null });
      });
    },
    [setDragState]
  );

  useEffect(() => {
    return () => {
      if (clearActiveEventIdRafRef.current !== null) {
        cancelAnimationFrame(clearActiveEventIdRafRef.current);
      }
    };
  }, []);

  const {
    calculateMoveMinutes: calculateSnappedMinutes,
    calculateResizeMinutes,
    calculateResizeTopMinutes
  } = useSnapMinuteCalculators(pixelsPerHour);

  const clearPendingMoveForEvent = useCallback(
    (eventId: CalendarEvent['id']) => {
      setPendingMoves((prev) => {
        if (!prev.has(eventId)) return prev;
        const next = new Map(prev);
        next.delete(eventId);

        return next;
      });
    },
    []
  );

  const clearPendingResizeForEvent = useCallback(
    (eventId: CalendarEvent['id']) => {
      setPendingResizes((prev) => {
        if (!prev.has(eventId)) return prev;
        const next = new Map(prev);
        next.delete(eventId);

        return next;
      });
    },
    []
  );

  const endInteraction = useCallback(
    (options?: { clearActiveId?: 'immediate' | 'nextFrame' }) => {
      setDragState({
        isEventInteractionActive: false,
        isDraggingEvent: false
      });
      if (options?.clearActiveId) {
        clearActiveEventId(options.clearActiveId);
      }
    },
    [clearActiveEventId, setDragState]
  );

  const resetMoveDragChrome = useCallback(() => {
    setDragState({
      activeEvent: null,
      draggedOverlaySize: emptyOverlaySize
    });
    clearActiveEventId('nextFrame');
    setTargetDoctorId(null);
  }, [clearActiveEventId, emptyOverlaySize, setDragState, setTargetDoctorId]);

  const handleDragCancel = useCallback(() => {
    endInteraction({ clearActiveId: 'immediate' });
    setDragState({
      activeEvent: null,
      draggedOverlaySize: emptyOverlaySize
    });
    setTargetDoctorId(null);
  }, [emptyOverlaySize, endInteraction, setDragState, setTargetDoctorId]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { calendarEvent, type, getHeight } = readDragPayload(event.active);
      if (!calendarEvent || !type || isEventEditLocked(calendarEvent)) return;

      lastSnapMinutesRef.current = 0;
      hapticDragPick();

      if (type !== 'move') {
        setDragState({
          isEventInteractionActive: true,
          isDraggingEvent: true
        });

        return;
      }

      if (clearActiveEventIdRafRef.current !== null) {
        cancelAnimationFrame(clearActiveEventIdRafRef.current);
        clearActiveEventIdRafRef.current = null;
      }
      const initialRect = event.active.rect.current.initial;
      setDragState({
        activeEvent: calendarEvent,
        activeEventId: calendarEvent.id,
        draggedOverlaySize: {
          height: initialRect?.height ?? getHeight?.() ?? 0,
          width: initialRect?.width ?? 0
        },
        isEventInteractionActive: true,
        isDraggingEvent: true
      });
    },
    [setDragState]
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { calendarEvent, type } = readDragPayload(event.active);
      if (!calendarEvent || !type || isEventEditLocked(calendarEvent)) return;

      const snappedMinutes =
        type === 'move'
          ? calculateSnappedMinutes(
              event.delta.y,
              parseISO(calendarEvent.startDate)
            )
          : type === 'resize-top'
            ? calculateResizeTopMinutes(event.delta.y, calendarEvent)
            : calculateResizeMinutes(event.delta.y, calendarEvent);

      if (snappedMinutes === lastSnapMinutesRef.current) return;

      lastSnapMinutesRef.current = snappedMinutes;
      hapticSnapTick();
    },
    [calculateSnappedMinutes, calculateResizeMinutes, calculateResizeTopMinutes]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { calendarEvent, type } = readDragPayload(event.active);

      if (calendarEvent && isEventEditLocked(calendarEvent)) {
        handleDragCancel();

        return;
      }

      const collisionIntervals = (props.collisionIntervals ?? props.events).map(
        applyPendingOverridesToIntervalRef.current
      );

      if (type === 'move') {
        const gridElement = document.querySelector(
          '[data-calendar-grid]'
        ) as HTMLElement;
        const renderedRangeDays =
          gridElement?.childElementCount ?? props.rangeDays ?? 1;
        let dayOffset = 0;

        if (gridElement && renderedRangeDays > 1) {
          const columnWidth = gridElement.offsetWidth / renderedRangeDays;
          const deltaX =
            props.direction === 'rtl' ? -event.delta.x : event.delta.x;
          const rawOffset = Math.round(deltaX / columnWidth);
          dayOffset = Math.max(
            -(renderedRangeDays - 1),
            Math.min(renderedRangeDays - 1, rawOffset)
          );
        }

        const originalStart = calendarEvent
          ? parseISO(calendarEvent.startDate)
          : new Date();
        const snappedMinutes = calculateSnappedMinutes(
          event.delta.y,
          originalStart
        );
        const currentTargetDoctorId = targetDoctorIdRef.current;
        const doctorChanged =
          !!currentTargetDoctorId &&
          !!calendarEvent?.dentistId &&
          currentTargetDoctorId !== calendarEvent.dentistId;
        const hasTimeChange = snappedMinutes !== 0 || dayOffset !== 0;

        let pendingCallback: (() => boolean | void) | null = null;

        if (calendarEvent && (hasTimeChange || doctorChanged)) {
          const duration = getMoveDurationMinutes(calendarEvent);
          // A move shifts the whole card, so it must be free to travel past
          // appointments to a free slot beyond them (unlike a resize). Blocked
          // drops are caught by the collision check below, not by clamping.
          const newStartDate = addMinutes(
            addDays(originalStart, dayOffset),
            snappedMinutes
          );
          const newEndDate = addMinutes(newStartDate, duration);
          const pendingMove = {
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString(),
            isPendingCreate: calendarEvent.isPendingCreate,
            setAt: Date.now()
          };

          const willChangeDoctor = doctorChanged && !!props.onEventDoctorChange;
          const targetDentistId = willChangeDoctor
            ? currentTargetDoctorId
            : (calendarEvent.dentistId ?? null);
          const collision = detectVisitCollision(
            {
              start: newStartDate,
              end: newEndDate,
              patientId: calendarEvent.patientId,
              dentistId: targetDentistId,
              ignoreEventId: calendarEvent.id,
              ignoreVisitId: calendarEvent.visitId ?? null
            },
            collisionIntervals
          );
          if (collision) {
            endInteraction();
            resetMoveDragChrome();
            hapticTap('medium');
            toast.error(t(getVisitCollisionReasonKey(collision.reason)));

            return;
          }

          if (willChangeDoctor) {
            setPendingMoves((prev) =>
              new Map(prev).set(calendarEvent.id, {
                ...pendingMove,
                dentistId: currentTargetDoctorId
              })
            );
            pendingCallback = () =>
              props.onEventDoctorChange!(
                calendarEvent,
                currentTargetDoctorId,
                newStartDate,
                newEndDate
              );
          } else if (hasTimeChange) {
            setPendingMoves((prev) =>
              new Map(prev).set(calendarEvent.id, pendingMove)
            );
            pendingCallback = () =>
              props.onEventDrop?.(calendarEvent, newStartDate, newEndDate);
          }
        }

        endInteraction();
        resetMoveDragChrome();
        const commitResult = pendingCallback?.();
        if (pendingCallback && commitResult !== false) {
          if (calendarEvent) {
            clearPendingResizeForEvent(calendarEvent.id);
          }
          hapticCommit();
        } else if (commitResult === false && calendarEvent) {
          clearPendingMoveForEvent(calendarEvent.id);
        }
      } else if (type === 'resize' || type === 'resize-top') {
        const resizeTop = type === 'resize-top';
        const snappedMinutes = resizeTop
          ? calculateResizeTopMinutes(event.delta.y, calendarEvent ?? null)
          : calculateResizeMinutes(event.delta.y, calendarEvent ?? null);

        let resizeCallback: (() => boolean | void) | null = null;

        if (calendarEvent && snappedMinutes !== 0) {
          const originalStart = parseISO(calendarEvent.startDate);
          const originalEnd = parseISO(calendarEvent.endDate);
          // Stop an expanding edge at the border of any blocking appointment.
          // The leading edge of an expand behaves like a move in that
          // direction, so the move clamp applies as-is; shrinking an edge can
          // never create an overlap, so it is left untouched.
          const isExpanding = resizeTop
            ? snappedMinutes < 0
            : snappedMinutes > 0;
          const clampedMinutes = isExpanding
            ? clampMoveDeltaMinutes(
                {
                  start: originalStart,
                  end: originalEnd,
                  desiredDeltaMinutes: snappedMinutes,
                  patientId: calendarEvent.patientId,
                  dentistId: calendarEvent.dentistId ?? null,
                  ignoreEventId: calendarEvent.id,
                  ignoreVisitId: calendarEvent.visitId ?? null
                },
                collisionIntervals
              )
            : snappedMinutes;

          if (clampedMinutes !== 0) {
            const newStartDate = resizeTop
              ? addMinutes(originalStart, clampedMinutes)
              : originalStart;
            const newEndDate = resizeTop
              ? originalEnd
              : addMinutes(originalEnd, clampedMinutes);

            if (
              resizeTop
                ? newStartDate >= originalEnd
                : newEndDate <= originalStart
            ) {
              endInteraction();

              return;
            }

            const resizeCollision = detectVisitCollision(
              {
                start: newStartDate,
                end: newEndDate,
                patientId: calendarEvent.patientId,
                dentistId: calendarEvent.dentistId ?? null,
                ignoreEventId: calendarEvent.id,
                ignoreVisitId: calendarEvent.visitId ?? null
              },
              collisionIntervals
            );
            if (resizeCollision) {
              endInteraction({ clearActiveId: 'immediate' });
              hapticTap('medium');
              toast.error(
                t(getVisitCollisionReasonKey(resizeCollision.reason))
              );

              return;
            }

            setPendingResizes((prev) =>
              new Map(prev).set(calendarEvent.id, {
                startDate: resizeTop ? newStartDate.toISOString() : undefined,
                endDate: newEndDate.toISOString(),
                isPendingCreate: calendarEvent.isPendingCreate,
                setAt: Date.now()
              })
            );
            resizeCallback = () =>
              props.onEventResize?.(calendarEvent, newStartDate, newEndDate);
          }
        }

        endInteraction({ clearActiveId: 'immediate' });
        const commitResult = resizeCallback?.();
        if (resizeCallback && commitResult !== false) {
          hapticCommit();
        } else if (commitResult === false && calendarEvent) {
          clearPendingResizeForEvent(calendarEvent.id);
        }
      } else {
        endInteraction({ clearActiveId: 'immediate' });
      }
    },
    [
      calculateSnappedMinutes,
      calculateResizeMinutes,
      calculateResizeTopMinutes,
      clearPendingMoveForEvent,
      clearPendingResizeForEvent,
      endInteraction,
      handleDragCancel,
      resetMoveDragChrome,
      props.onEventDrop,
      props.onEventResize,
      props.onEventDoctorChange,
      props.events,
      props.collisionIntervals,
      props.rangeDays,
      props.direction,
      t
    ]
  );

  // Collision intervals come from the page's raw visit list, so optimistic
  // drag results must be layered on the same way they are for display events:
  // a just-moved appointment frees its old slot and blocks its new one.
  const applyPendingOverridesToInterval = useCallback(
    (interval: VisitCollisionInterval): VisitCollisionInterval => {
      const moveOverride = pendingMoves.get(interval.id);
      const resizeOverride = pendingResizes.get(interval.id);
      if (!moveOverride && !resizeOverride) return interval;

      return {
        ...interval,
        startDate: resolveOverrideDate(
          moveOverride,
          resizeOverride,
          'start',
          interval.startDate
        ),
        endDate: resolveOverrideDate(
          moveOverride,
          resizeOverride,
          'end',
          interval.endDate
        ),
        dentistId: moveOverride?.dentistId ?? interval.dentistId
      };
    },
    [pendingMoves, pendingResizes]
  );
  applyPendingOverridesToIntervalRef.current = applyPendingOverridesToInterval;

  const applyPendingOverrides = useCallback(
    (event: CalendarEvent): CalendarEvent => {
      const moveOverride = pendingMoves.get(event.id);
      const resizeOverride = pendingResizes.get(event.id);
      if (!moveOverride && !resizeOverride) return event;

      const overrideDoctor = moveOverride?.dentistId
        ? props.doctorById.get(moveOverride.dentistId)
        : undefined;
      const startDate = resolveOverrideDate(
        moveOverride,
        resizeOverride,
        'start',
        event.startDate
      );
      const endDate = resolveOverrideDate(
        moveOverride,
        resizeOverride,
        'end',
        event.endDate
      );

      return {
        ...event,
        startDate,
        endDate,
        dentistId: moveOverride?.dentistId ?? event.dentistId,
        user: moveOverride?.dentistId
          ? {
              ...event.user,
              id: moveOverride.dentistId,
              name: overrideDoctor?.name ?? event.user.name,
              picturePath: overrideDoctor?.avatar ?? event.user.picturePath
            }
          : event.user
      };
    },
    [props.doctorById, pendingMoves, pendingResizes]
  );
  applyPendingOverridesRef.current = applyPendingOverrides;

  useEffect(() => {
    if (pendingMoves.size === 0) return;

    setPendingMoves((prev) =>
      reconcilePendingOverrides(
        prev,
        props.events,
        (override, event) =>
          override.startDate === event.startDate &&
          override.endDate === event.endDate &&
          (override.dentistId === undefined ||
            override.dentistId === event.dentistId)
      )
    );
  }, [props.events, pendingMoves.size]);

  useEffect(() => {
    if (pendingResizes.size === 0) return;

    setPendingResizes((prev) =>
      reconcilePendingOverrides(
        prev,
        props.events,
        (override, event) =>
          override.endDate === event.endDate &&
          (override.startDate === undefined ||
            override.startDate === event.startDate)
      )
    );
  }, [props.events, pendingResizes.size]);

  useEffect(() => {
    if (pendingMoves.size === 0 && pendingResizes.size === 0) return;
    const intervalId = setInterval(() => {
      setPendingMoves((prev) => pruneExpiredOverrides(prev, props.events));
      setPendingResizes((prev) => pruneExpiredOverrides(prev, props.events));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [pendingMoves.size, pendingResizes.size, props.events]);

  return useMemo(
    () => ({
      subscribeDragState,
      getDragStateSnapshot,
      getIsDraggingEvent,
      getIsEventInteractionActive,
      pendingMoves,
      pendingResizes,
      pixelsPerHour,
      setTargetDoctorId,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      handleDragCancel,
      applyPendingOverrides,
      applyPendingOverridesToInterval
    }),
    [
      subscribeDragState,
      getDragStateSnapshot,
      getIsDraggingEvent,
      getIsEventInteractionActive,
      pendingMoves,
      pendingResizes,
      pixelsPerHour,
      setTargetDoctorId,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      handleDragCancel,
      applyPendingOverrides,
      applyPendingOverridesToInterval
    ]
  );
}
