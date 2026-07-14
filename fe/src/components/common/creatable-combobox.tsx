import { useMemo, useState } from 'react';
import { normalizeSearchText } from '@diwan/shared/search-text';
import { PlusIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common/truncate-text';
import { Combobox } from '@/components/ui';

interface CreatableComboboxItem {
  kind: 'clear' | 'value' | 'option' | 'create';
  value: string;
  label: string;
}

interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  hasError?: boolean;
  /** Allow committing a typed value that is not in `options`. Default true. */
  allowCustom?: boolean;
  /** Offer a "clear" entry when a value is selected. Default true. */
  clearable?: boolean;
  clearLabel?: string;
}

/**
 * Single-value combobox with preset options plus free-text entry, built on the
 * shared {@link Combobox} primitive. Selecting an option or committing a typed
 * value stores the literal string via `onChange`.
 */
export function CreatableCombobox(props: CreatableComboboxProps) {
  const translation = useTranslation();
  const allowCustom = props.allowCustom ?? true;
  const clearable = props.clearable ?? true;
  const clearLabel = props.clearLabel ?? translation.t('common.clear');

  const [search, setSearch] = useState('');
  const trimmed = search.trim();

  const items = useMemo<CreatableComboboxItem[]>(() => {
    const list: CreatableComboboxItem[] = [];
    if (clearable && props.value) {
      list.push({ kind: 'clear', value: '', label: clearLabel });
    }
    if (props.value && !props.options.includes(props.value)) {
      list.push({ kind: 'value', value: props.value, label: props.value });
    }
    for (const option of props.options) {
      list.push({ kind: 'option', value: option, label: option });
    }
    const normalizedTrimmed = normalizeSearchText(trimmed);
    const matchesExisting = list.some(
      (item) =>
        item.kind !== 'clear' &&
        normalizeSearchText(item.value) === normalizedTrimmed
    );
    if (allowCustom && trimmed.length > 0 && !matchesExisting) {
      list.push({ kind: 'create', value: trimmed, label: trimmed });
    }

    return list;
  }, [allowCustom, clearLabel, clearable, props.options, props.value, trimmed]);

  return (
    <Combobox<CreatableComboboxItem>
      items={items}
      getItemValue={(item) => `${item.kind}:${item.value}`}
      getItemLabel={(item) => item.label}
      getItemSearchValue={(item) => (item.kind === 'clear' ? '' : item.label)}
      value={props.value ? `value:${props.value}` : ''}
      selectedValues={
        props.value
          ? [`value:${props.value}`, `option:${props.value}`]
          : undefined
      }
      disabled={props.disabled}
      placeholder={props.placeholder}
      hasError={props.hasError}
      filterItems
      search={{
        value: search,
        onValueChange: setSearch,
        placeholder: props.searchPlaceholder,
        showClearButton: true,
        clearLabel
      }}
      closeOnSelect
      onOpenChange={(open) => {
        // Reset the query when the popover OPENS, not when it closes. Clearing on
        // close re-renders the still-mounted list unfiltered during the exit
        // animation, flashing the full list as the popover animates away.
        if (open) {
          setSearch('');
        }
      }}
      onValueChange={(_, item) => {
        props.onChange(item.value);
      }}
      noResultsLabel={translation.t('common.noResults')}
      renderOption={(item) => {
        if (item.kind === 'create') {
          return (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <PlusIcon
                className="size-4 shrink-0 text-primary"
                weight="bold"
              />
              <TruncateText className="flex-1">
                {translation.t('common.addValue', { value: item.label })}
              </TruncateText>
            </span>
          );
        }
        if (item.kind === 'clear') {
          return (
            <span className="flex-1 text-text-tertiary">{item.label}</span>
          );
        }

        return <TruncateText className="flex-1">{item.label}</TruncateText>;
      }}
    />
  );
}
