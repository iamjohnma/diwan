export type FilterFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date';

export type FilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isTrue'
  | 'isFalse'
  | 'is'
  | 'isNot'
  | 'isAnyOf'
  | 'isNoneOf';

export interface OperatorConfig {
  value: FilterOperator;
  labelKey: `common.advancedFilter.operators.${FilterOperator}`;
  noValue?: boolean;
}

export interface FilterFieldOption {
  label: string;
  value: string;
}

export interface FilterFieldDefinition {
  id: string;
  label: string;
  type: FilterFieldType;
  icon?: React.ElementType;
  options?: FilterFieldOption[];
}

export interface FilterRule {
  id: string;
  type: 'rule';
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[];
}

export type FilterConnector = 'and' | 'or';
export type FilterItem = FilterRule | FilterGroup;

export interface FilterGroup {
  id: string;
  type: 'group';
  connector: FilterConnector;
  items: FilterItem[];
}

const STRING_OPERATORS: OperatorConfig[] = [
  { value: 'contains', labelKey: 'common.advancedFilter.operators.contains' },
  {
    value: 'notContains',
    labelKey: 'common.advancedFilter.operators.notContains'
  },
  { value: 'equals', labelKey: 'common.advancedFilter.operators.equals' },
  { value: 'notEquals', labelKey: 'common.advancedFilter.operators.notEquals' },
  {
    value: 'startsWith',
    labelKey: 'common.advancedFilter.operators.startsWith'
  },
  { value: 'endsWith', labelKey: 'common.advancedFilter.operators.endsWith' },
  {
    value: 'isEmpty',
    labelKey: 'common.advancedFilter.operators.isEmpty',
    noValue: true
  },
  {
    value: 'isNotEmpty',
    labelKey: 'common.advancedFilter.operators.isNotEmpty',
    noValue: true
  }
];

const NUMBER_AND_DATE_OPERATORS: OperatorConfig[] = [
  { value: 'equals', labelKey: 'common.advancedFilter.operators.equals' },
  { value: 'notEquals', labelKey: 'common.advancedFilter.operators.notEquals' },
  {
    value: 'greaterThan',
    labelKey: 'common.advancedFilter.operators.greaterThan'
  },
  {
    value: 'greaterThanOrEqual',
    labelKey: 'common.advancedFilter.operators.greaterThanOrEqual'
  },
  { value: 'lessThan', labelKey: 'common.advancedFilter.operators.lessThan' },
  {
    value: 'lessThanOrEqual',
    labelKey: 'common.advancedFilter.operators.lessThanOrEqual'
  },
  {
    value: 'isEmpty',
    labelKey: 'common.advancedFilter.operators.isEmpty',
    noValue: true
  },
  {
    value: 'isNotEmpty',
    labelKey: 'common.advancedFilter.operators.isNotEmpty',
    noValue: true
  }
];

const BOOLEAN_OPERATORS: OperatorConfig[] = [
  {
    value: 'isTrue',
    labelKey: 'common.advancedFilter.operators.isTrue',
    noValue: true
  },
  {
    value: 'isFalse',
    labelKey: 'common.advancedFilter.operators.isFalse',
    noValue: true
  }
];

const ENUM_OPERATORS: OperatorConfig[] = [
  { value: 'is', labelKey: 'common.advancedFilter.operators.is' },
  { value: 'isNot', labelKey: 'common.advancedFilter.operators.isNot' },
  { value: 'isAnyOf', labelKey: 'common.advancedFilter.operators.isAnyOf' },
  { value: 'isNoneOf', labelKey: 'common.advancedFilter.operators.isNoneOf' },
  {
    value: 'isEmpty',
    labelKey: 'common.advancedFilter.operators.isEmpty',
    noValue: true
  },
  {
    value: 'isNotEmpty',
    labelKey: 'common.advancedFilter.operators.isNotEmpty',
    noValue: true
  }
];

export const OPERATORS_BY_TYPE: Record<FilterFieldType, OperatorConfig[]> = {
  string: STRING_OPERATORS,
  number: NUMBER_AND_DATE_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  enum: ENUM_OPERATORS,
  date: NUMBER_AND_DATE_OPERATORS
};

export const MAX_NESTING_DEPTH = 2;
