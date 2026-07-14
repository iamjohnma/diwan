import { memo, useCallback, useMemo } from 'react';
import type {
  CalendarDoctor,
  CalendarEvent,
  WorkingHours
} from '@/@types/common/big-calendar';
import { EventBadge } from '@/components/common/big-calendar/dnd/event-badge';
import { resolveSegmentBadgeLayoutSize } from '@/components/common/big-calendar/shared/month-event-badge/badge-layout-utils';
import { TimeSlotGrid } from '@/components/common/big-calendar/shared/time-slot-grid';
import { areArraysEqual } from '@/utils/common/arrays';
import {
  calculateOverlapLayout,
  getOverlappingEventStyle
} from '@/utils/common/big-calendar';
import type { CalendarEventRenderSegment } from '@/utils/common/big-calendar-segments';

interface DoctorColumnProps {
  doctor: CalendarDoctor;
  hours: number[];
  firstHour: number;
  totalHeight: number;
  allSegments: CalendarEventRenderSegment[];
  visibleSegments: CalendarEventRenderSegment[];
  hasNoVisits: boolean;
  workingHours: WorkingHours;
  selectedDayIndex: number;
  selectedDayKey: string;
  columnWidth: number;
  pixelsPerHour: number;
  timeZone?: string;
  onTimeSlotClick?: (doctorId: string, hour: number, minute: number) => void;
  onTimeSlotRangeSelect?: (
    doctorId: string,
    startMinute: number,
    endMinute: number
  ) => void;
  checkRangeCollision?: (
    doctorId: string,
    startMinute: number,
    endMinute: number
  ) => boolean;
  canCreateInThisColumn?: boolean;
  movingEventId: CalendarEvent['id'] | null;
  dragType: 'move' | 'resize' | 'resize-top' | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizeDeltaMinutes: number;
  resizingTopEventId: CalendarEvent['id'] | null;
  resizeTopDeltaMinutes: number;
  disableDragDrop?: boolean;
}

function areDoctorColumnPropsEqual(
  previous: DoctorColumnProps,
  next: DoctorColumnProps
) {
  return (
    previous.doctor.id === next.doctor.id &&
    areArraysEqual(previous.hours, next.hours) &&
    previous.totalHeight === next.totalHeight &&
    previous.allSegments === next.allSegments &&
    previous.visibleSegments === next.visibleSegments &&
    previous.hasNoVisits === next.hasNoVisits &&
    previous.workingHours === next.workingHours &&
    previous.selectedDayIndex === next.selectedDayIndex &&
    previous.selectedDayKey === next.selectedDayKey &&
    previous.columnWidth === next.columnWidth &&
    previous.pixelsPerHour === next.pixelsPerHour &&
    previous.timeZone === next.timeZone &&
    previous.firstHour === next.firstHour &&
    previous.onTimeSlotClick === next.onTimeSlotClick &&
    previous.onTimeSlotRangeSelect === next.onTimeSlotRangeSelect &&
    previous.checkRangeCollision === next.checkRangeCollision &&
    previous.canCreateInThisColumn === next.canCreateInThisColumn &&
    previous.movingEventId === next.movingEventId &&
    previous.dragType === next.dragType &&
    previous.resizingEventId === next.resizingEventId &&
    previous.resizeDeltaMinutes === next.resizeDeltaMinutes &&
    previous.resizingTopEventId === next.resizingTopEventId &&
    previous.resizeTopDeltaMinutes === next.resizeTopDeltaMinutes &&
    !!previous.disableDragDrop === !!next.disableDragDrop
  );
}

export const DoctorColumn = memo(function DoctorColumn(
  props: DoctorColumnProps
) {
  const firstHour = props.hours[0] ?? 0;

  const overlapLayout = useMemo(
    () => calculateOverlapLayout(props.allSegments),
    [props.allSegments]
  );

  const canCreateInThisColumn = !!(
    props.onTimeSlotClick && props.canCreateInThisColumn
  );

  const handleClick = useCallback(
    (hour: number, minute: number) => {
      props.onTimeSlotClick?.(props.doctor.id, hour, minute);
    },
    [props.onTimeSlotClick, props.doctor.id]
  );

  const handleRangeSelect = useCallback(
    (startMinute: number, endMinute: number) => {
      props.onTimeSlotRangeSelect?.(props.doctor.id, startMinute, endMinute);
    },
    [props.onTimeSlotRangeSelect, props.doctor.id]
  );

  const handleRangeCollisionCheck = useCallback(
    (startMinute: number, endMinute: number) =>
      props.checkRangeCollision?.(props.doctor.id, startMinute, endMinute) ??
      false,
    [props.checkRangeCollision, props.doctor.id]
  );

  const isHourOffHours = useCallback(
    (hour: number) => {
      const dayHours = props.workingHours[props.selectedDayIndex];

      return !dayHours || hour < dayHours.from || hour >= dayHours.to;
    },
    [props.selectedDayIndex, props.workingHours]
  );

  return (
    <div
      className="relative h-full border-e last:border-e-0"
      style={{ width: `${props.columnWidth}px` }}
    >
      {props.hasNoVisits && (
        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{
            background: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 8px,
              hsl(var(--muted) / 0.3) 8px,
              hsl(var(--muted) / 0.3) 16px
            )`
          }}
        />
      )}
      <div className="relative" style={{ height: `${props.totalHeight}px` }}>
        <TimeSlotGrid
          hours={props.hours}
          firstHour={props.firstHour}
          pixelsPerHour={props.pixelsPerHour}
          canCreate={canCreateInThisColumn}
          dayKey={props.selectedDayKey}
          timeZone={props.timeZone}
          doctorId={props.doctor.id}
          isHourOffHours={isHourOffHours}
          onClick={handleClick}
          onRangeSelect={
            props.onTimeSlotRangeSelect ? handleRangeSelect : undefined
          }
          checkRangeCollision={
            props.checkRangeCollision ? handleRangeCollisionCheck : undefined
          }
        />
        {props.visibleSegments.map((segment) => {
          const isBeingResized =
            props.resizingEventId === segment.id && props.dragType === 'resize';
          const isBeingResizedTop =
            props.resizingTopEventId === segment.id &&
            props.dragType === 'resize-top';
          const position = overlapLayout.positions.get(segment.id) ?? {
            column: 0,
            totalColumns: 1
          };
          const style = getOverlappingEventStyle(
            segment,
            firstHour,
            position,
            props.timeZone,
            props.pixelsPerHour
          );
          const layoutSize = resolveSegmentBadgeLayoutSize({
            segment,
            totalColumns: position.totalColumns,
            pixelsPerHour: props.pixelsPerHour,
            columnWidthPx: props.columnWidth
          });

          return (
            <div
              key={segment.segmentKey}
              className="absolute z-5 px-0.5 hover:z-15"
              style={style}
            >
              <EventBadge
                event={segment.event}
                dragInstanceId={segment.dragInstanceId}
                layoutSize={layoutSize}
                displayStartDate={segment.startDate}
                displayEndDate={segment.endDate}
                isResizing={isBeingResized}
                resizeDeltaMinutes={
                  isBeingResized ? props.resizeDeltaMinutes : 0
                }
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
    </div>
  );
}, areDoctorColumnPropsEqual);
