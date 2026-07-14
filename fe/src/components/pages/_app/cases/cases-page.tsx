import { useMemo, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import type { CaseStatus } from '@diwan/shared';
import { CASE_STATUSES } from '@diwan/shared';
import { BriefcaseIcon, PlusIcon, ScalesIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { makeFunctionReference } from 'convex/server';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { FilterFieldDefinition } from '@/@types/common/advanced-filters';
import { DataTablePage, type DataTableTab } from '@/components/common';
import { CreateCaseDialog } from '@/components/dialogts/pages/_app/cases/create-case-dialog';
import { getNavigationPageTitle } from '@/constants/core/navigation-links';
import { useAdvancedFilters } from '@/hooks/common/advanced-filters';
import { useDocumentTitle } from '@/hooks/core';
import { useCreateCaseDialog } from '@/hooks/pages/_app/cases';
import { cn } from '@/lib/utils';

type CaseTableTab = 'all' | CaseStatus;

interface CaseTableRow {
  _id: string;
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: string;
  caseTypeName: string;
  claimAmount?: number;
  primaryLawyerId: string;
  primaryLawyerName: string;
  status: CaseStatus;
  createdAt: number;
}

interface CaseTableResponse {
  rows: CaseTableRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  statusCounts: Record<CaseStatus, number>;
}

const listTablePage = makeFunctionReference<
  'query',
  {
    status?: CaseStatus;
    page: number;
    pageSize: number;
    searchText?: string;
    serializedFilter?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  },
  CaseTableResponse
>('cases:listTablePage');

const STATUS_CLASS_NAMES: Record<CaseStatus, string> = {
  intake: 'bg-background-elevated text-text-secondary',
  filed: 'bg-secondary text-secondary-foreground',
  in_hearings: 'bg-warning-bg text-warning',
  verdict: 'bg-primary-light text-primary',
  execution: 'bg-primary-light text-primary',
  closed: 'bg-success-bg text-success',
  archived: 'bg-background-muted text-text-tertiary'
};

function CaseStatusBadge(props: { status: CaseStatus }) {
  const translation = useTranslation();
  const { t } = translation;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium',
        STATUS_CLASS_NAMES[props.status]
      )}
    >
      <span className="truncate">{t(`cases.statuses.${props.status}`)}</span>
    </span>
  );
}

function buildCaseColumns(
  t: TFunction,
  dateLocale: string,
  currencyLocale: string
): ColumnDef<CaseTableRow, unknown>[] {
  const dateFormatter = new Intl.DateTimeFormat(dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const currencyFormatter = new Intl.NumberFormat(currencyLocale, {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0
  });

  return [
    {
      accessorKey: 'internalNumber',
      header: t('cases.columns.internalNumber'),
      size: 150,
      minSize: 120
    },
    {
      accessorKey: 'courtNumber',
      header: t('cases.columns.courtNumber'),
      size: 140,
      minSize: 110,
      cell: (context) => context.row.original.courtNumber ?? '—'
    },
    {
      accessorKey: 'courtName',
      header: t('cases.columns.courtName'),
      size: 180,
      minSize: 140,
      cell: (context) => context.row.original.courtName ?? '—'
    },
    {
      accessorKey: 'caseTypeName',
      header: t('cases.columns.caseType'),
      size: 160,
      minSize: 130,
      cell: (context) => context.row.original.caseTypeName || '—'
    },
    {
      accessorKey: 'primaryLawyerName',
      header: t('cases.columns.primaryLawyer'),
      size: 170,
      minSize: 140,
      cell: (context) => context.row.original.primaryLawyerName || '—'
    },
    {
      accessorKey: 'claimAmount',
      header: t('cases.columns.claimAmount'),
      size: 145,
      minSize: 120,
      cell: (context) =>
        context.row.original.claimAmount === undefined
          ? '—'
          : currencyFormatter.format(context.row.original.claimAmount)
    },
    {
      accessorKey: 'status',
      header: t('cases.columns.status'),
      size: 130,
      minSize: 110,
      cell: (context) => (
        <CaseStatusBadge status={context.row.original.status} />
      )
    },
    {
      accessorKey: 'createdAt',
      header: t('cases.columns.createdAt'),
      size: 140,
      minSize: 120,
      cell: (context) => dateFormatter.format(context.row.original.createdAt)
    }
  ];
}

export function CasesPage() {
  const translation = useTranslation();
  const { t, i18n } = translation;
  const dateLocale = i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US';
  useDocumentTitle(getNavigationPageTitle(t, 'cases'));
  const createCaseDialog = useCreateCaseDialog();
  const [activeTab, setActiveTab] = useState<CaseTableTab>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [serializedFilter, setSerializedFilter] = useState<string>();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true }
  ]);
  const columns = useMemo(
    () => buildCaseColumns(t, dateLocale, dateLocale),
    [dateLocale, t]
  );
  const caseTabs = useMemo((): DataTableTab<CaseTableTab>[] => {
    return [
      { label: t('cases.all'), value: 'all' },
      ...CASE_STATUSES.map((status) => ({
        label: t(`cases.statuses.${status}`),
        value: status
      }))
    ];
  }, [t]);
  const filterFields = useMemo<FilterFieldDefinition[]>(
    () => [
      {
        id: 'internalNumber',
        label: t('cases.columns.internalNumber'),
        type: 'string'
      },
      {
        id: 'courtNumber',
        label: t('cases.columns.courtNumber'),
        type: 'string'
      },
      {
        id: 'courtName',
        label: t('cases.columns.courtName'),
        type: 'string'
      },
      {
        id: 'caseTypeName',
        label: t('cases.columns.caseType'),
        type: 'string'
      },
      {
        id: 'primaryLawyerName',
        label: t('cases.columns.primaryLawyer'),
        type: 'string'
      },
      {
        id: 'claimAmount',
        label: t('cases.columns.claimAmount'),
        type: 'number'
      },
      {
        id: 'status',
        label: t('cases.columns.status'),
        type: 'enum',
        options: CASE_STATUSES.map((status) => ({
          label: t(`cases.statuses.${status}`),
          value: status
        }))
      },
      {
        id: 'createdAt',
        label: t('cases.columns.createdAt'),
        type: 'date'
      }
    ],
    [t]
  );
  const advancedFilters = useAdvancedFilters({
    fields: filterFields,
    onApply: (value) => {
      setSerializedFilter(value);
      setPage(1);
    }
  });
  const activeSort = sorting[0];
  const casesQuery = useQuery({
    ...convexQuery(listTablePage, {
      status: activeTab === 'all' ? undefined : activeTab,
      page,
      pageSize,
      searchText: searchQuery.trim() || undefined,
      serializedFilter,
      sortField: activeSort?.id,
      sortDirection: activeSort?.desc ? 'desc' : activeSort ? 'asc' : undefined
    }),
    placeholderData: (previous) => previous
  });
  const response = casesQuery.data;
  const totalRows = response?.totalRows ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DataTablePage
        action={{
          label: t('cases.addCase'),
          icon: PlusIcon,
          onClick: createCaseDialog.openDialog
        }}
        activeTab={activeTab}
        advancedFilters={advancedFilters}
        columns={columns}
        data={response?.rows ?? []}
        entriesIcon={ScalesIcon}
        getRowId={(row) => row._id}
        isError={casesQuery.isError}
        isFetching={casesQuery.isFetching}
        isLoading={casesQuery.isPending}
        hasCriteria={
          activeTab !== 'all' ||
          searchQuery.trim().length > 0 ||
          serializedFilter !== undefined
        }
        labels={{
          entriesLabel: t('cases.labels.entries', { count: totalRows }),
          showingEntries: (start, end, total) =>
            t('common.dataTable.showingEntries', { start, end, total }),
          pageSize: (count) => t('cases.labels.documents', { count }),
          previousPage: t('cases.previousPage'),
          nextPage: t('cases.nextPage'),
          emptyTitle: t('cases.emptyTitle'),
          emptyDescription: t('cases.emptyDescription'),
          criteriaEmptyTitle: t('cases.criteriaEmptyTitle'),
          criteriaEmptyDescription: t('cases.criteriaEmptyDescription'),
          errorTitle: t('cases.errorTitle'),
          errorDescription: t('cases.errorDescription'),
          retryLabel: t('cases.retry'),
          emptyIcon: BriefcaseIcon,
          selectAllRows: t('common.dataTable.selectAllRows'),
          selectRow: t('common.dataTable.selectRow')
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        onRetry={() => void casesQuery.refetch()}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        onSortingChange={(value) => {
          setSorting(value.slice(0, 1));
          setPage(1);
        }}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setPage(1);
        }}
        page={page}
        pageSize={pageSize}
        searchPlaceholder={t('cases.searchPlaceholder')}
        searchQuery={searchQuery}
        sorting={sorting}
        tabs={caseTabs}
        totalRows={totalRows}
      />
      <CreateCaseDialog createCaseDialog={createCaseDialog} />
    </div>
  );
}
