import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChartSectionHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
  children?: ReactNode;
}

export function ChartSectionHeader(props: ChartSectionHeaderProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row items-center justify-between gap-2 p-0 md:p-0',
        props.className
      )}
    >
      <CardTitle className="flex flex-col gap-y-0">
        <span className="text-base font-semibold text-text-primary">
          {props.title}
        </span>
        <span className="hidden text-sm font-normal text-text-tertiary md:block">
          {props.subtitle}
        </span>
      </CardTitle>
      <div className="flex items-center gap-1.5">{props.children}</div>
    </CardHeader>
  );
}

interface ChartPeriodSelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; labelKey: string }>;
  onValueChange: (value: T) => void;
  triggerClassName?: string;
}

export function ChartPeriodSelect<T extends string>(
  props: ChartPeriodSelectProps<T>
) {
  const translation = useTranslation();
  const selectedOption =
    props.options.find((option) => option.value === props.value) ??
    props.options[0];

  return (
    <Select
      onValueChange={(value) => props.onValueChange(value as T)}
      value={props.value}
    >
      <SelectTrigger
        className={cn(
          'h-9 w-auto min-w-[90px] text-sm md:h-9 md:min-w-[120px] md:text-sm',
          props.triggerClassName
        )}
      >
        <SelectValue>{translation.t(selectedOption.labelKey)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end" sideOffset={4}>
        {props.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {translation.t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
