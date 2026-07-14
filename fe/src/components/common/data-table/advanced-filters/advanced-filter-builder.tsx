import { useMemo, useState } from 'react';
import {
  CalendarBlankIcon,
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeIcon,
  FolderSimpleIcon,
  FunnelXIcon,
  HashIcon,
  ListBulletsIcon,
  PlusIcon,
  TextAaIcon,
  ToggleLeftIcon,
  TrashIcon
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type {
  FilterConnector as FilterConnectorType,
  FilterFieldDefinition,
  FilterOperator,
  FilterRule
} from '@/@types/common/advanced-filters';
import { MAX_NESTING_DEPTH } from '@/@types/common/advanced-filters';
import { TruncateText } from '@/components/common/truncate-text';
import {
  Button,
  Combobox,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/menu';
import type { AdvancedFiltersResultHook } from '@/hooks/common/advanced-filters';
import {
  getDefaultRuleValue,
  getOperatorsForField,
  useAdvancedFiltersSelector
} from '@/hooks/common/advanced-filters';
import { cn } from '@/lib/utils';

const FIELD_WIDTH = 'w-44 min-w-44 max-w-44';
const OPERATOR_WIDTH = 'w-28 min-w-28 max-w-28';
const VALUE_WIDTH = 'w-48 min-w-48 max-w-48';
const FIELD_TYPE_ICONS: Record<string, Icon> = {
  string: TextAaIcon,
  number: HashIcon,
  boolean: ToggleLeftIcon,
  enum: ListBulletsIcon,
  date: CalendarBlankIcon
};

function FieldSelect(props: {
  fields: FilterFieldDefinition[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = props.fields.find((field) => field.id === props.value);
  const SelectedIcon =
    selected?.icon ?? FIELD_TYPE_ICONS[selected?.type ?? 'string'];
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger className={cn('h-9 gap-2 ps-3 pe-2 text-sm', FIELD_WIDTH)}>
        <span className="flex min-w-0 items-center gap-2">
          {SelectedIcon ? (
            <SelectedIcon
              className="size-4 shrink-0 text-text-tertiary"
              weight="regular"
            />
          ) : null}
          <TruncateText>{selected?.label ?? ''}</TruncateText>
        </span>
      </SelectTrigger>
      <SelectContent>
        {props.fields.map((field) => {
          const FieldIcon = field.icon ?? FIELD_TYPE_ICONS[field.type];
          return (
            <SelectItem key={field.id} value={field.id}>
              <div className="flex items-center gap-2">
                {FieldIcon ? (
                  <FieldIcon
                    className="size-4 shrink-0 text-text-tertiary"
                    weight="regular"
                  />
                ) : null}
                <TruncateText>{field.label}</TruncateText>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function OperatorSelect(props: {
  field?: FilterFieldDefinition;
  value: FilterOperator;
  onChange: (value: FilterOperator) => void;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const operators = getOperatorsForField(props.field);
  const selected =
    operators.find((operator) => operator.value === props.value) ??
    operators[0];
  if (!selected) return null;
  return (
    <Select
      value={selected.value}
      onValueChange={(value) => props.onChange(value as FilterOperator)}
    >
      <SelectTrigger
        className={cn('h-9 gap-2 ps-3 pe-2 text-sm', OPERATOR_WIDTH)}
      >
        <SelectValue>
          <TruncateText>{t(selected.labelKey)}</TruncateText>
        </SelectValue>
      </SelectTrigger>
      <SelectContent matchTriggerWidth={false}>
        {operators.map((operator) => (
          <SelectItem key={operator.value} value={operator.value}>
            <TruncateText>{t(operator.labelKey)}</TruncateText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiSelectValue(props: {
  options: NonNullable<FilterFieldDefinition['options']>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const selectedLabels = useMemo(
    () =>
      props.value.flatMap((value) => {
        const option = props.options.find((item) => item.value === value);
        return option ? [option.label] : [];
      }),
    [props.options, props.value]
  );
  const toggle = (value: string) =>
    props.onChange(
      props.value.includes(value)
        ? props.value.filter((item) => item !== value)
        : [...props.value, value]
    );
  return (
    <Combobox
      items={props.options}
      selectionMode="multiple"
      selectedValues={props.value}
      onItemSelect={(option) => toggle(option.value)}
      closeOnSelect={false}
      getItemValue={(option) => option.value}
      getItemLabel={(option) => option.label}
      matchTriggerWidth
      renderTrigger={() => (
        <button
          type="button"
          className={cn(
            'flex h-9 items-center truncate rounded-lg border border-border-default bg-background-base px-3 text-sm transition-colors hover:border-border-strong',
            VALUE_WIDTH
          )}
        >
          <TruncateText
            className={cn(selectedLabels.length === 0 && 'text-text-tertiary')}
          >
            {selectedLabels.length > 0
              ? selectedLabels.join(', ')
              : t('common.advancedFilter.value')}
          </TruncateText>
        </button>
      )}
      renderOption={(option) => (
        <>
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-default',
              props.value.includes(option.value) &&
                'border-primary bg-primary text-primary-foreground'
            )}
          >
            {props.value.includes(option.value) ? (
              <CheckIcon className="size-3" weight="bold" />
            ) : null}
          </span>
          <TruncateText>{option.label}</TruncateText>
        </>
      )}
    />
  );
}

function ValueInput(props: {
  field?: FilterFieldDefinition;
  operator: FilterOperator;
  value: FilterRule['value'];
  onChange: (value: FilterRule['value']) => void;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const options = props.field?.options ?? [];
  if (props.field?.type === 'enum') {
    if (props.operator === 'isAnyOf' || props.operator === 'isNoneOf') {
      return (
        <MultiSelectValue
          options={options}
          value={Array.isArray(props.value) ? props.value : []}
          onChange={props.onChange}
        />
      );
    }
    const selected = options.find(
      (option) => option.value === String(props.value)
    );
    return (
      <Select value={selected?.value ?? ''} onValueChange={props.onChange}>
        <SelectTrigger
          className={cn('h-9 gap-2 ps-3 pe-2 text-sm', VALUE_WIDTH)}
        >
          <SelectValue placeholder={t('common.advancedFilter.value')}>
            {selected ? <TruncateText>{selected.label}</TruncateText> : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <TruncateText>{option.label}</TruncateText>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      type={
        props.field?.type === 'number'
          ? 'number'
          : props.field?.type === 'date'
            ? 'date'
            : 'text'
      }
      className={cn('h-9 text-sm', VALUE_WIDTH)}
      placeholder={t('common.advancedFilter.value')}
      value={Array.isArray(props.value) ? '' : String(props.value ?? '')}
      onChange={(event) =>
        props.onChange(
          props.field?.type === 'number' && event.target.value !== ''
            ? Number(event.target.value)
            : event.target.value
        )
      }
    />
  );
}

function FilterConnector(props: {
  connector: FilterConnectorType;
  isFirst: boolean;
  editable: boolean;
  onChange: (connector: FilterConnectorType) => void;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const label = t(`common.advancedFilter.${props.connector}`);
  if (props.isFirst) {
    return (
      <span className="w-12 shrink-0 text-center text-sm font-medium text-text-tertiary">
        <TruncateText>{t('common.advancedFilter.where')}</TruncateText>
      </span>
    );
  }
  if (!props.editable) {
    return (
      <span className="flex w-12 shrink-0 items-center justify-center rounded-lg border border-border-default bg-background-elevated px-2.5 py-1 text-sm font-medium text-text-secondary">
        {label}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/15">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => props.onChange('and')}>
          {t('common.advancedFilter.and')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => props.onChange('or')}>
          {t('common.advancedFilter.or')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ItemActions(props: {
  advancedFilters: AdvancedFiltersResultHook;
  itemId: string;
  parentGroupId: string;
  canGroup?: boolean;
}) {
  const translation = useTranslation();
  const { t } = translation;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-background-elevated hover:text-text-primary">
        <DotsThreeIcon className="size-4.5" weight="bold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="text-error"
          onClick={() =>
            props.advancedFilters.removeItem(props.itemId, props.parentGroupId)
          }
        >
          <TrashIcon className="size-4" weight="regular" />
          {t('common.advancedFilter.remove')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            props.advancedFilters.duplicateItem(
              props.itemId,
              props.parentGroupId
            )
          }
        >
          <CopyIcon className="size-4" weight="regular" />
          {t('common.advancedFilter.duplicate')}
        </DropdownMenuItem>
        {props.canGroup ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                props.advancedFilters.turnIntoGroup(
                  props.itemId,
                  props.parentGroupId
                )
              }
            >
              <FolderSimpleIcon className="size-4" weight="regular" />
              {t('common.advancedFilter.turnIntoGroup')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterGroupContent(props: {
  advancedFilters: AdvancedFiltersResultHook;
  group: import('@/@types/common/advanced-filters').FilterGroup;
  depth: number;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const canAddGroup = props.depth < MAX_NESTING_DEPTH;
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2.5',
        props.depth > 0 &&
          'rounded-xl border border-border-default bg-background-elevated/30 p-4'
      )}
    >
      {props.group.items.map((item, index) => {
        const connector = (
          <FilterConnector
            connector={props.group.connector}
            isFirst={index === 0}
            editable={index === 1}
            onChange={(value) =>
              props.advancedFilters.updateGroupConnector(props.group.id, value)
            }
          />
        );
        if (item.type === 'group') {
          return (
            <div key={item.id} className="flex min-w-0 items-start gap-2.5">
              {connector}
              <div className="min-w-0 flex-1">
                <FilterGroupContent
                  advancedFilters={props.advancedFilters}
                  group={item}
                  depth={props.depth + 1}
                />
              </div>
              <ItemActions
                advancedFilters={props.advancedFilters}
                itemId={item.id}
                parentGroupId={props.group.id}
              />
            </div>
          );
        }
        const field = props.advancedFilters.fields.find(
          (candidate) => candidate.id === item.field
        );
        const operator = getOperatorsForField(field).find(
          (candidate) => candidate.value === item.operator
        );
        return (
          <div key={item.id} className="flex items-center gap-2.5">
            {connector}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FieldSelect
                fields={props.advancedFilters.fields}
                value={item.field}
                onChange={(fieldId) => {
                  const nextField = props.advancedFilters.fields.find(
                    (candidate) => candidate.id === fieldId
                  );
                  const nextOperator =
                    getOperatorsForField(nextField)[0]?.value ?? 'contains';
                  props.advancedFilters.updateRule(item.id, {
                    field: fieldId,
                    operator: nextOperator,
                    value: getDefaultRuleValue(nextField, nextOperator)
                  });
                }}
              />
              <OperatorSelect
                field={field}
                value={item.operator}
                onChange={(nextOperator) =>
                  props.advancedFilters.updateRule(item.id, {
                    operator: nextOperator,
                    value: getDefaultRuleValue(field, nextOperator)
                  })
                }
              />
              {!operator?.noValue ? (
                <ValueInput
                  field={field}
                  operator={item.operator}
                  value={item.value}
                  onChange={(value) =>
                    props.advancedFilters.updateRule(item.id, { value })
                  }
                />
              ) : null}
            </div>
            <ItemActions
              advancedFilters={props.advancedFilters}
              itemId={item.id}
              parentGroupId={props.group.id}
              canGroup={canAddGroup}
            />
          </div>
        );
      })}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          {canAddGroup ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-fit gap-1.5 px-2.5 text-sm text-text-tertiary"
                    prefixIcon={PlusIcon}
                    prefixIconProps={{ weight: 'regular', className: 'size-4' }}
                    suffixIcon={CaretDownIcon}
                    suffixIconProps={{
                      weight: 'regular',
                      className: 'size-3.5'
                    }}
                  />
                }
              >
                {t('common.advancedFilter.addFilterRule')}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => props.advancedFilters.addRule(props.group.id)}
                >
                  <PlusIcon className="size-4" weight="regular" />
                  {t('common.advancedFilter.addFilterRule')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => props.advancedFilters.addGroup(props.group.id)}
                >
                  <PlusIcon className="size-4" weight="regular" />
                  {t('common.advancedFilter.addFilterGroup')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-fit px-2.5 text-sm text-text-tertiary"
              prefixIcon={PlusIcon}
              prefixIconProps={{ weight: 'regular', className: 'size-4' }}
              onClick={() => props.advancedFilters.addRule(props.group.id)}
            >
              {t('common.advancedFilter.addFilterRule')}
            </Button>
          )}
        </div>
        <div className="size-8 shrink-0" />
      </div>
    </div>
  );
}

export function AdvancedFilterBuilder(props: {
  advancedFilters: AdvancedFiltersResultHook;
  onClose?: () => void;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const root = useAdvancedFiltersSelector(
    props.advancedFilters,
    (snapshot) => snapshot.root
  );
  // Read once at mount instead of subscribing: applied state only changes via
  // apply()/clearAll(), which also close the popover — a live value would
  // toggle the clear button while the exit animation is still showing the
  // panel. The panel remounts on every open, so mount-time is always fresh.
  const [isActive] = useState(
    () => props.advancedFilters.getSnapshot().isActive
  );
  const apply = () => {
    props.onClose?.();
    props.advancedFilters.apply();
  };
  return (
    <form
      className="flex max-h-full min-h-0 w-max max-w-full flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <FilterGroupContent
          advancedFilters={props.advancedFilters}
          group={root}
          depth={0}
        />
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-border-default p-4">
        <div>
          {isActive ? (
            <IconButton
              type="button"
              variant="outline"
              size="equal"
              className="size-9 text-text-tertiary hover:border-primary/30 hover:text-primary"
              icon={FunnelXIcon}
              iconProps={{ weight: 'regular', className: 'size-4.5' }}
              aria-label={t('common.advancedFilter.clearFilter')}
              tooltip={t('common.advancedFilter.clearFilter')}
              onClick={() => {
                props.onClose?.();
                props.advancedFilters.clearAll();
              }}
            />
          ) : null}
        </div>
        <Button type="submit" size="sm" className="h-10 px-8">
          {t('common.advancedFilter.saveChanges')}
        </Button>
      </div>
    </form>
  );
}
