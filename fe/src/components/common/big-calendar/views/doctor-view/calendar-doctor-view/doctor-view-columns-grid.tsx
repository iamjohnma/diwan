import { memo } from 'react';
import type { RefObject } from 'react';
import type {
  CalendarDoctor,
  CalendarDragType,
  CalendarEvent,
  WorkingHours
} from '@/@types/common/big-calendar';
import { DoctorColumn } from '@/components/common/big-calendar/views/doctor-view/doctor-column';
import { ActiveDropOverlayLayer } from '@/components/common/big-calendar/views/doctor-view/doctor-drop-overlay';
import { resolveColumnDragTargets } from '@/utils/common/big-calendar';
import type {
  CalendarDayWindow,
  CalendarEventRenderSegment
} from '@/utils/common/big-calendar-segments';

const EMPTY_SEGMENTS: CalendarEventRenderSegment[] = [];

interface DoctorViewColumnsGridProps {
  doctors: CalendarDoctor[];
  hours: number[];
  totalRowsHeight: number;
  totalColumnsWidth: number;
  columnWidth: number;
  columnOffsetMultiplier: number;
  pixelsPerHour: number;
  selectedTimeZone: string;
  selectedDayIndex: number;
  selectedDayWindow: CalendarDayWindow | null;
  workingHours: WorkingHours;
  disableDragDrop?: boolean;
  segmentsByDoctorId: Map<string, CalendarEventRenderSegment[]>;
  stableVisibleSegmentsByDoctorId: Map<string, CalendarEventRenderSegment[]>;
  doctorsWithNoVisits: Set<string>;
  activeEvent: CalendarEvent | null;
  dragType: CalendarDragType | null;
  resizingEventId: CalendarEvent['id'] | null;
  resizeDeltaMinutes: number;
  resizingTopEventId: CalendarEvent['id'] | null;
  resizeTopDeltaMinutes: number;
  snappedDeltaMinutesRef: RefObject<number>;
  dragOverDoctorIdRef: RefObject<string | null>;
  canCreateInDoctorColumn: (doctorId: string) => boolean;
  onTimeSlotClick: (doctorId: string, hour: number, minute: number) => void;
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
}

export const DoctorViewColumnsGrid = memo(function DoctorViewColumnsGrid(
  props: DoctorViewColumnsGridProps
) {
  const earliestEventHour = props.hours[0] ?? 0;

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: `${props.totalColumnsWidth}px`,
        height: `${props.totalRowsHeight}px`
      }}
    >
      {props.doctors.map((doctor, doctorIndex) => {
        const doctorId = doctor.id;
        const allDoctorSegments =
          props.segmentsByDoctorId.get(doctorId) ?? EMPTY_SEGMENTS;
        const visibleDoctorSegments =
          props.stableVisibleSegmentsByDoctorId.get(doctorId) ?? EMPTY_SEGMENTS;
        const hasNoVisits = props.doctorsWithNoVisits.has(doctorId);
        const canCreateColumn = props.canCreateInDoctorColumn(doctorId);
        const columnOffset =
          doctorIndex * props.columnWidth * props.columnOffsetMultiplier;
        const dragTargets = resolveColumnDragTargets({
          dragType: props.dragType,
          activeEvent: props.activeEvent,
          resizingEventId: props.resizingEventId,
          resizeDeltaMinutes: props.resizeDeltaMinutes,
          resizingTopEventId: props.resizingTopEventId,
          resizeTopDeltaMinutes: props.resizeTopDeltaMinutes,
          visibleSegments: visibleDoctorSegments
        });

        return (
          <div
            key={doctorId}
            className="absolute top-0 h-full"
            style={{
              width: `${props.columnWidth}px`,
              transform: `translateX(${columnOffset}px)`
            }}
          >
            <DoctorColumn
              doctor={doctor}
              hours={props.hours}
              firstHour={earliestEventHour}
              totalHeight={props.totalRowsHeight}
              allSegments={allDoctorSegments}
              visibleSegments={visibleDoctorSegments}
              hasNoVisits={hasNoVisits}
              workingHours={props.workingHours}
              selectedDayIndex={props.selectedDayIndex}
              selectedDayKey={props.selectedDayWindow?.dayKey ?? ''}
              columnWidth={props.columnWidth}
              pixelsPerHour={props.pixelsPerHour}
              timeZone={props.selectedTimeZone}
              onTimeSlotClick={props.onTimeSlotClick}
              onTimeSlotRangeSelect={props.onTimeSlotRangeSelect}
              checkRangeCollision={props.checkRangeCollision}
              canCreateInThisColumn={canCreateColumn}
              movingEventId={dragTargets.movingEventId}
              dragType={dragTargets.dragType}
              resizingEventId={dragTargets.resizingEventId}
              resizeDeltaMinutes={dragTargets.resizeDeltaMinutes}
              resizingTopEventId={dragTargets.resizingTopEventId}
              resizeTopDeltaMinutes={dragTargets.resizeTopDeltaMinutes}
              disableDragDrop={props.disableDragDrop}
            />
          </div>
        );
      })}
      <ActiveDropOverlayLayer
        activeEvent={props.activeEvent}
        dragType={props.dragType}
        doctors={props.doctors}
        columnWidth={props.columnWidth}
        columnOffsetMultiplier={props.columnOffsetMultiplier}
        dragOverDoctorIdRef={props.dragOverDoctorIdRef}
        snappedDeltaMinutesRef={props.snappedDeltaMinutesRef}
        segmentsByDoctorId={props.segmentsByDoctorId}
        firstHour={earliestEventHour}
        totalHeight={props.totalRowsHeight}
        selectedDayWindow={props.selectedDayWindow}
        timeZone={props.selectedTimeZone}
      />
    </div>
  );
});
