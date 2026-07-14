import { type RefObject, useRef } from 'react';
import type {
  CalendarDragType,
  CalendarEvent
} from '@/@types/common/big-calendar';
import {
  useCalendarContext,
  useCalendarDragState
} from '@/components/common/big-calendar/calendar-context';
import { EventDropIndicator } from '@/components/common/big-calendar/dnd/event-drop-indicator';
import { useDropOverlayForceRender } from '@/hooks/common/big-calendar/use-drop-overlay-force-render';
import {
  detectMovedEventCollision,
  getMovedEventTimes
} from '@/utils/common/big-calendar-collision';
import type { CalendarDayWindow } from '@/utils/common/big-calendar-segments';
import {
  buildEventRenderSegments,
  getSegmentPercentPosition
} from '@/utils/common/big-calendar-segments';

interface RangeDropOverlayLayerProps {
  activeEvent: CalendarEvent | null;
  dragType: CalendarDragType | null;
  rangeDayWindows: CalendarDayWindow[];
  gridStyle: React.CSSProperties;
  snappedDeltaMinutesRef: RefObject<number>;
  dayOffsetRef: RefObject<number>;
  firstHour: number;
  lastHour: number;
  timeZone?: string;
}

export function RangeDropOverlayLayer(props: RangeDropOverlayLayerProps) {
  const calendar = useCalendarContext();
  const calendarDragState = useCalendarDragState();
  const lastRenderedRef = useRef({
    snappedDelta: 0,
    dayOffset: 0
  });

  useDropOverlayForceRender({
    hasDragStateChanged: () => {
      const current = lastRenderedRef.current;

      return (
        current.snappedDelta !== props.snappedDeltaMinutesRef.current ||
        current.dayOffset !== props.dayOffsetRef.current
      );
    },
    onDragComplete: () => {
      lastRenderedRef.current = {
        snappedDelta: 0,
        dayOffset: 0
      };
    }
  });

  if (!props.activeEvent || props.dragType !== 'move') return null;

  const snappedDelta = props.snappedDeltaMinutesRef.current;
  const dayOffset = props.dayOffsetRef.current;
  lastRenderedRef.current = {
    snappedDelta,
    dayOffset
  };

  const movedTimes = getMovedEventTimes(props.activeEvent, {
    snappedDeltaMinutes: snappedDelta,
    dayOffset
  });
  if (movedTimes.durationMinutes <= 0) return null;

  const overlayEvent: CalendarEvent = {
    ...props.activeEvent,
    startDate: movedTimes.movedStart.toISOString(),
    endDate: movedTimes.movedEnd.toISOString()
  };
  const collision = detectMovedEventCollision(
    props.activeEvent,
    movedTimes,
    calendar.collisionIntervals
  );
  const overlaySegments = buildEventRenderSegments(
    [overlayEvent],
    props.rangeDayWindows,
    props.timeZone
  );
  if (overlaySegments.length === 0) return null;

  const segmentByDayKey = new Map(
    overlaySegments.map((segment) => [segment.dayKey, segment] as const)
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 grid overflow-hidden"
      style={props.gridStyle}
    >
      {props.rangeDayWindows.map((dayWindow) => {
        const segment = segmentByDayKey.get(dayWindow.dayKey);
        if (!segment) {
          return <div key={dayWindow.dayKey} className="relative" />;
        }

        const { top, height } = getSegmentPercentPosition(
          segment,
          props.firstHour,
          props.lastHour
        );

        return (
          <div key={dayWindow.dayKey} className="relative">
            <div
              className="absolute z-10 px-0.5"
              style={{
                top: `${top}%`,
                height: `${height}%`,
                minHeight:
                  calendarDragState.draggedOverlayHeight > 0
                    ? `${calendarDragState.draggedOverlayHeight}px`
                    : undefined,
                left: '0%',
                width: '100%'
              }}
            >
              <EventDropIndicator tone={collision ? 'collision' : 'default'} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
