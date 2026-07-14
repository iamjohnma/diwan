import { UsersIcon } from '@phosphor-icons/react';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { useTranslation } from 'react-i18next';

export function DoctorViewEmptyState() {
  const { t } = useTranslation();
  const calendar = useCalendarContext();

  const emptyOverride = calendar.renderers?.doctorViewEmptyState;
  const emptyTitle = emptyOverride?.title ?? t('bigCalendar.noDoctors');
  const emptyDescription =
    emptyOverride !== undefined
      ? emptyOverride.description
      : t('bigCalendar.noDoctorsDescription');

  return (
    <div className="flex h-full min-h-0">
      <Empty className="h-full w-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          {emptyDescription && (
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    </div>
  );
}
