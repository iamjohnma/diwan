import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common/truncate-text';
import { Button, Combobox } from '@/components/ui';
import { useTimeZoneSelector } from '@/hooks/common';

interface TimeZoneSelectorProps {
  value: string;
  onChange: (timeZone: string) => void;
}

export function TimeZoneSelector(props: TimeZoneSelectorProps) {
  const translation = useTranslation();
  const timeZoneSelector = useTimeZoneSelector({
    value: props.value,
    onChange: props.onChange
  });

  return (
    <Combobox
      open={timeZoneSelector.isOpen}
      onOpenChange={timeZoneSelector.handleOpenChange}
      items={timeZoneSelector.options}
      value={props.value}
      onValueChange={timeZoneSelector.handleSelect}
      getItemValue={(option) => option.value}
      getItemLabel={(option) => option.longName}
      getItemSearchValue={(option) => option.searchLabel}
      filterItems={false}
      align="start"
      sideOffset={8}
      matchTriggerWidth={false}
      contentClassName="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-[440px]"
      listClassName="max-h-[min(28rem,70vh)] scroll-pt-8 px-1 pb-1 pt-0"
      itemClassName="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-2 px-3 py-2"
      motionKey="time-zone-highlight"
      search={{
        value: timeZoneSelector.query,
        onValueChange: timeZoneSelector.setQuery,
        placeholder: translation.t('bigCalendar.timeZone.searchPlaceholder'),
        autoFocus: true
      }}
      noResultsLabel={
        timeZoneSelector.query.trim()
          ? translation.t('common.dataTable.criteriaEmptyDescription')
          : translation.t('bigCalendar.timeZone.noResults')
      }
      getItemSectionKey={(option) => option.offsetLabel}
      renderSectionHeader={(section) => (
        <div className="sticky top-0 z-20 -mx-1 flex items-center border-b border-border-default bg-background-base/95 px-3 py-1.5 text-xs font-semibold text-text-tertiary backdrop-blur-sm">
          <span className="tabular-nums">
            {section.firstItem.compactOffsetLabel}
          </span>
        </div>
      )}
      virtualization={{
        estimateItemSize: 36,
        estimateSectionHeaderSize: 29,
        overscan: 8
      }}
      renderTrigger={() => (
        <Button
          variant="ghost"
          className="h-full min-h-0 w-full min-w-0 justify-center rounded-none px-0.5 py-0 text-center text-[10px] font-medium leading-tight text-text-secondary md:px-0 md:text-sm md:leading-normal"
        >
          <TruncateText className="text-center text-inherit">
            {timeZoneSelector.triggerLabel}
          </TruncateText>
        </Button>
      )}
      renderOption={(option) => (
        <>
          <span className="shrink-0 text-sm text-inherit tabular-nums">
            {option.offsetLabel}
          </span>
          <TruncateText className="text-inherit">
            {option.longName}
          </TruncateText>
        </>
      )}
    />
  );
}
