import { useDeferredValue, useMemo, useState } from 'react';
import type { CaseStatus } from '@diwan/shared';
import { CASE_STATUSES } from '@diwan/shared';
import {
  BriefcaseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  XIcon
} from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { DataTableCore } from '@/components/common/data-table';
import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { useBreakpoint } from '@/hooks/common';
import type { DashboardCaseRow } from '@/hooks/pages/_app/dashboard';
import { useDashboardCases } from '@/hooks/pages/_app/dashboard';
import { cn } from '@/lib/utils';

type CaseFilter = 'all' | CaseStatus;

const STATUS_CLASS_NAMES: Record<CaseStatus, string> = {
  intake: 'bg-background-elevated text-text-secondary',
  filed: 'bg-secondary text-secondary-foreground',
  in_hearings: 'bg-warning-bg text-warning',
  verdict: 'bg-primary-light text-primary',
  execution: 'bg-primary-light text-primary',
  closed: 'bg-success-bg text-success',
  archived: 'bg-background-muted text-text-tertiary'
};

function StatusBadge(props: { status: CaseStatus }) {
  const translation = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium',
        STATUS_CLASS_NAMES[props.status]
      )}
    >
      <span className="truncate">
        {translation.t(`cases.statuses.${props.status}`)}
      </span>
    </span>
  );
}

function useCaseColumns(): ColumnDef<DashboardCaseRow, unknown>[] {
  const translation = useTranslation();
  return useMemo(() => {
    const locale =
      translation.i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US';
    const currency = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0
    });
    return [
      {
        accessorKey: 'internalNumber',
        header: translation.t('cases.columns.internalNumber'),
        size: 145,
        minSize: 120
      },
      {
        accessorKey: 'courtNumber',
        header: translation.t('cases.columns.courtNumber'),
        size: 135,
        minSize: 110,
        cell: (context) => context.row.original.courtNumber ?? '—'
      },
      {
        accessorKey: 'courtName',
        header: translation.t('cases.columns.courtName'),
        size: 170,
        minSize: 135,
        cell: (context) => context.row.original.courtName ?? '—'
      },
      {
        accessorKey: 'caseTypeName',
        header: translation.t('cases.columns.caseType'),
        size: 155,
        minSize: 125,
        cell: (context) => context.row.original.caseTypeName || '—'
      },
      {
        accessorKey: 'primaryLawyerName',
        header: translation.t('cases.columns.primaryLawyer'),
        size: 165,
        minSize: 135,
        cell: (context) => context.row.original.primaryLawyerName || '—'
      },
      {
        accessorKey: 'claimAmount',
        header: translation.t('cases.columns.claimAmount'),
        size: 140,
        minSize: 115,
        cell: (context) =>
          context.row.original.claimAmount === undefined
            ? '—'
            : currency.format(context.row.original.claimAmount)
      },
      {
        accessorKey: 'status',
        header: translation.t('cases.columns.status'),
        size: 125,
        minSize: 105,
        cell: (context) => <StatusBadge status={context.row.original.status} />
      }
    ];
  }, [translation.i18n.language, translation.t]);
}

export function AllCasesSection() {
  const translation = useTranslation();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const [filter, setFilter] = useState<CaseFilter>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageSize = 5;
  const casesQuery = useDashboardCases({
    status: filter === 'all' ? undefined : filter,
    searchText: deferredSearch || undefined,
    page,
    pageSize
  });
  const response = casesQuery.data;
  const caseColumns = useCaseColumns();
  const table = useReactTable({
    data: response?.rows ?? [],
    columns: caseColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row._id
  });
  const totalRows = response?.totalRows ?? 0;
  const startEntry = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const endEntry = Math.min(totalRows, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const hasCriteria = filter !== 'all' || deferredSearch.length > 0;

  return (
    <Card className="@container flex flex-col gap-0 overflow-hidden px-3 py-3 md:px-5 md:py-4 xl:grow">
      <div className="mb-4 flex flex-col">
        <h2 className="text-base font-semibold text-text-primary">
          {translation.t('dashboard.allCases.title')}
        </h2>
        <p className="hidden text-sm font-normal text-text-tertiary md:block">
          {translation.t('dashboard.allCases.subtitle')}
        </p>
      </div>
      <div className="flex flex-col gap-2 xl:grow">
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-default bg-background-base px-3 transition-colors focus-within:border-border-dark focus-within:ring-2 focus-within:ring-border-default/25">
            <MagnifyingGlassIcon className="size-4 shrink-0 text-text-tertiary" />
            <input
              aria-label={translation.t('dashboard.allCases.search')}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={translation.t('dashboard.allCases.search')}
              value={search}
            />
            {search ? (
              <button
                aria-label={translation.t('dashboard.allCases.clearSearch')}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-text-tertiary hover:bg-background-muted hover:text-text-primary"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                type="button"
              >
                <XIcon className="size-3.5" weight="bold" />
              </button>
            ) : null}
          </div>
          <Select
            onValueChange={(value) => {
              setFilter(value as CaseFilter);
              setPage(1);
            }}
            value={filter}
          >
            <SelectTrigger
              className={cn(
                breakpoint.isMobile
                  ? 'size-10 shrink-0 justify-center p-0 [&>span]:contents'
                  : 'w-auto min-w-45 shrink-0'
              )}
              showChevron={!breakpoint.isMobile}
            >
              {breakpoint.isMobile ? (
                <FunnelSimpleIcon className="size-4 shrink-0" weight="bold" />
              ) : (
                <SelectValue>
                  {filter === 'all'
                    ? translation.t('dashboard.allCases.filters.all')
                    : translation.t(`cases.statuses.${filter}`)}
                </SelectValue>
              )}
            </SelectTrigger>
            <SelectContent align={breakpoint.isMobile ? 'end' : undefined}>
              <SelectItem value="all">
                {translation.t('dashboard.allCases.filters.all')}
              </SelectItem>
              {CASE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {translation.t(`cases.statuses.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative min-h-60 xl:grow">
          <div
            className={cn(
              'h-full overflow-hidden rounded-lg transition-opacity duration-300 md:rounded-xl',
              casesQuery.isFetching &&
                response &&
                'pointer-events-none opacity-40'
            )}
          >
            <DataTableCore
              emptyStateKind={
                casesQuery.isError
                  ? 'error'
                  : hasCriteria
                    ? 'criteria-empty'
                    : 'source-empty'
              }
              getRowId={(row) => row._id}
              headerCellClassName="text-text-primary"
              headerClassName="bg-transparent [&_tr]:border-b [&_tr]:border-border-default"
              headerRowClassName="border-b border-border-default bg-transparent hover:bg-transparent"
              labels={{
                emptyTitle: translation.t('cases.emptyTitle'),
                emptyDescription: translation.t('cases.emptyDescription'),
                criteriaEmptyTitle: translation.t(
                  'dashboard.allCases.emptyTitle'
                ),
                criteriaEmptyDescription: translation.t(
                  'dashboard.allCases.emptyDescription'
                ),
                errorTitle: translation.t('cases.errorTitle'),
                errorDescription: translation.t('cases.errorDescription'),
                retryLabel: translation.t('cases.retry'),
                emptyIcon: BriefcaseIcon
              }}
              onRetry={() => void casesQuery.refetch()}
              onRowClick={() => void navigate({ to: '/cases' })}
              table={table}
            />
          </div>
          {casesQuery.isPending || (casesQuery.isFetching && response) ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-background-base/25">
              <span className="size-7 animate-spin rounded-full border-2 border-border-default border-t-primary" />
            </div>
          ) : null}
        </div>
        <div className="flex w-full min-w-0 items-center justify-between gap-2 border-t border-border-default pt-3 text-sm text-text-secondary md:gap-3 md:pt-4">
          <span className="min-w-0 flex-1 truncate tabular-nums text-text-tertiary">
            {totalRows > 0
              ? translation.t('common.dataTable.showingEntries', {
                  start: startEntry,
                  end: endEntry,
                  total: totalRows
                })
              : ''}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <Button
              className="gap-x-1.5 @max-[520px]:gap-x-0 @max-[520px]:px-2"
              disabled={totalRows === 0 || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="sm"
              variant="outline"
            >
              <CaretLeftIcon className="size-4 shrink-0 rtl:rotate-180" />
              <span className="@max-[520px]:hidden">
                {translation.t('dashboard.allCases.pagination.previous')}
              </span>
            </Button>
            <Button
              className="gap-x-1.5 @max-[520px]:gap-x-0 @max-[520px]:px-2"
              disabled={totalRows === 0 || page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              size="sm"
              variant="outline"
            >
              <span className="@max-[520px]:hidden">
                {translation.t('dashboard.allCases.pagination.next')}
              </span>
              <CaretRightIcon className="size-4 shrink-0 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
