import { memo } from 'react';
import type {
  CalendarDoctor,
  CalendarEvent
} from '@/@types/common/big-calendar';
import { TruncateText } from '@/components/common/truncate-text';
import { UserAvatar } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/common/cn';

interface DoctorHeaderRowProps {
  doctors: CalendarDoctor[];
  eventsByDoctorId: Map<string, CalendarEvent[]>;
  columnWidth: number;
  totalWidth: number;
  isRtl?: boolean;
  focusedDoctorId?: string | null;
  onFocusedDoctorChange?: (doctorId: string | null) => void;
}

export const DoctorHeaderRow = memo(function DoctorHeaderRow(
  props: DoctorHeaderRowProps
) {
  const { t } = useTranslation();

  return (
    <div
      className="relative h-16 shrink-0"
      style={{ width: `${props.totalWidth}px` }}
    >
      {props.doctors.map((doctor, doctorIndex) => {
        const doctorEvents = props.eventsByDoctorId.get(doctor.id);
        const appointmentCount = doctorEvents?.length ?? 0;
        const hasNoVisits = appointmentCount === 0;
        const isArchived = doctor.isArchived === true;
        const isLastColumn = doctorIndex === props.doctors.length - 1;
        const offsetMultiplier = props.isRtl ? -1 : 1;
        const columnOffset = doctorIndex * props.columnWidth * offsetMultiplier;
        const doctorSpecialty = doctor.specialty.trim();
        const appointmentCountLabel = t(
          'bigCalendar.doctorHeaderAppointmentCount',
          { count: appointmentCount }
        );
        const doctorDetails = doctorSpecialty
          ? `${doctorSpecialty}, ${appointmentCountLabel}`
          : appointmentCountLabel;
        const isFocused = props.focusedDoctorId === doctor.id;
        const canFocusDoctor =
          (props.doctors.length > 1 || isFocused) &&
          !!props.onFocusedDoctorChange;
        const doctorHeaderCellClassName = cn(
          'absolute top-0 flex h-16 items-center overflow-hidden px-3 py-2 transition-colors',
          !isLastColumn && 'border-e',
          hasNoVisits
            ? 'bg-muted/50'
            : isArchived
              ? 'bg-muted/30'
              : 'bg-background-surface/50',
          canFocusDoctor &&
            'cursor-pointer hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isFocused && 'bg-primary/10'
        );
        const doctorHeaderClassName = cn(
          'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg p-1',
          hasNoVisits && 'opacity-50 grayscale'
        );
        const doctorHeaderContent = (
          <span className={doctorHeaderClassName}>
            <UserAvatar
              name={doctor.name}
              imageUrl={doctor.avatar}
              color={doctor.color}
              size="md"
              className="shrink-0"
            />
            <span className="flex min-w-0 flex-1 flex-col items-start overflow-hidden">
              <TruncateText
                as="span"
                className="text-sm font-medium text-text-primary"
              >
                {doctor.name}
              </TruncateText>
              <TruncateText as="span" className="text-xs text-text-secondary">
                {doctorDetails}
              </TruncateText>
            </span>
          </span>
        );

        return canFocusDoctor ? (
          <button
            key={doctor.id}
            type="button"
            className={doctorHeaderCellClassName}
            style={{
              width: `${props.columnWidth}px`,
              transform: `translateX(${columnOffset}px)`
            }}
            onClick={() =>
              props.onFocusedDoctorChange?.(isFocused ? null : doctor.id)
            }
          >
            {doctorHeaderContent}
          </button>
        ) : (
          <div
            key={doctor.id}
            className={doctorHeaderCellClassName}
            style={{
              width: `${props.columnWidth}px`,
              transform: `translateX(${columnOffset}px)`
            }}
          >
            {doctorHeaderContent}
          </div>
        );
      })}
    </div>
  );
});
