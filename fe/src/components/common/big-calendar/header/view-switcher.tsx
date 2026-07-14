import type { Icon } from '@phosphor-icons/react';
import {
  ListIcon,
  SquaresFourIcon,
  UsersThreeIcon
} from '@phosphor-icons/react';
import type { CalendarView } from '@/@types/common/big-calendar';
import { IconButton } from '@/components/ui/icon-button';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useTranslation } from 'react-i18next';
import { CALENDAR_VIEW_ORDER as VIEW_ORDER } from '@/utils/common/big-calendar';
import { cn } from '@/utils/common/cn';

const VIEW_ICONS: Record<CalendarView, Icon> = {
  range: ListIcon,
  month: SquaresFourIcon,
  doctor: UsersThreeIcon
};

const MOBILE_VIEW_ORDER = VIEW_ORDER.filter((view) => view !== 'month');

export interface ViewSwitcherProps {
  view: BigCalendarResultHook['view'];
  setView: BigCalendarResultHook['setView'];
  availableViews?: readonly CalendarView[];
  viewLabels?: Partial<Record<CalendarView, string>>;
}

export function ViewSwitcher(props: ViewSwitcherProps) {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();
  const availableViews = props.availableViews ?? VIEW_ORDER;
  const visibleViews = (isMobile ? MOBILE_VIEW_ORDER : VIEW_ORDER).filter(
    (view) => availableViews.includes(view)
  );

  if (visibleViews.length <= 1) {
    return null;
  }

  return (
    <div className="inline-flex first:rounded-e-none last:rounded-s-none [&:not(:first-child):not(:last-child)]:rounded-none xl:gap-1">
      {visibleViews.map((viewOption, index) => {
        const isFirst = index === 0;
        const isLast = index === visibleViews.length - 1;

        let roundedClass: string;
        if (isFirst) roundedClass = 'rounded-e-none xl:rounded-e-lg';
        else if (isLast)
          roundedClass = '-ms-px xl:ms-0 rounded-s-none xl:rounded-s-lg';
        else roundedClass = '-ms-px xl:ms-0 rounded-none xl:rounded-lg';

        const Icon = VIEW_ICONS[viewOption];
        const isSelected = viewOption === props.view;
        const viewLabel =
          props.viewLabels?.[viewOption] ??
          (viewOption === 'range'
            ? t('bigCalendar.viewByDays')
            : viewOption === 'month'
              ? t('bigCalendar.viewByMonth')
              : t('bigCalendar.viewByDoctor'));

        return (
          <IconButton
            key={viewOption}
            aria-label={viewLabel}
            size="equal"
            variant="outline"
            icon={Icon}
            iconProps={{
              weight: 'regular',
              className: cn(
                'size-5',
                isSelected ? 'text-secondary-foreground' : 'text-text-secondary'
              )
            }}
            tooltip={viewLabel}
            className={cn(
              'size-10',
              roundedClass,
              'duration-100',
              'xl:border-transparent xl:bg-transparent xl:hover:bg-secondary xl:active:bg-secondary-active',
              isSelected &&
                'bg-primary/10 hover:bg-primary/13 z-10 border-primary/20 xl:border-transparent xl:bg-secondary xl:hover:bg-secondary-hover'
            )}
            onClick={() => props.setView(viewOption)}
          />
        );
      })}
    </div>
  );
}
