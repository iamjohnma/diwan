import { memo } from 'react';
import type { ReactNode } from 'react';
import { DatabaseIcon, TrashIcon } from '@phosphor-icons/react';
import type {
  BigCalendarProps,
  CalendarBranchFilterProps,
  CalendarEvent
} from '@/@types/common/big-calendar';
import {
  DateNavigator,
  type DateNavigatorProps
} from '@/components/common/big-calendar/header/date-navigator';
import {
  FullScreenButton,
  type FullScreenButtonProps
} from '@/components/common/big-calendar/header/fullscreen-button';
import {
  RangeDaysSelect,
  type RangeDaysSelectProps
} from '@/components/common/big-calendar/header/range-days-select';
import {
  ViewSwitcher,
  type ViewSwitcherProps
} from '@/components/common/big-calendar/header/view-switcher';
import { BranchScopeSelect } from '@/components/common/branch-scope-select';
import { TruncateText } from '@/components/common/truncate-text';
import { IconButton } from '@/components/ui/icon-button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/common/cn';

export interface CalendarHeaderProps {
  events: CalendarEvent[];
  selectedEventIds: Set<CalendarEvent['id']>;
  deleteSelectedEvents: () => void;
  onEventsDelete?: BigCalendarProps['onEventsDelete'];
  showCountSection?: boolean;
  countValue?: number;
  countLabel?: string;
  headerClassName?: string;
  isFullScreen?: boolean;
  showDateNavigator: boolean;
  showViewSwitcher: boolean;
  showFullScreenButton: boolean;
  renderHeaderActions?: () => ReactNode;
  branchFilter?: CalendarBranchFilterProps;
  dateNavigatorProps: DateNavigatorProps;
  rangeDaysSelectProps: RangeDaysSelectProps;
  viewSwitcherProps: ViewSwitcherProps;
  fullScreenButtonProps: FullScreenButtonProps;
}

export const CalendarHeader = memo(function CalendarHeader(
  props: CalendarHeaderProps
) {
  const { t } = useTranslation();
  const selectedCount = props.selectedEventIds.size;
  const hasSelection = selectedCount > 0;
  const canDelete = !!props.onEventsDelete;
  const showCountSection = props.showCountSection ?? true;
  const countValue = props.countValue ?? props.events.length;
  const defaultCountLabel = t('bigCalendar.visitsInView', {
    count: countValue
  });
  const countLabel = props.countLabel ?? defaultCountLabel;

  return (
    <div
      className={cn(
        'relative z-50 flex flex-row items-center justify-between gap-2 md:gap-4 border-b bg-background py-3 px-4 md:py-4 flex-wrap',
        props.headerClassName,
        props.isFullScreen && 'px-6'
      )}
    >
      {showCountSection && (
        <div className="hidden md:flex min-w-0 items-center gap-2 md:gap-3 shrink-0 overflow-hidden">
          <div className="bg-background-elevated size-9 md:size-10 flex items-center justify-center rounded-lg shrink-0">
            <DatabaseIcon
              className="size-5 md:size-6 text-text-secondary"
              weight="bold"
            />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-x-1 overflow-hidden text-sm text-text-tertiary w-[140px]">
            <p className="shrink-0 text-lg md:text-2xl font-semibold text-text-primary tabular-nums">
              {countValue}
            </p>
            <TruncateText
              as="p"
              className="mt-0.5 text-xs md:text-sm hidden sm:block"
            >
              {countLabel}
            </TruncateText>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 md:gap-3 flex-1 justify-start md:justify-center">
        {props.showDateNavigator && (
          <DateNavigator {...props.dateNavigatorProps} />
        )}
      </div>
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {hasSelection && (
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <span className="text-xs md:text-sm font-medium text-text-secondary tabular-nums whitespace-nowrap">
              {t('bigCalendar.selectedCount', { count: selectedCount })}
            </span>
            <IconButton
              aria-label={t('bigCalendar.deleteSelectedCount', {
                count: selectedCount
              })}
              size="equal"
              variant="outline"
              icon={TrashIcon}
              iconProps={{ weight: 'regular', className: 'size-4 md:size-5' }}
              tooltip={t('bigCalendar.deleteSelectedCount', {
                count: selectedCount
              })}
              disabled={!canDelete}
              onClick={props.deleteSelectedEvents}
              className="text-(--error) hover:bg-error-bg size-9 md:size-10"
            />
          </div>
        )}
        {props.branchFilter && <BranchScopeSelect {...props.branchFilter} />}
        <div className="hidden sm:block">
          <RangeDaysSelect {...props.rangeDaysSelectProps} />
        </div>
        {props.showViewSwitcher && (
          <ViewSwitcher {...props.viewSwitcherProps} />
        )}
        {props.showFullScreenButton && (
          <FullScreenButton {...props.fullScreenButtonProps} />
        )}
        {props.renderHeaderActions?.()}
      </div>
    </div>
  );
});

CalendarHeader.displayName = 'CalendarHeader';
