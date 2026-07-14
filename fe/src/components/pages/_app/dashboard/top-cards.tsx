import { useMemo, useState } from 'react';
import {
  BriefcaseIcon,
  CalendarPlusIcon,
  CaretRightIcon,
  CoinsIcon,
  ReceiptIcon,
  ScalesIcon
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DashboardCardStrip } from '@/components/pages/_app/dashboard/card-strip';
import { DashboardSensitiveValue } from '@/components/pages/_app/dashboard/sensitive-value';
import { Card, Skeleton } from '@/components/ui';
import { useDashboardKpis } from '@/hooks/pages/_app/dashboard';
import { cn } from '@/lib/utils';
import { useUserPreferencesStore } from '@/stores/user-preferences';

const KPI_CARD_MIN_WIDTH_PX = 167;
const TWO_COLUMN_CLASS =
  '@[340px]:flex-[0_0_calc((100%-var(--kpi-gap))/2-1px)]';
const CARD_SHELL_CLASS = cn(
  'shrink-0 snap-start flex-[0_0_100%] gap-y-1 border p-3 md:gap-y-3 md:px-5 md:py-4',
  TWO_COLUMN_CLASS,
  '@[755px]:flex-[0_0_calc((100%-var(--kpi-gap)-var(--kpi-gap))/3-1px)]'
);

interface KpiCardData {
  title: string;
  description: string;
  value: string;
  change?: { value: string; tone: 'positive' | 'negative' };
  icon: Icon;
}

function KpiCard(props: { card: KpiCardData }) {
  const hideByDefault = useUserPreferencesStore(
    (state) => state.appearance.hideNumbers
  );
  const [visible, setVisible] = useState(false);
  const IconComponent = props.card.icon;
  const hidden = hideByDefault && !visible;

  return (
    <Card
      className={cn(
        'group flex flex-col justify-between text-text-primary transition-transform duration-300',
        hideByDefault && 'cursor-pointer',
        CARD_SHELL_CLASS
      )}
      onClick={() => hideByDefault && setVisible((current) => !current)}
      style={{ minWidth: KPI_CARD_MIN_WIDTH_PX }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-x-2">
          <IconComponent
            className="size-5 shrink-0 text-text-secondary transition-colors duration-300 group-hover:text-secondary-foreground"
            weight="duotone"
          />
          <p className="truncate text-sm font-medium text-text-secondary">
            {props.card.title}
          </p>
        </div>
        {props.card.change ? (
          <DashboardSensitiveValue
            className={cn(
              'hidden min-w-8 shrink-0 rounded-3xl px-2.5 py-1 text-center text-sm font-medium leading-normal md:inline-grid',
              props.card.change.tone === 'positive'
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-error-bg text-error'
            )}
            hidden={hidden}
          >
            {props.card.change.value}
          </DashboardSensitiveValue>
        ) : null}
      </div>
      <div className="flex flex-col items-start justify-between gap-0 md:gap-1">
        <DashboardSensitiveValue
          className="text-2xl font-bold text-text-primary"
          hidden={hidden}
        >
          {props.card.value}
        </DashboardSensitiveValue>
        <p className="hidden truncate text-xs font-medium leading-tight text-text-tertiary md:block">
          {props.card.description}
        </p>
      </div>
    </Card>
  );
}

function KpiCardSkeleton() {
  return (
    <Card
      aria-hidden
      className={cn('flex flex-col justify-between', CARD_SHELL_CLASS)}
      style={{ minWidth: KPI_CARD_MIN_WIDTH_PX }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-x-2">
          <Skeleton className="size-5 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <Skeleton className="hidden h-7 w-8 shrink-0 rounded-3xl md:block" />
      </div>
      <div className="flex flex-col items-start gap-1">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="hidden h-3.5 w-28 rounded-md md:block" />
      </div>
    </Card>
  );
}

export function DashboardKpiCards() {
  const translation = useTranslation();
  const dashboardKpis = useDashboardKpis();
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(
        translation.i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US',
        { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }
      ),
    [translation.i18n.language]
  );
  const cards = useMemo<KpiCardData[]>(
    () => [
      {
        title: translation.t('dashboard.kpi.revenue.title'),
        description: translation.t('dashboard.kpi.revenue.description'),
        value: currency.format(dashboardKpis.data?.revenue.total ?? 0),
        change: {
          value: String(dashboardKpis.data?.revenue.paymentsCount ?? 0),
          tone: 'positive'
        },
        icon: CoinsIcon
      },
      {
        title: translation.t('dashboard.kpi.outstanding.title'),
        description: translation.t('dashboard.kpi.outstanding.description'),
        value: currency.format(dashboardKpis.data?.outstandingBalance ?? 0),
        icon: ReceiptIcon
      },
      {
        title: translation.t('dashboard.kpi.activeCases.title'),
        description: translation.t('dashboard.kpi.activeCases.description'),
        value: (dashboardKpis.data?.activeCases.total ?? 0).toLocaleString(),
        change: {
          value: String(dashboardKpis.data?.activeCases.intake ?? 0),
          tone:
            (dashboardKpis.data?.activeCases.intake ?? 0) > 0
              ? 'negative'
              : 'positive'
        },
        icon: BriefcaseIcon
      }
    ],
    [currency, dashboardKpis.data, translation]
  );

  return (
    <DashboardCardStrip className="gap-(--kpi-gap) overflow-y-hidden px-2.5 [--kpi-gap:0.375rem] scroll-ps-2.5 scroll-pe-2.5 md:px-6 md:[--kpi-gap:1rem] md:scroll-ps-6 md:scroll-pe-6 lg:px-0 lg:scroll-ps-0 lg:scroll-pe-0">
      {dashboardKpis.isPending
        ? cards.map((card) => <KpiCardSkeleton key={card.title} />)
        : cards.map((card) => <KpiCard card={card} key={card.title} />)}
    </DashboardCardStrip>
  );
}

interface FastAction {
  key: string;
  title: string;
  icon: Icon;
  onClick: () => void;
}

export function DashboardFastAccessCards() {
  const translation = useTranslation();
  const navigate = useNavigate();
  const actions: FastAction[] = [
    {
      key: 'create-case',
      title: translation.t('dashboard.fastAccess.createCase'),
      icon: ScalesIcon,
      onClick: () =>
        toast.info(translation.t('dashboard.fastAccess.createCaseUnavailable'))
    },
    {
      key: 'add-hearing',
      title: translation.t('dashboard.fastAccess.addHearing'),
      icon: CalendarPlusIcon,
      onClick: () => void navigate({ to: '/calendar' })
    },
    {
      key: 'record-payment',
      title: translation.t('dashboard.fastAccess.recordPayment'),
      icon: ReceiptIcon,
      onClick: () => void navigate({ to: '/payments' })
    }
  ];

  return (
    <DashboardCardStrip className="gap-(--kpi-gap) overflow-y-hidden px-2.5 [--kpi-gap:1rem] scroll-ps-2.5 scroll-pe-2.5 md:gap-(--kpi-gap) md:px-6 md:[--kpi-gap:1.75rem] md:scroll-ps-6 md:scroll-pe-6 lg:px-0 lg:scroll-ps-0 lg:scroll-pe-0">
      {actions.map((action) => {
        const IconComponent = action.icon;
        return (
          <button
            className={cn(
              'flex shrink-0 snap-start flex-[0_0_100%] cursor-pointer flex-col gap-y-1 rounded-xl border border-border-default bg-(--background-card) p-3 text-text-primary shadow-xs transition-colors duration-200 hover:border-border-dark focus-visible:border-border-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 md:gap-y-3 md:px-5 md:py-4',
              TWO_COLUMN_CLASS,
              '@[755px]:flex-[0_0_calc((100%-var(--kpi-gap)-var(--kpi-gap))/3-1px)]'
            )}
            key={action.key}
            onClick={action.onClick}
            style={{ minWidth: KPI_CARD_MIN_WIDTH_PX }}
            type="button"
          >
            <span className="flex w-full items-center justify-between gap-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/70 text-secondary-foreground md:size-10">
                <IconComponent className="size-5" weight="duotone" />
              </span>
              <CaretRightIcon
                className="hidden size-4 text-text-tertiary md:block rtl:rotate-180"
                weight="bold"
              />
            </span>
            <span className="w-full truncate text-lg font-medium text-text-primary md:text-xl">
              {action.title}
            </span>
          </button>
        );
      })}
    </DashboardCardStrip>
  );
}
