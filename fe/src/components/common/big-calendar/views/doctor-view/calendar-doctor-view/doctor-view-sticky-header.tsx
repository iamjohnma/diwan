import { memo } from 'react';
import type { Ref } from 'react';
import type {
  CalendarDoctor,
  CalendarEvent
} from '@/@types/common/big-calendar';
import { TimeZoneSelector } from '@/components/common/big-calendar/header/time-zone-selector';
import { DoctorHeaderRow } from '@/components/common/big-calendar/views/doctor-view/doctor-header-row';

export interface DoctorViewStickyHeaderProps {
  headerRef?: Ref<HTMLDivElement>;
  timeColumnWidth: number;
  totalColumnsWidth: number;
  doctors: CalendarDoctor[];
  eventsByDoctorId: Map<string, CalendarEvent[]>;
  columnWidth: number;
  isRtl: boolean;
  timeZone: string;
  onTimeZoneChange: (tz: string) => void;
  focusedDoctorId?: string | null;
  onFocusedDoctorChange?: (doctorId: string | null) => void;
}

export const DoctorViewStickyHeader = memo(function DoctorViewStickyHeader(
  props: DoctorViewStickyHeaderProps
) {
  return (
    <div
      ref={props.headerRef}
      className="sticky top-0 z-20 flex border-b border-border/80 bg-background"
    >
      <div
        className="sticky inset-s-0 z-30 h-16 shrink-0 border-e bg-background"
        style={{ width: `${props.timeColumnWidth}px` }}
      >
        <TimeZoneSelector
          value={props.timeZone}
          onChange={props.onTimeZoneChange}
        />
      </div>
      <div
        className="relative shrink-0"
        style={{ width: `${props.totalColumnsWidth}px` }}
      >
        <DoctorHeaderRow
          doctors={props.doctors}
          eventsByDoctorId={props.eventsByDoctorId}
          columnWidth={props.columnWidth}
          totalWidth={props.totalColumnsWidth}
          isRtl={props.isRtl}
          focusedDoctorId={props.focusedDoctorId}
          onFocusedDoctorChange={props.onFocusedDoctorChange}
        />
      </div>
    </div>
  );
});
