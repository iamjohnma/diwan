import { CalendarXIcon } from '@phosphor-icons/react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { useTranslation } from 'react-i18next';

export function RangeViewCompactNotice() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center border-b py-4 sm:hidden">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarXIcon className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{t('bigCalendar.weekViewNotAvailable')}</EmptyTitle>
          <EmptyDescription>
            {t('bigCalendar.switchToOtherView')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
