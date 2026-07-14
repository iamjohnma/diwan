import {
  CalendarBlankIcon,
  CaretRightIcon,
  PlusIcon,
  UserIcon
} from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton
} from '@/components/ui';
import { useBreakpoint } from '@/hooks/common';
import { useCurrentTime } from '@/hooks/common/current-time';
import type { DashboardHearing } from '@/hooks/pages/_app/dashboard';
import { useDashboardTodayHearings } from '@/hooks/pages/_app/dashboard';
import { cn } from '@/lib/utils';

function HearingSkeleton() {
  return (
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: 3 }, (_, index) => (
        <Card
          className="flex items-center gap-x-3 bg-background-base p-3"
          key={index}
        >
          <Skeleton className="h-11 w-20 shrink-0 rounded-3xl" />
          <div className="flex min-w-0 flex-col gap-y-1">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
          </div>
          <Skeleton className="ms-auto size-5 shrink-0 rounded-sm" />
        </Card>
      ))}
    </div>
  );
}

function formatCountdown(
  target: number,
  now: number,
  t: ReturnType<typeof useTranslation>['t']
) {
  const minutes = Math.max(0, Math.ceil((target - now) / 60_000));
  if (minutes < 60)
    return t('dashboard.todayHearings.countdownMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? t('dashboard.todayHearings.countdownHoursMinutes', {
        hours,
        minutes: remainingMinutes
      })
    : t('dashboard.todayHearings.countdownHours', { count: hours });
}

function HearingRow(props: { hearing: DashboardHearing }) {
  const translation = useTranslation();
  const navigate = useNavigate();
  const currentTime = useCurrentTime();
  const locale =
    translation.i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US';
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(props.hearing.date);
  const location = [props.hearing.court, props.hearing.hall]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card
      className="group flex cursor-pointer items-center gap-x-3 bg-background-base p-3 transition-colors hover:bg-background-surface"
      onClick={() => void navigate({ to: '/calendar' })}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void navigate({ to: '/calendar' });
        }
      }}
    >
      <div className="relative flex h-11 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-secondary px-3">
        <span className="absolute text-base font-medium text-secondary-foreground transition-transform duration-250 group-hover:-translate-y-8">
          {timeLabel}
        </span>
        <span className="absolute translate-y-8 whitespace-nowrap text-xs font-medium text-error transition-transform duration-250 group-hover:translate-y-0">
          {formatCountdown(
            props.hearing.date,
            currentTime.getTime(),
            translation.t
          )}
        </span>
      </div>
      <div className="ms-1 flex min-w-0 flex-col">
        <p className="truncate text-base text-text-primary">
          {translation.t('dashboard.todayHearings.caseLabel', {
            number: props.hearing.caseNumber
          })}
        </p>
        <p className="flex min-w-0 items-center gap-x-1 text-sm text-text-tertiary">
          <UserIcon className="size-4 shrink-0" />
          <span className="truncate">
            {location ||
              props.hearing.lawyerName ||
              translation.t('dashboard.todayHearings.unknownLawyer')}
          </span>
        </p>
      </div>
      <CaretRightIcon className="ms-auto size-5 shrink-0 text-text-tertiary rtl:rotate-180" />
    </Card>
  );
}

export function TodayHearingsSection() {
  const translation = useTranslation();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const dashboardTodayHearings = useDashboardTodayHearings();
  const hearings = dashboardTodayHearings.data ?? [];
  const isEmpty = !dashboardTodayHearings.isPending && hearings.length === 0;

  if (breakpoint.isBelow('md') && isEmpty) return null;

  return (
    <div className="flex min-h-0 w-full sm:w-1/2 xl:w-full">
      <Card className="flex min-h-0 w-full flex-col gap-y-3 overflow-hidden px-3 py-3 sm:max-h-97 sm:flex-1 md:gap-y-4 md:px-5 md:py-4 xl:max-h-97">
        <div className="flex items-start justify-between gap-x-3">
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-text-primary">
              {translation.t('dashboard.todayHearings.title')}
            </h2>
            <p className="hidden text-sm font-normal text-text-tertiary md:block">
              {translation.t('dashboard.todayHearings.subtitle')}
            </p>
          </div>
          <button
            aria-label={translation.t('dashboard.todayHearings.add')}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-default bg-background-base text-text-primary transition-colors hover:bg-background-surface"
            onClick={() => void navigate({ to: '/calendar' })}
            title={translation.t('dashboard.todayHearings.add')}
            type="button"
          >
            <PlusIcon className="size-5" weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AnimatePresence initial={false} mode="wait">
            {dashboardTodayHearings.isPending ? (
              <motion.div
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="skeleton"
              >
                <HearingSkeleton />
              </motion.div>
            ) : isEmpty ? (
              <motion.div
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="empty"
              >
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CalendarBlankIcon
                        className="size-4 md:size-5"
                        weight="duotone"
                      />
                    </EmptyMedia>
                    <EmptyTitle>
                      {translation.t('dashboard.todayHearings.empty.title')}
                    </EmptyTitle>
                    <EmptyDescription>
                      {translation.t(
                        'dashboard.todayHearings.empty.description'
                      )}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1 }}
                className={cn('flex flex-col gap-y-2')}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="content"
              >
                {hearings.map((hearing) => (
                  <HearingRow hearing={hearing} key={hearing.id} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}
