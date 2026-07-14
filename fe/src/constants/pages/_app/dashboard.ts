import type { DashboardPeriod } from '@/hooks/pages/_app/dashboard';

export const DEFAULT_PERIOD: DashboardPeriod = 'weekly';

export const PERIOD_OPTIONS = (
  ['weekly', 'monthly'] as const satisfies readonly DashboardPeriod[]
).map((value) => ({
  value,
  labelKey: `dashboard.cashFlow.periods.${value}`
}));

export const CASH_FLOW_CHART_MARGIN_TOP = 12;
export const CASH_FLOW_CHART_MARGIN_BOTTOM = 12;
export const CASH_FLOW_X_AXIS_HEIGHT = 22;

export const TOTAL_VISITORS_CHART_OUTER_CLASSNAME =
  'relative w-full min-w-0 flex-none shrink-0 overflow-visible h-[200px] md:h-[280px]';
