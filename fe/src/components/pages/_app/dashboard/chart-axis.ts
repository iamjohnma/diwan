import type {
  CashFlowYAxisLabel,
  CashFlowYAxisScale
} from '@/@types/pages/_app/dashboard/cash-flow-chart';
import {
  CASH_FLOW_CHART_MARGIN_BOTTOM,
  CASH_FLOW_CHART_MARGIN_TOP,
  CASH_FLOW_X_AXIS_HEIGHT
} from '@/constants/pages/_app/dashboard';

export type {
  CashFlowYAxisLabel,
  CashFlowYAxisScale
} from '@/@types/pages/_app/dashboard/cash-flow-chart';

export {
  CASH_FLOW_CHART_MARGIN_BOTTOM,
  CASH_FLOW_CHART_MARGIN_TOP,
  CASH_FLOW_X_AXIS_HEIGHT
} from '@/constants/pages/_app/dashboard';

const EMPTY_CHART_DOMAIN: [number, number] = [0, 400];
const EMPTY_CHART_TICKS = [100, 200, 300, 400];
const TARGET_TICK_COUNT = 4;

export const CASH_FLOW_AXIS_LAYOUT_DIRECTION = 'ltr' as const;
export const CASH_FLOW_AXIS_GAP_CLASS = 'gap-1';
export const CASH_FLOW_AXIS_LABEL_POSITION_CLASS =
  'end-0 ltr:text-right rtl:text-left';
export const CASH_FLOW_GUIDE_LINE_CLASSNAME = 'border-t border-border/50';
export const CASH_FLOW_X_AXIS_STROKE = {
  stroke: 'var(--border-default)',
  strokeWidth: 1
} as const;

export function getCashFlowXAxisPadding(isMobile: boolean) {
  const padding = isMobile ? 8 : 12;

  return { left: padding, right: padding };
}

export function shouldReverseCashFlowXAxis(isRtl: boolean) {
  return !isRtl;
}

export function getCashFlowDataIndexFromVisualIndex(
  visualIndex: number,
  dataLength: number,
  isXAxisReversed: boolean
) {
  return isXAxisReversed ? dataLength - 1 - visualIndex : visualIndex;
}

function getNiceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const base = 10 ** Math.floor(Math.log10(value));
  const fraction = value / base;

  if (fraction <= 1) return base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 2.5) return 2.5 * base;
  if (fraction <= 5) return 5 * base;

  return 10 * base;
}

export function getCashFlowYAxisScale(maxValue: number): CashFlowYAxisScale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { domain: EMPTY_CHART_DOMAIN, ticks: EMPTY_CHART_TICKS };
  }

  const step = getNiceStep(maxValue / TARGET_TICK_COUNT);
  const tickCount = Math.max(1, Math.ceil(maxValue / step));

  return {
    domain: [0, step * tickCount],
    ticks: Array.from({ length: tickCount }, (_, index) => step * (index + 1))
  };
}

export function buildCashFlowYAxisLabels(
  domain: [number, number],
  ticks: number[],
  chartHeight: number
): CashFlowYAxisLabel[] {
  const [minValue, maxValue] = domain;
  const usableHeight =
    chartHeight -
    CASH_FLOW_CHART_MARGIN_TOP -
    CASH_FLOW_CHART_MARGIN_BOTTOM -
    CASH_FLOW_X_AXIS_HEIGHT;

  if (maxValue <= minValue || usableHeight <= 0) {
    return [];
  }

  return ticks
    .filter((value) => value >= minValue && value <= maxValue)
    .map((value) => {
      const ratio = (value - minValue) / (maxValue - minValue);
      const topPx =
        CASH_FLOW_CHART_MARGIN_TOP + usableHeight - ratio * usableHeight;

      return {
        value,
        topPercent: Number(((topPx / chartHeight) * 100).toFixed(2))
      };
    });
}
