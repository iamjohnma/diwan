import { memo } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type {
  CalendarDragType,
  CalendarEvent,
  WorkingHours
} from '@/@types/common/big-calendar';
import { RangeDayColumn } from '@/components/common/big-calendar/views/range-view/range-day-column';
import { RangeDropOverlayLayer } from '@/components/common/big-calendar/views/range-view/range-drop-overlay';
import { resolveColumnDragTargets } from '@/utils/common/big-calendar';
import type {
  CalendarDayWindow,
  CalendarEventRenderSegment
} from '@/utils/common/big-calendar-segments';

const EMPTY_SEGMENTS: CalendarEventRenderSegment[] = [];

interface RangeViewGridBodyProps {
  gridRef: RefObject<HTMLDivElement | null>;
  gridStyle: CSSProperties;
  totalRowsHeight: number;
  rangeDates: Date[];
  rangeDateKeys: string[];
  rangeTimelineDays: Date[];
  rangeDayWindows: CalendarDayWindow[];
  segmentsByDayKey: Map<string, CalendarEventRenderSegment[]>;
  stableVisibleSegmentsByDayKey: Map<string, CalendarEventRenderSegment[]>;
  hours: number[];
  earliestEventHour: number;
  latestEventHour: number;
  pixelsPerHour: number;
  selectedTimeZone: string;
  workingHours: WorkingHours;
  patientsCount: number;
  disableDragDrop: boolean;
  activeEvent: CalendarEvent | null;
  dragType: CalendarDragType | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizeDeltaMinutes: number;
  resizingTopEventId: CalendarEvent['id'] | null;
  resizeTopDeltaMinutes: number;
  snappedDeltaMinutesRef: RefObject<number>;
  dayOffsetRef: RefObject<number>;
  onTimeSlotClick: (day: Date, hour: number, minute: number) => void;
  onTimeSlotRangeSelect?: (
    day: Date,
    startMinute: number,
    endMinute: number
  ) => void;
}

export const RangeViewGridBody = memo(function RangeViewGridBody(
  props: RangeViewGridBodyProps
) {
  return (
    <div
      className="relative flex-1 overflow-hidden border-s"
      style={{ height: `${props.totalRowsHeight}px` }}
    >
      <div
        ref={props.gridRef}
        data-calendar-grid
        className="grid h-full divide-x"
        style={props.gridStyle}
      >
        {props.rangeDates.map((day, dayIndex) => {
          const dayKey =
            props.rangeDateKeys[dayIndex] ?? day.toISOString().slice(0, 10);
          const allDaySegments =
            props.segmentsByDayKey.get(dayKey) ?? EMPTY_SEGMENTS;
          const visibleDaySegments =
            props.stableVisibleSegmentsByDayKey.get(dayKey) ?? EMPTY_SEGMENTS;
          const timelineDay = props.rangeTimelineDays[dayIndex] ?? day;
          const dragTargets = resolveColumnDragTargets({
            dragType: props.dragType,
            activeEvent: props.activeEvent,
            resizingEventId: props.resizingEventId,
            resizeDeltaMinutes: props.resizeDeltaMinutes,
            resizingTopEventId: props.resizingTopEventId,
            resizeTopDeltaMinutes: props.resizeTopDeltaMinutes,
            visibleSegments: visibleDaySegments
          });

          return (
            <RangeDayColumn
              key={day.toISOString()}
              day={day}
              dayKey={dayKey}
              timelineDay={timelineDay}
              hours={props.hours}
              allSegments={allDaySegments}
              visibleSegments={visibleDaySegments}
              workingHours={props.workingHours}
              timeZone={props.selectedTimeZone}
              firstHour={props.earliestEventHour}
              lastHour={props.latestEventHour}
              patientsCount={props.patientsCount}
              movingEventId={dragTargets.movingEventId}
              dragType={dragTargets.dragType}
              resizingEventId={dragTargets.resizingEventId}
              resizeDeltaMinutes={dragTargets.resizeDeltaMinutes}
              resizingTopEventId={dragTargets.resizingTopEventId}
              resizeTopDeltaMinutes={dragTargets.resizeTopDeltaMinutes}
              disableDragDrop={props.disableDragDrop}
              onTimeSlotClick={props.onTimeSlotClick}
              onTimeSlotRangeSelect={props.onTimeSlotRangeSelect}
              pixelsPerHour={props.pixelsPerHour}
            />
          );
        })}
      </div>
      <RangeDropOverlayLayer
        activeEvent={props.activeEvent}
        dragType={props.dragType}
        rangeDayWindows={props.rangeDayWindows}
        gridStyle={props.gridStyle}
        snappedDeltaMinutesRef={props.snappedDeltaMinutesRef}
        dayOffsetRef={props.dayOffsetRef}
        firstHour={props.earliestEventHour}
        lastHour={props.latestEventHour}
        timeZone={props.selectedTimeZone}
      />
    </div>
  );
});
