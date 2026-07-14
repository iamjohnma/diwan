import { useMemo } from 'react';
import { BuildingsIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { CalendarBranchFilterProps } from '@/@types/common/big-calendar';
import { TruncateText } from '@/components/common/truncate-text';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { useBreakpoint } from '@/hooks/common';

export function BranchScopeSelect(props: CalendarBranchFilterProps) {
  const translation = useTranslation();
  const breakpoint = useBreakpoint();
  const allBranchesLabel = translation.t('calendarPage.branchScope.all');
  const selectedBranchLabel = useMemo(() => {
    if (props.value === 'all') {
      return allBranchesLabel;
    }

    const branch = props.branches.find((item) => item.id === props.value);

    return branch?.name ?? translation.t('calendarPage.branchScope.label');
  }, [allBranchesLabel, props.branches, props.value, translation]);

  const content = (
    <SelectContent align="end" className="max-w-[200px]">
      <SelectItem value="all" itemLabel={allBranchesLabel}>
        <TruncateText>{allBranchesLabel}</TruncateText>
      </SelectItem>
      {props.branches.map((branch) => (
        <SelectItem key={branch.id} value={branch.id} itemLabel={branch.name}>
          <TruncateText>{branch.name}</TruncateText>
        </SelectItem>
      ))}
    </SelectContent>
  );

  return (
    <Select
      value={props.value}
      onValueChange={props.onValueChange}
      disabled={props.disabled}
    >
      {breakpoint.isMobile ? (
        <SelectTrigger
          disabled={props.disabled}
          className="h-9 w-9 shrink-0 items-center justify-center px-0 [&>svg:last-child]:hidden"
        >
          <BuildingsIcon className="size-4" weight="bold" />
        </SelectTrigger>
      ) : (
        <SelectTrigger
          disabled={props.disabled}
          className="min-w-40 max-w-[200px] [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1"
        >
          <SelectValue
            placeholder={translation.t('calendarPage.branchScope.label')}
          >
            <TruncateText className="flex-1">
              {selectedBranchLabel}
            </TruncateText>
          </SelectValue>
        </SelectTrigger>
      )}
      {content}
    </Select>
  );
}
