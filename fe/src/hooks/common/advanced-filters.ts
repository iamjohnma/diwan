import { useEffect, useRef, useSyncExternalStore } from 'react';
import type {
  FilterConnector,
  FilterFieldDefinition,
  FilterGroup,
  FilterItem,
  FilterOperator,
  FilterRule
} from '@/@types/common/advanced-filters';
import { OPERATORS_BY_TYPE } from '@/@types/common/advanced-filters';

type StoreListener = () => void;

export interface AdvancedFiltersSnapshot {
  root: FilterGroup;
  appliedRoot: FilterGroup;
  isActive: boolean;
  activeRuleCount: number;
  hasPendingChanges: boolean;
  serializedFilter?: string;
  fields: FilterFieldDefinition[];
}

export interface AdvancedFiltersResultHook {
  readonly root: FilterGroup;
  readonly fields: FilterFieldDefinition[];
  initialize: () => void;
  addRule: (groupId: string) => void;
  addGroup: (groupId: string) => void;
  removeItem: (itemId: string, parentGroupId: string) => void;
  duplicateItem: (itemId: string, parentGroupId: string) => void;
  turnIntoGroup: (ruleId: string, parentGroupId: string) => void;
  updateRule: (ruleId: string, updates: Partial<FilterRule>) => void;
  updateGroupConnector: (groupId: string, connector: FilterConnector) => void;
  clearAll: () => void;
  apply: () => void;
  subscribe: (listener: StoreListener) => () => void;
  getSnapshot: () => AdvancedFiltersSnapshot;
  setFields: (fields: FilterFieldDefinition[]) => void;
}

function createClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );
}

function createRootGroup(): FilterGroup {
  return { id: createClientId(), type: 'group', connector: 'and', items: [] };
}

function cloneRoot(root: FilterGroup): FilterGroup {
  return structuredClone(root);
}

function defaultOperator(field?: FilterFieldDefinition): FilterOperator {
  return field
    ? (OPERATORS_BY_TYPE[field.type][0]?.value ?? 'contains')
    : 'contains';
}

function defaultValue(
  field: FilterFieldDefinition | undefined,
  operator = defaultOperator(field)
): FilterRule['value'] {
  if (operator === 'isAnyOf' || operator === 'isNoneOf') return [];
  if (field?.type === 'number') return '';
  return '';
}

function createRule(fields: FilterFieldDefinition[]): FilterRule {
  const field = fields[0];
  const operator = defaultOperator(field);
  return {
    id: createClientId(),
    type: 'rule',
    field: field?.id ?? '',
    operator,
    value: defaultValue(field, operator)
  };
}

function createGroup(fields: FilterFieldDefinition[]): FilterGroup {
  return {
    id: createClientId(),
    type: 'group',
    connector: 'and',
    items: [createRule(fields)]
  };
}

function mapGroup(
  group: FilterGroup,
  groupId: string,
  update: (group: FilterGroup) => FilterGroup
): FilterGroup {
  if (group.id === groupId) return update(group);
  return {
    ...group,
    items: group.items.map((item) =>
      item.type === 'group' ? mapGroup(item, groupId, update) : item
    )
  };
}

function mapRule(
  group: FilterGroup,
  ruleId: string,
  updates: Partial<FilterRule>
): FilterGroup {
  return {
    ...group,
    items: group.items.map((item) => {
      if (item.type === 'group') return mapRule(item, ruleId, updates);
      return item.id === ruleId ? { ...item, ...updates } : item;
    })
  };
}

function cloneItem(item: FilterItem): FilterItem {
  const copy = structuredClone(item);
  const refreshIds = (candidate: FilterItem): FilterItem => {
    if (candidate.type === 'rule')
      return { ...candidate, id: createClientId() };
    return {
      ...candidate,
      id: createClientId(),
      items: candidate.items.map(refreshIds)
    };
  };
  return refreshIds(copy);
}

function validRule(rule: FilterRule): boolean {
  if (['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'].includes(rule.operator)) {
    return true;
  }
  return Array.isArray(rule.value)
    ? rule.value.length > 0
    : String(rule.value).trim().length > 0;
}

function pruneGroup(group: FilterGroup): FilterGroup {
  const items: FilterItem[] = [];
  for (const item of group.items) {
    if (item.type === 'rule') {
      if (validRule(item)) items.push(item);
      continue;
    }
    const nested = pruneGroup(item);
    if (nested.items.length > 0) items.push(nested);
  }
  return {
    ...group,
    items
  };
}

function countRules(group: FilterGroup): number {
  return group.items.reduce(
    (count, item) => count + (item.type === 'rule' ? 1 : countRules(item)),
    0
  );
}

function equalRoots(a: FilterGroup, b: FilterGroup): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function createController(
  initialFields: FilterFieldDefinition[],
  onApply: (serializedFilter: string | undefined) => void
): AdvancedFiltersResultHook {
  let fields = initialFields;
  let draftRoot = createRootGroup();
  let appliedRoot = createRootGroup();
  const listeners = new Set<StoreListener>();
  const notify = () => listeners.forEach((listener) => listener());

  const snapshot = (): AdvancedFiltersSnapshot => {
    const activeRuleCount = countRules(appliedRoot);
    return {
      root: draftRoot,
      appliedRoot,
      isActive: activeRuleCount > 0,
      activeRuleCount,
      hasPendingChanges: !equalRoots(draftRoot, appliedRoot),
      serializedFilter:
        activeRuleCount > 0 ? JSON.stringify(appliedRoot) : undefined,
      fields
    };
  };

  const controller: AdvancedFiltersResultHook = {
    get root() {
      return draftRoot;
    },
    get fields() {
      return fields;
    },
    initialize() {
      draftRoot = cloneRoot(appliedRoot);
      notify();
    },
    addRule(groupId) {
      draftRoot = mapGroup(draftRoot, groupId, (group) => ({
        ...group,
        items: [...group.items, createRule(fields)]
      }));
      notify();
    },
    addGroup(groupId) {
      draftRoot = mapGroup(draftRoot, groupId, (group) => ({
        ...group,
        items: [...group.items, createGroup(fields)]
      }));
      notify();
    },
    removeItem(itemId, parentGroupId) {
      draftRoot = mapGroup(draftRoot, parentGroupId, (group) => ({
        ...group,
        items: group.items.filter((item) => item.id !== itemId)
      }));
      notify();
    },
    duplicateItem(itemId, parentGroupId) {
      draftRoot = mapGroup(draftRoot, parentGroupId, (group) => {
        const index = group.items.findIndex((item) => item.id === itemId);
        if (index < 0) return group;
        const items = [...group.items];
        items.splice(index + 1, 0, cloneItem(items[index] as FilterItem));
        return { ...group, items };
      });
      notify();
    },
    turnIntoGroup(ruleId, parentGroupId) {
      draftRoot = mapGroup(draftRoot, parentGroupId, (group) => ({
        ...group,
        items: group.items.map((item) =>
          item.id === ruleId && item.type === 'rule'
            ? {
                id: createClientId(),
                type: 'group' as const,
                connector: 'and' as const,
                items: [item]
              }
            : item
        )
      }));
      notify();
    },
    updateRule(ruleId, updates) {
      draftRoot = mapRule(draftRoot, ruleId, updates);
      notify();
    },
    updateGroupConnector(groupId, connector) {
      draftRoot = mapGroup(draftRoot, groupId, (group) => ({
        ...group,
        connector
      }));
      notify();
    },
    // apply/clearAll leave draftRoot untouched: the popover keeps the builder
    // mounted (and store-subscribed) while its exit animation plays, so
    // mutating the draft here makes rows vanish mid-close. initialize()
    // re-syncs the draft from appliedRoot on the next open.
    clearAll() {
      appliedRoot = createRootGroup();
      onApply(undefined);
      notify();
    },
    apply() {
      appliedRoot = pruneGroup(cloneRoot(draftRoot));
      onApply(
        countRules(appliedRoot) > 0 ? JSON.stringify(appliedRoot) : undefined
      );
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: snapshot,
    setFields(nextFields) {
      fields = nextFields;
      notify();
    }
  };
  return controller;
}

export function useAdvancedFilters(props: {
  fields: FilterFieldDefinition[];
  onApply: (serializedFilter: string | undefined) => void;
}): AdvancedFiltersResultHook {
  const callbackRef = useRef(props.onApply);
  callbackRef.current = props.onApply;
  const controllerRef = useRef<AdvancedFiltersResultHook | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createController(props.fields, (value) =>
      callbackRef.current(value)
    );
  }
  useEffect(
    () => controllerRef.current?.setFields(props.fields),
    [props.fields]
  );
  return controllerRef.current;
}

export function useAdvancedFiltersSelector<T>(
  advancedFilters: AdvancedFiltersResultHook,
  selector: (snapshot: AdvancedFiltersSnapshot) => T
): T {
  return useSyncExternalStore(
    advancedFilters.subscribe,
    () => selector(advancedFilters.getSnapshot()),
    () => selector(advancedFilters.getSnapshot())
  );
}

export function getOperatorsForField(field?: FilterFieldDefinition) {
  return field ? OPERATORS_BY_TYPE[field.type] : [];
}

export function getDefaultRuleValue(
  field: FilterFieldDefinition | undefined,
  operator: FilterOperator
): FilterRule['value'] {
  return defaultValue(field, operator);
}
