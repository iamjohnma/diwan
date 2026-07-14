import { useCallback, useEffect, useRef, useState } from 'react';
import { useDndMonitor } from '@dnd-kit/core';
import { parseISO } from 'date-fns';
import type {
  CalendarDragType,
  CalendarEvent
} from '@/@types/common/big-calendar';
import { TIME_COLUMN_WIDTH } from '@/constants/common/big-calendar';
import { useSnapMinuteCalculators } from '@/hooks/common/big-calendar/drag-snap';
import { readDragPayload } from '@/utils/common/big-calendar';

interface DoctorViewDndPropsHook {
  pixelsPerHour: number;
  isRtlLayout: boolean;
  viewportElement: HTMLElement | null;
  columnWidth: number;
  timeColumnWidth?: number;
  doctors: { id: string }[];
  isDraggingRef: React.RefObject<boolean>;
  onEventDoctorChange?: (
    event: CalendarEvent,
    newDoctorId: string,
    newStartDate: Date,
    newEndDate: Date
  ) => void;
  setTargetDoctorId: (doctorId: string | null) => void;
  getClampedMoveDeltaMinutes?: (
    event: CalendarEvent,
    desiredDeltaMinutes: number,
    targetDentistId: string | null
  ) => number;
}

interface DoctorColumnHit {
  doctorId: string | null;
  pointerRatioWithinColumn: number | null;
}

const EMPTY_COLUMN_HIT: DoctorColumnHit = {
  doctorId: null,
  pointerRatioWithinColumn: null
};
const EMPTY_MOVE_PREVIEW = {
  dragOverDoctorId: null as string | null
};

function getActivatorClientX(activatorEvent: Event): number | undefined {
  if ('clientX' in activatorEvent) {
    return (activatorEvent as PointerEvent).clientX;
  }

  return (activatorEvent as TouchEvent).touches[0]?.clientX;
}

export function useDoctorViewDnd(props: DoctorViewDndPropsHook) {
  const timeColumnWidth = props.timeColumnWidth ?? TIME_COLUMN_WIDTH;
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [dragType, setDragType] = useState<CalendarDragType | null>(null);
  const [movePreview, setMovePreview] = useState(EMPTY_MOVE_PREVIEW);
  const [resizingEventId, setResizingEventId] = useState<
    CalendarEvent['id'] | null
  >(null);
  const [resizeDeltaMinutes, setResizeDeltaMinutes] = useState(0);
  const [resizingTopEventId, setResizingTopEventId] = useState<
    CalendarEvent['id'] | null
  >(null);
  const [resizeTopDeltaMinutes, setResizeTopDeltaMinutes] = useState(0);

  const snappedDeltaMinutesRef = useRef(0);
  const dragOverDoctorIdRef = useRef<string | null>(null);
  const lastPointerXRef = useRef<number | null>(null);
  const canTransfer = !!props.onEventDoctorChange;

  const getRelativeX = useCallback(
    (clientX: number): number | null => {
      const viewport = props.viewportElement;
      if (!viewport) return null;
      const rect = viewport.getBoundingClientRect();
      const scrollLeft = viewport.scrollLeft;
      const relativeX = props.isRtlLayout
        ? rect.right - clientX - timeColumnWidth - scrollLeft
        : clientX - rect.left - timeColumnWidth + scrollLeft;

      return relativeX < 0 ? null : relativeX;
    },
    [props.isRtlLayout, props.viewportElement, timeColumnWidth]
  );

  const getDoctorLocationFromPosition = useCallback(
    (clientX: number): DoctorColumnHit => {
      const relativeX = getRelativeX(clientX);
      if (relativeX === null) return EMPTY_COLUMN_HIT;
      const doctorIndex = Math.floor(relativeX / props.columnWidth);
      if (doctorIndex < 0 || doctorIndex >= props.doctors.length) {
        return EMPTY_COLUMN_HIT;
      }
      const columnStart = doctorIndex * props.columnWidth;
      const doctor = props.doctors[doctorIndex];
      if (!doctor) return EMPTY_COLUMN_HIT;

      return {
        doctorId: doctor.id,
        pointerRatioWithinColumn: Math.max(
          0,
          Math.min(0.999999, (relativeX - columnStart) / props.columnWidth)
        )
      };
    },
    [getRelativeX, props.columnWidth, props.doctors]
  );

  const {
    calculateMoveMinutes: calculateSnappedMinutes,
    calculateResizeMinutes: calculateResizeMinutesFn,
    calculateResizeTopMinutes: calculateResizeTopMinutesFn
  } = useSnapMinuteCalculators(props.pixelsPerHour);

  const clearDragState = () => {
    lastPointerXRef.current = null;
    props.isDraggingRef.current = false;
    setActiveEvent(null);
    setDragType(null);
    setMovePreview(EMPTY_MOVE_PREVIEW);
    snappedDeltaMinutesRef.current = 0;
    dragOverDoctorIdRef.current = null;
    setResizingEventId(null);
    setResizeDeltaMinutes(0);
    setResizingTopEventId(null);
    setResizeTopDeltaMinutes(0);
  };

  const setMovePreviewDoctorIfChanged = useCallback(
    (dragOverDoctorId: string | null) => {
      setMovePreview((previous) =>
        previous.dragOverDoctorId === dragOverDoctorId
          ? previous
          : {
              dragOverDoctorId
            }
      );
    },
    []
  );

  const updateMovePointerHover = (
    currentX: number,
    calendarEvent: CalendarEvent
  ) => {
    lastPointerXRef.current = currentX;
    const hoveredDoctorId = getDoctorLocationFromPosition(currentX).doctorId;
    dragOverDoctorIdRef.current = canTransfer
      ? hoveredDoctorId
      : (calendarEvent.dentistId ?? null);
    props.setTargetDoctorId(canTransfer ? hoveredDoctorId : null);
  };

  useDndMonitor({
    onDragStart(event) {
      const { calendarEvent, type } = readDragPayload(event.active);
      if (!calendarEvent || !type) return;

      props.isDraggingRef.current = true;
      setDragType(type);

      if (type === 'move') {
        setActiveEvent(calendarEvent);
        const initialRect = event.active.rect.current.initial;
        const initialCenterX =
          initialRect != null ? initialRect.left + initialRect.width / 2 : null;
        const initialLocation =
          initialCenterX !== null
            ? getDoctorLocationFromPosition(initialCenterX)
            : {
                doctorId: calendarEvent.dentistId ?? null,
                pointerRatioWithinColumn: null as number | null
              };
        const dragOverDoctorId =
          initialLocation.doctorId ?? calendarEvent.dentistId ?? null;

        setMovePreview({
          dragOverDoctorId
        });
        snappedDeltaMinutesRef.current = 0;
        dragOverDoctorIdRef.current = dragOverDoctorId;

        return;
      }

      if (type === 'resize') {
        setResizingEventId(calendarEvent.id);
        setResizeDeltaMinutes(0);

        return;
      }

      setResizingTopEventId(calendarEvent.id);
      setResizeTopDeltaMinutes(0);
    },
    onDragMove(event) {
      const { calendarEvent, type } = readDragPayload(event.active);
      if (!calendarEvent || !type) return;

      if (type === 'move') {
        const snapped = calculateSnappedMinutes(
          event.delta.y,
          parseISO(calendarEvent.startDate)
        );
        const activatorEvent = event.activatorEvent;
        if (activatorEvent) {
          const clientX = getActivatorClientX(activatorEvent);
          if (clientX !== undefined) {
            updateMovePointerHover(clientX + event.delta.x, calendarEvent);
          }
        }
        // No clamping on move: the card can travel freely past appointments
        // (the drop overlay paints blocked spots red and the drop is rejected).
        snappedDeltaMinutesRef.current = snapped;
        setMovePreviewDoctorIfChanged(dragOverDoctorIdRef.current);

        return;
      }

      if (type === 'resize') {
        const delta = calculateResizeMinutesFn(event.delta.y, calendarEvent);
        // Expanding the bottom edge downward behaves like a downward move of
        // that edge, so reuse the move clamp; shrinking stays unclamped.
        const clamped =
          delta > 0
            ? (props.getClampedMoveDeltaMinutes?.(
                calendarEvent,
                delta,
                calendarEvent.dentistId ?? null
              ) ?? delta)
            : delta;
        setResizeDeltaMinutes(clamped);

        return;
      }

      if (type === 'resize-top') {
        const delta = calculateResizeTopMinutesFn(event.delta.y, calendarEvent);
        // Expanding the top edge upward behaves like an upward move of that
        // edge, so reuse the move clamp; shrinking stays unclamped.
        const clamped =
          delta < 0
            ? (props.getClampedMoveDeltaMinutes?.(
                calendarEvent,
                delta,
                calendarEvent.dentistId ?? null
              ) ?? delta)
            : delta;
        setResizeTopDeltaMinutes(clamped);
      }
    },
    onDragEnd(event) {
      const { calendarEvent, type } = readDragPayload(event.active);

      if (type === 'move' && calendarEvent) {
        const activatorEvent = event.activatorEvent;
        if (activatorEvent) {
          const clientX = getActivatorClientX(activatorEvent);
          if (clientX !== undefined) {
            props.setTargetDoctorId(
              canTransfer
                ? getDoctorLocationFromPosition(clientX + event.delta.x)
                    .doctorId
                : null
            );
          }
        }
      }

      clearDragState();
    },
    onDragCancel() {
      clearDragState();
      props.setTargetDoctorId(null);
    }
  });

  useEffect(() => {
    if (dragType !== 'move' || !props.viewportElement) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const pointerX = lastPointerXRef.current;
        if (pointerX === null) return;

        const location = getDoctorLocationFromPosition(pointerX);
        const effective = canTransfer ? location.doctorId : null;
        dragOverDoctorIdRef.current = effective;
        props.setTargetDoctorId(effective);
        setMovePreviewDoctorIfChanged(effective);
      });
    };

    props.viewportElement.addEventListener('scroll', handleScroll, {
      passive: true
    });

    return () => {
      props.viewportElement!.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [
    canTransfer,
    dragType,
    getDoctorLocationFromPosition,
    setMovePreviewDoctorIfChanged,
    props.setTargetDoctorId,
    props.viewportElement
  ]);

  return {
    activeEvent,
    dragType,
    movePreview,
    resizingEventId,
    resizeDeltaMinutes,
    resizingTopEventId,
    resizeTopDeltaMinutes,
    snappedDeltaMinutesRef,
    dragOverDoctorIdRef
  };
}
