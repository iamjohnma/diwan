import { useTranslation } from 'react-i18next';
import type { RangeDays } from '@/@types/common/big-calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import type { BigCalendarResultHook } from '@/hooks/common/big-calendar';

const RANGE_OPTIONS: RangeDays[] = [1, 2, 3, 4, 5, 6, 7];

export interface RangeDaysSelectProps {
  view: BigCalendarResultHook['view'];
  rangeDays: BigCalendarResultHook['rangeDays'];
  setRangeDays: BigCalendarResultHook['setRangeDays'];
}

export function RangeDaysSelect(props: RangeDaysSelectProps) {
  const translation = useTranslation();

  if (props.view !== 'range') return null;

  return (
    <Select
      value={String(props.rangeDays)}
      onValueChange={(value) => props.setRangeDays(Number(value) as RangeDays)}
    >
      <SelectTrigger className="w-24 text-sm">
        <SelectValue>
          {props.rangeDays} {translation.t('bigCalendar.daysLabel')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {option} {translation.t('bigCalendar.daysLabel')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
