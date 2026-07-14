import { memo, useCallback, useMemo } from 'react';
import type {
  CalendarDragType,
  CalendarEvent,
  WorkingHours
} from '@/@types/common/big-calendar';
import { EventBadge } from '@/components/common/big-calendar/dnd/event-badge';
import { resolveSegmentBadgeLayoutSize } from '@/components/common/big-calendar/shared/month-event-badge/badge-layout-utils';
import { TimeSlotGrid } from '@/components/common/big-calendar/shared/time-slot-grid';
import { areArraysEqual } from '@/utils/common/arrays';
import {
  calculateOverlapLayout,
  isWorkingHour
} from '@/utils/common/big-calendar';
import type { CalendarEventRenderSegment } from '@/utils/common/big-calendar-segments';
import { getSegmentPercentPosition } from '@/utils/common/big-calendar-segments';

function getRangeEventStyle(
  segment: CalendarEventRenderSegment,
  firstHour: number,
  lastHour: number,
  position: { column: number; totalColumns: number }
) {
  const { top, height } = getSegmentPercentPosition(
    segment,
    firstHour,
    lastHour
  );
  const width = 100 / position.totalColumns;
  const left = position.column * width;

  return {
    top: `${top}%`,
    height: `${height}%`,
    left: `${left}%`,
    width: `${width}%`
  };
}

interface RangeDayColumnProps {
  day: Date;
  dayKey: string;
  timelineDay: Date;
  hours: number[];
  allSegments: CalendarEventRenderSegment[];
  visibleSegments: CalendarEventRenderSegment[];
  workingHours: WorkingHours;
  timeZone?: string;
  firstHour: number;
  lastHour: number;
  patientsCount: number;
  movingEventId: CalendarEvent['id'] | null;
  dragType: CalendarDragType | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizeDeltaMinutes: number;
  resizingTopEventId: CalendarEvent['id'] | null;
  resizeTopDeltaMinutes: number;
  disableDragDrop: boolean;
  pixelsPerHour: number;
  onTimeSlotClick: (day: Date, hour: number, minute: number) => void;
  onTimeSlotRangeSelect?: (
    day: Date,
    startMinute: number,
    endMinute: number
  ) => void;
}

function areRangeDayColumnPropsEqual(
  previous: RangeDayColumnProps,
  next: RangeDayColumnProps
) {
  return (
    previous.day === next.day &&
    previous.dayKey === next.dayKey &&
    previous.timelineDay === next.timelineDay &&
    areArraysEqual(previous.hours, next.hours) &&
    previous.allSegments === next.allSegments &&
    previous.visibleSegments === next.visibleSegments &&
    previous.workingHours === next.workingHours &&
    previous.timeZone === next.timeZone &&
    previous.firstHour === next.firstHour &&
    previous.lastHour === next.lastHour &&
    previous.patientsCount === next.patientsCount &&
    (previous.movingEventId ?? null) === (next.movingEventId ?? null) &&
    previous.dragType === next.dragType &&
    previous.resizingEventId === next.resizingEventId &&
    previous.resizeDeltaMinutes === next.resizeDeltaMinutes &&
    previous.resizingTopEventId === next.resizingTopEventId &&
    previous.resizeTopDeltaMinutes === next.resizeTopDeltaMinutes &&
    !!previous.disableDragDrop === !!next.disableDragDrop &&
    previous.pixelsPerHour === next.pixelsPerHour &&
    previous.onTimeSlotClick === next.onTimeSlotClick &&
    previous.onTimeSlotRangeSelect === next.onTimeSlotRangeSelect
  );
}

export const RangeDayColumn = memo(function RangeDayColumn(
  props: RangeDayColumnProps
) {
  const overlapLayout = useMemo(
    () => calculateOverlapLayout(props.allSegments),
    [props.allSegments]
  );

  const canCreate = props.patientsCount > 0;

  const handleClick = useCallback(
    (hour: number, minute: number) => {
      props.onTimeSlotClick(props.day, hour, minute);
    },
    [props.onTimeSlotClick, props.day]
  );

  const handleRangeSelect = useCallback(
    (startMinute: number, endMinute: number) => {
      props.onTimeSlotRangeSelect?.(props.day, startMinute, endMinute);
    },
    [props.onTimeSlotRangeSelect, props.day]
  );

  const isHourOffHours = useCallback(
    (hour: number) =>
      !isWorkingHour(
        props.timelineDay,
        hour,
        props.workingHours,
        props.timeZone
      ),
    [props.timelineDay, props.workingHours, props.timeZone]
  );

  return (
    <div className="relative h-full">
      <TimeSlotGrid
        hours={props.hours}
        firstHour={props.firstHour}
        pixelsPerHour={props.pixelsPerHour}
        canCreate={canCreate}
        dayKey={props.dayKey}
        timeZone={props.timeZone}
        isHourOffHours={isHourOffHours}
        offHoursClassName="calendar-off-hours"
        onClick={handleClick}
        onRangeSelect={
          props.onTimeSlotRangeSelect ? handleRangeSelect : undefined
        }
      />
      {props.visibleSegments.map((segment) => {
        const position = overlapLayout.positions.get(segment.id) ?? {
          column: 0,
          totalColumns: 1
        };
        const style = getRangeEventStyle(
          segment,
          props.firstHour,
          props.lastHour,
          position
        );
        const layoutSize = resolveSegmentBadgeLayoutSize({
          segment,
          totalColumns: position.totalColumns,
          pixelsPerHour: props.pixelsPerHour
        });
        const isBeingResized =
          props.resizingEventId === segment.id && props.dragType === 'resize';
        const isBeingResizedTop =
          props.resizingTopEventId === segment.id &&
          props.dragType === 'resize-top';

        return (
          <div
            key={segment.segmentKey}
            className="absolute z-10 px-0.5 hover:z-15"
            style={style}
          >
            <EventBadge
              event={segment.event}
              dragInstanceId={segment.dragInstanceId}
              layoutSize={layoutSize}
              displayStartDate={segment.startDate}
              displayEndDate={segment.endDate}
              isResizing={isBeingResized}
              resizeDeltaMinutes={isBeingResized ? props.resizeDeltaMinutes : 0}
              isResizingTop={isBeingResizedTop}
              resizeTopDeltaMinutes={
                isBeingResizedTop ? props.resizeTopDeltaMinutes : 0
              }
              showResizeTopHandle={segment.isStartSegment}
              showResizeBottomHandle={segment.isEndSegment}
              disableDragDrop={props.disableDragDrop}
              isMoving={props.movingEventId === segment.id}
            />
          </div>
        );
      })}
    </div>
  );
}, areRangeDayColumnPropsEqual);
