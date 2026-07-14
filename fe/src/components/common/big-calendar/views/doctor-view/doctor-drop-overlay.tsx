import { type RefObject, useRef } from 'react';
import type {
  CalendarDragType,
  CalendarEvent
} from '@/@types/common/big-calendar';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { MIN_BADGE_HEIGHT_PX } from '@/components/common/big-calendar/dnd/draggable-event-badge';
import { EventDropIndicator } from '@/components/common/big-calendar/dnd/event-drop-indicator';
import { useDropOverlayForceRender } from '@/hooks/common/big-calendar/use-drop-overlay-force-render';
import {
  calculateOverlapLayout,
  getOverlappingEventStyle
} from '@/utils/common/big-calendar';
import {
  detectMovedEventCollision,
  getMovedEventTimes
} from '@/utils/common/big-calendar-collision';
import type {
  CalendarDayWindow,
  CalendarEventRenderSegment
} from '@/utils/common/big-calendar-segments';

interface ActiveDropOverlayLayerProps {
  activeEvent: CalendarEvent | null;
  dragType: CalendarDragType | null;
  doctors: { id: string }[];
  columnWidth: number;
  columnOffsetMultiplier: number;
  dragOverDoctorIdRef: RefObject<string | null>;
  snappedDeltaMinutesRef: RefObject<number>;
  segmentsByDoctorId: Map<string, CalendarEventRenderSegment[]>;
  firstHour: number;
  totalHeight: number;
  selectedDayWindow: CalendarDayWindow | null;
  timeZone?: string;
}

export function ActiveDropOverlayLayer(props: ActiveDropOverlayLayerProps) {
  const calendar = useCalendarContext();
  const pixelsPerHour = calendar.pixelsPerHour;
  const lastRenderedRef = useRef({
    snappedDelta: 0,
    dragOverDoctorId: null as string | null
  });

  useDropOverlayForceRender({
    hasDragStateChanged: () => {
      const current = lastRenderedRef.current;

      return (
        current.snappedDelta !== props.snappedDeltaMinutesRef.current ||
        current.dragOverDoctorId !== props.dragOverDoctorIdRef.current
      );
    },
    onDragComplete: () => {
      lastRenderedRef.current = {
        snappedDelta: 0,
        dragOverDoctorId: null
      };
    }
  });

  if (!props.activeEvent || props.dragType !== 'move') {
    return null;
  }

  const dragOverDoctorId = props.dragOverDoctorIdRef.current;
  const snappedDeltaMinutes = props.snappedDeltaMinutesRef.current;
  lastRenderedRef.current = {
    snappedDelta: snappedDeltaMinutes,
    dragOverDoctorId
  };

  if (!dragOverDoctorId) {
    return null;
  }

  const doctorIndex = props.doctors.findIndex((d) => d.id === dragOverDoctorId);
  if (doctorIndex === -1) {
    return null;
  }

  const columnOffset =
    doctorIndex * props.columnWidth * props.columnOffsetMultiplier;

  if (!props.selectedDayWindow) {
    return null;
  }

  const doctorSegments = props.segmentsByDoctorId.get(dragOverDoctorId) ?? [];
  const overlapLayout = calculateOverlapLayout(doctorSegments);
  const overlaySegment = doctorSegments.find(
    (segment) => segment.id === props.activeEvent?.id
  );
  if (!overlaySegment) {
    return null;
  }

  const style = getOverlappingEventStyle(
    overlaySegment,
    props.firstHour,
    overlapLayout.positions.get(overlaySegment.id) ?? {
      column: 0,
      totalColumns: 1
    },
    props.timeZone,
    pixelsPerHour
  );

  const baseTopPx = Number.parseFloat(style.top);
  const baseHeightPx = Number.parseFloat(style.height);
  const snappedPixelY = (snappedDeltaMinutes / 60) * pixelsPerHour;
  const previewTopPx = baseTopPx + snappedPixelY;
  const previewHeightPx = Math.max(
    MIN_BADGE_HEIGHT_PX,
    Number.isFinite(baseHeightPx) ? baseHeightPx : MIN_BADGE_HEIGHT_PX
  );

  const movedTimes = getMovedEventTimes(props.activeEvent, {
    snappedDeltaMinutes
  });
  const collision = detectMovedEventCollision(
    props.activeEvent,
    movedTimes,
    calendar.collisionIntervals,
    dragOverDoctorId
  );

  return (
    <div
      className="pointer-events-none absolute top-0 overflow-hidden"
      style={{
        width: `${props.columnWidth}px`,
        transform: `translateX(${columnOffset}px)`,
        height: `${props.totalHeight}px`
      }}
    >
      <div
        className="absolute z-5 px-0.5"
        style={{
          top: `${previewTopPx}px`,
          height: `${previewHeightPx}px`,
          left: style.left,
          width: style.width
        }}
      >
        <EventDropIndicator
          variant="flush"
          tone={collision ? 'collision' : 'default'}
        />
      </div>
    </div>
  );
}
