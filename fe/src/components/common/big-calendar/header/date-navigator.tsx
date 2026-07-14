import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { IconButton } from '@/components/ui/icon-button';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar';
import { useTranslation } from 'react-i18next';
import { useMouseImmediatePress } from '@/hooks/common/mouse-immediate-press';
import { rangeText } from '@/utils/common/big-calendar';

export interface DateNavigatorProps {
  view: BigCalendarResultHook['view'];
  selectedDate: BigCalendarResultHook['selectedDate'];
  weekStartsOn: BigCalendarResultHook['weekStartsOn'];
  rangeDays: BigCalendarResultHook['rangeDays'];
  setSelectedDate: BigCalendarResultHook['setSelectedDate'];
  goToPrevious: BigCalendarResultHook['goToPrevious'];
  goToNext: BigCalendarResultHook['goToNext'];
}

const NAV_ICON_PROPS = {
  className: 'size-5 md:size-6 text-text-tertiary rtl:rotate-180',
  weight: 'regular'
} as const;

const NAV_BUTTON_CLASS =
  'size-9 md:size-10 xl:border-transparent xl:bg-transparent xl:hover:bg-secondary xl:active:bg-secondary-active';

export function DateNavigator(props: DateNavigatorProps) {
  const { t, i18n } = useTranslation();

  const locale = i18n.language === 'ar' ? ar : enUS;
  const currentRangeText = rangeText(
    props.view,
    props.selectedDate,
    props.weekStartsOn,
    locale,
    props.rangeDays
  );
  const showDatePicker = props.view === 'range' || props.view === 'doctor';
  const { bindPress } = useMouseImmediatePress();
  const previousPress = bindPress(props.goToPrevious);
  const nextPress = bindPress(props.goToNext);

  return (
    <div className="flex items-center">
      <IconButton
        aria-label={t('common.tooltips.previous')}
        {...previousPress}
        variant="outline"
        size="equal"
        icon={CaretLeftIcon}
        iconProps={NAV_ICON_PROPS}
        tooltip={t('common.tooltips.previous')}
        className={NAV_BUTTON_CLASS}
      />
      {showDatePicker ? (
        <label className="relative cursor-pointer inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-base md:text-lg font-medium text-text-primary transition-colors hover:bg-background-elevated focus-within:ring-1 focus-within:ring-border-default">
          {currentRangeText}
          <input
            aria-label={t('calendarPage.datePickerLabel')}
            className="absolute inset-0 cursor-pointer opacity-0"
            type="date"
            value={format(props.selectedDate, 'yyyy-MM-dd')}
            onChange={(event) => {
              const [year, month, day] = event.target.value
                .split('-')
                .map(Number);
              if (year && month && day)
                props.setSelectedDate(new Date(year, month - 1, day));
            }}
          />
        </label>
      ) : (
        <span className="text-base md:text-lg font-medium text-text-primary px-3 py-1.5 text-center">
          {currentRangeText}
        </span>
      )}
      <IconButton
        aria-label={t('common.tooltips.next')}
        {...nextPress}
        variant="outline"
        size="equal"
        icon={CaretRightIcon}
        iconProps={NAV_ICON_PROPS}
        tooltip={t('common.tooltips.next')}
        className={NAV_BUTTON_CLASS}
      />
    </div>
  );
}
