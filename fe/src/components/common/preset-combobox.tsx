import { useMemo, useState } from 'react';
import { normalizeSearchText } from '@diwan/shared/search-text';
import { CheckIcon, PlusIcon } from '@phosphor-icons/react';
import { TruncateText } from '@/components/common/truncate-text';
import { Combobox } from '@/components/ui';

const NONE_VALUE = '__none__';
const CREATE_VALUE = '__create__';

export interface PresetComboboxItem {
  id: string;
  name: string;
}

export interface PresetComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  items: ReadonlyArray<PresetComboboxItem>;
  isLoading?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  /**
   * When provided, an inline "create" row surfaces whenever the trimmed search
   * has no exact (case-insensitive) name match. Choosing it invokes this with
   * the typed value (the caller stages/persists it and selects its id).
   */
  onCreateOption?: (name: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  noResultsLabel: string;
  /** Builds the inline create row label, e.g. (name) => `Create "${name}"`. */
  getCreateLabel: (name: string) => string;
  /**
   * When provided, a "none" row is shown at the top and selecting it emits
   * `null`. Omit for required fields where a value must be chosen.
   */
  noneLabel?: string;
}

/**
 * A searchable single-select combobox whose option id is distinct from its
 * label, with optional inline "create a new value" support. The selected id is
 * what gets stored, while the label is what's shown — so callers can store a
 * stable id/marker yet display a localized or formatted name. Pure presentation:
 * callers inject every label and own the staging/persistence of created options.
 *
 * Shared by the patient insurance picker and the cheque bank-name picker.
 */
export function PresetCombobox(props: PresetComboboxProps) {
  const [query, setQuery] = useState('');
  const selectedValue =
    props.value && props.value !== NONE_VALUE ? props.value : '';

  const trimmedQuery = query.trim();
  const canShowCreate = useMemo(() => {
    if (!props.onCreateOption || trimmedQuery.length === 0) {
      return false;
    }
    const needle = normalizeSearchText(trimmedQuery);

    return !props.items.some(
      (item) => normalizeSearchText(item.name) === needle
    );
  }, [props.items, props.onCreateOption, trimmedQuery]);

  const options = useMemo<PresetComboboxItem[]>(() => {
    const list: PresetComboboxItem[] = [];
    if (props.noneLabel !== undefined) {
      list.push({ id: NONE_VALUE, name: props.noneLabel });
    }
    list.push(...props.items.map((item) => ({ id: item.id, name: item.name })));
    if (canShowCreate) {
      list.push({ id: CREATE_VALUE, name: trimmedQuery });
    }

    return list;
  }, [canShowCreate, props.items, props.noneLabel, trimmedQuery]);

  return (
    <Combobox<PresetComboboxItem>
      items={options}
      value={selectedValue}
      onValueChange={(value) => {
        if (value === CREATE_VALUE) {
          props.onCreateOption?.(trimmedQuery);
          setQuery('');

          return;
        }
        props.onChange(value === NONE_VALUE ? null : value);
      }}
      getItemValue={(item) => item.id}
      getItemLabel={(item) => item.name}
      getItemSearchValue={(item) => item.name}
      disabled={props.disabled}
      placeholder={props.placeholder}
      hasError={props.hasError}
      isLoading={props.isLoading}
      emptyLabel={props.emptyLabel}
      noResultsLabel={props.noResultsLabel}
      search={{
        value: query,
        onValueChange: setQuery,
        placeholder: props.searchPlaceholder
      }}
      renderOption={(item, ctx) =>
        item.id === CREATE_VALUE ? (
          <>
            <PlusIcon className="size-4 shrink-0 text-primary" weight="bold" />
            <TruncateText className="flex-1 text-inherit">
              {props.getCreateLabel(item.name)}
            </TruncateText>
          </>
        ) : (
          <>
            <TruncateText className="flex-1 text-inherit">
              {item.name}
            </TruncateText>
            {ctx.selected ? (
              <CheckIcon
                className="size-4 shrink-0 text-current"
                weight="bold"
              />
            ) : null}
          </>
        )
      }
    />
  );
}
