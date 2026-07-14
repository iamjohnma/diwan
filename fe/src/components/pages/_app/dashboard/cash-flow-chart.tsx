import type { PointerEvent } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  ChartPeriodSelect,
  ChartSectionHeader
} from '@/components/common/chart-section-header';
import {
  CASH_FLOW_AXIS_GAP_CLASS,
  CASH_FLOW_AXIS_LABEL_POSITION_CLASS,
  CASH_FLOW_AXIS_LAYOUT_DIRECTION,
  CASH_FLOW_CHART_MARGIN_BOTTOM,
  CASH_FLOW_CHART_MARGIN_TOP,
  CASH_FLOW_GUIDE_LINE_CLASSNAME,
  CASH_FLOW_X_AXIS_HEIGHT,
  CASH_FLOW_X_AXIS_STROKE,
  buildCashFlowYAxisLabels,
  getCashFlowXAxisPadding,
  getCashFlowYAxisScale,
  shouldReverseCashFlowXAxis
} from '@/components/pages/_app/dashboard/chart-axis';
import { DashboardSensitiveSection } from '@/components/pages/_app/dashboard/sensitive-value';
import { Card, CardContent, Skeleton } from '@/components/ui';
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  TOTAL_VISITORS_CHART_OUTER_CLASSNAME
} from '@/constants/pages/_app/dashboard';
import { useBreakpoint } from '@/hooks/common';
import type {
  DashboardCashFlow,
  DashboardPeriod
} from '@/hooks/pages/_app/dashboard';
import { useDashboardCashFlow } from '@/hooks/pages/_app/dashboard';
import { cn } from '@/lib/utils';
import { useUserPreferencesStore } from '@/stores/user-preferences';

const CHART_WIDTH = 960;
const CHART_AXIS_RAIL_HEIGHT_CLASSNAME = 'h-[200px] md:h-[280px]';

function LoadingChart() {
  return (
    <div
      className={cn(
        TOTAL_VISITORS_CHART_OUTER_CLASSNAME,
        'flex items-center gap-1'
      )}
    >
      <div className="flex h-full w-11 flex-col justify-between py-3 md:w-14">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-2.5 w-8" key={index} />
        ))}
      </div>
      <Skeleton className="h-full flex-1 rounded-lg" />
    </div>
  );
}

interface ChartCanvasProps {
  data: DashboardCashFlow['data'];
  isFetching: boolean;
}

function ChartCanvas(props: ChartCanvasProps) {
  const translation = useTranslation();
  const breakpoint = useBreakpoint();
  const gradientId = useId().replaceAll(':', '');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isRtl = translation.i18n.dir() === 'rtl';
  const isMobile = breakpoint.isMobile;
  const chartFixedHeightPx = isMobile ? 200 : 280;
  const isXAxisReversed = shouldReverseCashFlowXAxis(isRtl);
  const xAxisPadding = getCashFlowXAxisPadding(isMobile);
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(
        translation.i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US',
        { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }
      ),
    [translation.i18n.language]
  );
  const compact = useMemo(
    () =>
      new Intl.NumberFormat(
        translation.i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US',
        { notation: 'compact', maximumFractionDigits: 1 }
      ),
    [translation.i18n.language]
  );
  const maxAmount = props.data.reduce(
    (maximum, item) => Math.max(maximum, item.amount),
    0
  );
  const { domain: yAxisDomain, ticks: yAxisTicks } =
    getCashFlowYAxisScale(maxAmount);
  const [, maxValue] = yAxisDomain;
  const usableHeight =
    chartFixedHeightPx -
    CASH_FLOW_CHART_MARGIN_TOP -
    CASH_FLOW_CHART_MARGIN_BOTTOM -
    CASH_FLOW_X_AXIS_HEIGHT;
  const plotBottom = CASH_FLOW_CHART_MARGIN_TOP + usableHeight;
  const drawableWidth = CHART_WIDTH - xAxisPadding.left - xAxisPadding.right;
  const points = useMemo(() => {
    return props.data.map((item, index) => {
      const visualIndex = isXAxisReversed
        ? props.data.length - index - 1
        : index;
      return {
        ...item,
        x:
          xAxisPadding.left +
          (props.data.length <= 1
            ? drawableWidth / 2
            : (visualIndex / (props.data.length - 1)) * drawableWidth),
        y: CASH_FLOW_CHART_MARGIN_TOP + usableHeight * (1 - item.amount / maxValue)
      };
    });
  }, [
    drawableWidth,
    isXAxisReversed,
    maxValue,
    props.data,
    usableHeight,
    xAxisPadding.left
  ]);
  const orderedPoints = [...points].sort((first, second) => first.x - second.x);
  const linePath = orderedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = linePath
    ? `${linePath} L ${orderedPoints.at(-1)?.x ?? CHART_WIDTH} ${plotBottom} L ${orderedPoints[0]?.x ?? 0} ${plotBottom} Z`
    : '';
  const yAxisLabels = useMemo(
    () =>
      buildCashFlowYAxisLabels(
        yAxisDomain,
        yAxisTicks,
        chartFixedHeightPx
      ).map((item) => ({
        ...item,
        label: compact.format(item.value)
      })),
    [chartFixedHeightPx, compact, yAxisDomain, yAxisTicks]
  );
  const visibleLabelStep = isMobile ? 3 : 2;
  const activePoint =
    activeIndex === null ? undefined : orderedPoints[activeIndex];

  const updateActivePoint = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      orderedPoints.forEach((point, index) => {
        const distance = Math.abs(point.x - x);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      setActiveIndex(nearestIndex);
    },
    [orderedPoints]
  );

  return (
    <CardContent className="relative -ms-8 !w-[calc(100%+22px)] max-md:-ms-6 max-md:!w-[calc(100%+16px)] flex w-full min-w-0 flex-col gap-4 overflow-x-visible p-0">
      <figure className="m-0 min-w-0 shrink-0 touch-pan-y overflow-x-visible">
        <div
          className={cn(
            'flex w-full min-w-0 items-stretch overflow-visible',
            CASH_FLOW_AXIS_GAP_CLASS,
            isRtl ? 'flex-row-reverse' : 'flex-row'
          )}
          dir={CASH_FLOW_AXIS_LAYOUT_DIRECTION}
        >
          <div
            className={cn(
              'pointer-events-none relative shrink-0 text-text-tertiary',
              isMobile ? 'w-11' : 'w-14',
              CHART_AXIS_RAIL_HEIGHT_CLASSNAME
            )}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {yAxisLabels.map((item) => (
              <span
                className={cn(
                  'absolute block',
                  CASH_FLOW_AXIS_LABEL_POSITION_CLASS,
                  isMobile ? 'text-[9px]' : 'text-[11px]'
                )}
                key={item.value}
                style={{
                  top: `${item.topPercent}%`,
                  transform: 'translateY(-50%)'
                }}
              >
                {item.label}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className={TOTAL_VISITORS_CHART_OUTER_CLASSNAME}>
              <div className="pointer-events-none absolute inset-0">
                {yAxisLabels.map((item) => (
                  <div
                    className={cn(
                      'absolute inset-x-0',
                      CASH_FLOW_GUIDE_LINE_CLASSNAME
                    )}
                    key={`guide-line-${item.value}`}
                    style={{
                      top: `${item.topPercent}%`,
                      transform: 'translateY(-50%)'
                    }}
                  />
                ))}
              </div>
              <svg
                aria-label={translation.t('dashboard.cashFlow.chartLabel')}
                className="relative z-10 h-full w-full overflow-visible"
                onPointerLeave={() => setActiveIndex(null)}
                onPointerMove={updateActivePoint}
                preserveAspectRatio="none"
                role="img"
                viewBox={`0 0 ${CHART_WIDTH} ${chartFixedHeightPx}`}
              >
                <defs>
                  <linearGradient
                    id={`${gradientId}-area`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity="0.8"
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity="0.1"
                    />
                  </linearGradient>
                </defs>
                <line
                  stroke={CASH_FLOW_X_AXIS_STROKE.stroke}
                  strokeWidth={CASH_FLOW_X_AXIS_STROKE.strokeWidth}
                  x1={xAxisPadding.left}
                  x2={CHART_WIDTH - xAxisPadding.right}
                  y1={plotBottom}
                  y2={plotBottom}
                />
                <path d={areaPath} fill={`url(#${gradientId}-area)`} />
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--primary)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                {orderedPoints.map((point, index) => (
                  <g key={point.periodStart}>
                    {activeIndex === index ? (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        fill="var(--background-surface)"
                        r="5"
                        stroke="var(--primary)"
                        strokeWidth="2"
                      />
                    ) : null}
                    {index % visibleLabelStep === 0 ||
                    index === orderedPoints.length - 1 ? (
                      <text
                        fill="var(--text-tertiary)"
                        fontSize="11"
                        textAnchor="middle"
                        x={point.x}
                        y={chartFixedHeightPx - 4}
                      >
                        {point.label}
                      </text>
                    ) : null}
                  </g>
                ))}
              </svg>
              <AnimatePresence>
                {props.isFetching ? (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background-base/60 backdrop-blur-sm"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                  >
                    <span className="size-7 animate-spin rounded-full border-2 border-border-default border-t-primary" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              {activePoint ? (
                <div
                  className="pointer-events-none absolute z-20 min-w-32 -translate-x-1/2 -translate-y-full rounded-md border border-border-default bg-background-surface px-2.5 py-1.5 text-xs shadow-md"
                  style={{
                    left: `${(activePoint.x / CHART_WIDTH) * 100}%`,
                    top: `${(activePoint.y / chartFixedHeightPx) * 100}%`
                  }}
                >
                  <p className="font-medium text-text-primary">
                    {activePoint.label}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-text-secondary">
                    <span className="size-2.5 rounded-xs bg-primary" />
                    <span className="flex-1">
                      {translation.t('dashboard.cashFlow.income')}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-text-primary">
                      {currency.format(activePoint.amount)}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </figure>
    </CardContent>
  );
}

export function CashFlowSection() {
  const translation = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriod>(DEFAULT_PERIOD);
  const hideByDefault = useUserPreferencesStore(
    (state) => state.appearance.hideNumbers
  );
  const [visible, setVisible] = useState(false);
  const cashFlowQuery = useDashboardCashFlow(period);
  const hidden = hideByDefault && !visible;

  return (
    <Card className="min-w-0 gap-2.5 overflow-x-visible px-3 py-3 md:gap-4 md:px-5 md:py-4 !pb-0.5 md:!pb-2.5">
      <ChartSectionHeader
        className="items-start md:items-center"
        subtitle={translation.t('dashboard.cashFlow.subtitle')}
        title={translation.t('dashboard.cashFlow.title')}
      >
        {hideByDefault ? (
          <button
            aria-label={
              hidden
                ? translation.t('dashboard.privacy.reveal')
                : translation.t('dashboard.privacy.hide')
            }
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-background-elevated md:size-9"
            onClick={() => setVisible((current) => !current)}
            type="button"
          >
            {hidden ? (
              <EyeIcon className="size-4.5" weight="duotone" />
            ) : (
              <EyeSlashIcon className="size-4.5" weight="duotone" />
            )}
          </button>
        ) : null}
        <ChartPeriodSelect
          onValueChange={setPeriod}
          options={PERIOD_OPTIONS}
          triggerClassName="h-10 md:h-9"
          value={period}
        />
      </ChartSectionHeader>
      <DashboardSensitiveSection
        className="-mx-3 -my-2 px-3 py-2 md:-mx-5 md:px-5"
        hidden={hidden}
        onReveal={() => setVisible(true)}
      >
        {cashFlowQuery.isPending && !cashFlowQuery.data ? (
          <LoadingChart />
        ) : (
          <ChartCanvas
            data={cashFlowQuery.data?.data ?? []}
            isFetching={cashFlowQuery.isFetching && Boolean(cashFlowQuery.data)}
          />
        )}
      </DashboardSensitiveSection>
    </Card>
  );
}
