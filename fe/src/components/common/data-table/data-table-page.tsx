import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { motion } from 'motion/react';
import {
  AdvancedFilterPanelContent,
  AdvancedFilterTrigger
} from './advanced-filters';
import { DataTableSearch } from './data-table-action-bar/data-table-search';
import {
  DataTableCore,
  type DataTableCoreLabels
} from './data-table-core/data-table-core';
import { LoadingSpinner, TruncateText } from '@/components/common';
import {
  Button,
  DynamicPopover,
  DynamicPopoverContent,
  DynamicPopoverPanel,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from '@/components/ui';
import { useDirection } from '@/hooks/common';
import type { AdvancedFiltersResultHook } from '@/hooks/common/advanced-filters';
import { cn } from '@/lib/utils';

export interface DataTableTab<TTab extends string> {
  label: string;
  value: TTab;
}

interface DataTablePageAction {
  label: string;
  icon?: Icon;
  onClick: () => void;
}

interface DataTablePageLabels extends DataTableCoreLabels {
  entriesLabel: string;
  showingEntries: (start: number, end: number, total: number) => string;
  pageSize: (count: number) => string;
  previousPage: string;
  nextPage: string;
}

export interface DataTablePageProps<TData, TTab extends string> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  tabs: DataTableTab<TTab>[];
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  totalRows: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  labels: DataTablePageLabels;
  entriesIcon?: Icon;
  action?: DataTablePageAction;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  getRowId?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  actionExtra?: ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  advancedFilters?: AdvancedFiltersResultHook;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  hasCriteria?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100] as const;
const MAX_VISIBLE_PAGE_BUTTONS = 7;
const ELLIPSIS_LABEL = '…';
const TAB_INDICATOR_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35
};

type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

function getPageNumbers(currentPage: number, totalPages: number): PageItem[] {
  const effectiveTotalPages = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), effectiveTotalPages);

  if (effectiveTotalPages <= MAX_VISIBLE_PAGE_BUTTONS) {
    return Array.from({ length: effectiveTotalPages }, (_, index) => index + 1);
  }

  const windowStart = Math.max(
    2,
    Math.min(current - 1, effectiveTotalPages - 4)
  );
  const windowEnd = Math.min(effectiveTotalPages - 1, Math.max(current + 1, 5));
  const items: PageItem[] = [1];
  if (windowStart > 2) items.push(windowStart === 3 ? 2 : 'start-ellipsis');
  for (let page = windowStart; page <= windowEnd; page += 1) items.push(page);
  if (windowEnd < effectiveTotalPages - 1) {
    items.push(
      windowEnd === effectiveTotalPages - 2
        ? effectiveTotalPages - 1
        : 'end-ellipsis'
    );
  }
  items.push(effectiveTotalPages);

  return items;
}

function DataTableTabs<TTab extends string>(props: {
  tabs: DataTableTab<TTab>[];
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative min-w-0">
      <div className="-mx-4 mb-px min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain border-b border-border-default [-webkit-overflow-scrolling:touch] max-md:mb-2">
        <div className="relative flex min-w-max">
          {props.tabs.map((tab) => {
            const selected = tab.value === props.activeTab;

            return (
              <button
                key={tab.value}
                className={cn(
                  'relative cursor-pointer select-none border-0 bg-transparent px-4 py-3.25 text-sm font-medium shadow-none transition-colors outline-none [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]',
                  selected
                    ? 'text-primary'
                    : 'text-text-secondary hover:text-text-primary',
                  props.disabled && 'cursor-wait'
                )}
                disabled={props.disabled}
                onClick={() => props.onTabChange(tab.value)}
                type="button"
              >
                <TruncateText>{tab.label}</TruncateText>
                {selected ? (
                  <motion.span
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-primary"
                    layoutId="data-table-tab-indicator"
                    transition={TAB_INDICATOR_TRANSITION}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EntriesCounter(props: {
  totalRows: number;
  label: string;
  icon?: Icon;
  isLoading?: boolean;
}) {
  const EntriesIcon = props.icon;

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {EntriesIcon ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background-elevated">
          <EntriesIcon
            className="size-5.5 text-text-secondary md:size-6"
            weight="bold"
          />
        </div>
      ) : null}
      <div className="flex items-center gap-x-1.5 text-sm text-text-tertiary">
        {props.isLoading ? (
          <Skeleton className="h-7 w-5 shrink-0 md:h-8" />
        ) : (
          <p className="text-lg font-semibold tabular-nums text-text-primary md:text-2xl">
            {props.totalRows}
          </p>
        )}
        <p className="mt-0.5 truncate">{props.label}</p>
      </div>
    </div>
  );
}

function PageSizeSelect(props: {
  value: number;
  label: string;
  pageSizeLabel: (count: number) => string;
  onChange: (pageSize: number) => void;
}) {
  return (
    <Select
      value={String(props.value)}
      onValueChange={(value) => props.onChange(Number(value))}
    >
      <SelectTrigger className="h-9 w-auto min-w-[130px] shrink-0 ps-2.5 pe-2 text-sm md:h-10 md:ps-3">
        <SelectValue>
          <TruncateText>{props.label}</TruncateText>
        </SelectValue>
      </SelectTrigger>
      <SelectContent matchTriggerWidth={false} align="end">
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {props.pageSizeLabel(size)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DataTablePagination(props: {
  page: number;
  pageSize: number;
  totalRows: number;
  labels: DataTablePageLabels;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(props.totalRows / props.pageSize));
  const pageNumbers = getPageNumbers(props.page, totalPages);
  const start =
    props.totalRows === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const end = Math.min(props.totalRows, props.page * props.pageSize);
  const canGoPrevious = props.page > 1;
  const canGoNext = props.page < totalPages;
  const isRtl = useDirection() === 'rtl';
  const PreviousIcon = isRtl ? CaretRightIcon : CaretLeftIcon;
  const NextIcon = isRtl ? CaretLeftIcon : CaretRightIcon;

  return (
    <div className="flex flex-row items-center justify-between gap-2 border-t border-border-default pt-3 md:gap-3 md:pt-4">
      <TruncateText
        as="span"
        className="min-w-[105px] shrink-0 text-sm tabular-nums text-text-tertiary"
      >
        {props.totalRows > 0
          ? props.labels.showingEntries(start, end, props.totalRows)
          : ''}
      </TruncateText>
      <div className="flex items-center gap-1.5 md:gap-2">
        <IconButton
          disabled={!canGoPrevious}
          icon={PreviousIcon}
          iconProps={{ className: 'size-4', weight: 'bold' }}
          onClick={() => props.onPageChange(props.page - 1)}
          size="iconMdResponsive"
          tooltip={props.labels.previousPage}
          variant="pagination"
        />
        <div className="hidden items-center gap-1.5 sm:flex md:gap-2">
          {pageNumbers.map((pageItem) =>
            typeof pageItem === 'number' ? (
              <IconButton
                key={pageItem}
                aria-label={String(pageItem)}
                className={cn(
                  'tabular-nums',
                  pageItem === props.page && 'pointer-events-none'
                )}
                onClick={() => props.onPageChange(pageItem)}
                size="iconMdResponsive"
                variant={
                  pageItem === props.page ? 'paginationActive' : 'pagination'
                }
              >
                {pageItem}
              </IconButton>
            ) : (
              <span
                key={pageItem}
                className="flex h-9 min-w-6 select-none items-center justify-center text-sm text-text-tertiary md:h-10"
              >
                {ELLIPSIS_LABEL}
              </span>
            )
          )}
        </div>
        <IconButton
          disabled={!canGoNext}
          icon={NextIcon}
          iconProps={{ className: 'size-4', weight: 'bold' }}
          onClick={() => props.onPageChange(props.page + 1)}
          size="iconMdResponsive"
          tooltip={props.labels.nextPage}
          variant="pagination"
        />
      </div>
      <PageSizeSelect
        label={props.labels.pageSize(props.pageSize)}
        onChange={props.onPageSizeChange}
        pageSizeLabel={props.labels.pageSize}
        value={props.pageSize}
      />
    </div>
  );
}

function DataTablePageComponent<TData, TTab extends string>(
  props: DataTablePageProps<TData, TTab>
) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sorting = props.sorting ?? internalSorting;
  // TanStack Table intentionally returns stable callable helpers that React
  // Compiler cannot analyze; the table instance is safe to use as documented.
  const table = useReactTable({
    data: props.data,
    columns: props.columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const nextSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      if (props.onSortingChange) props.onSortingChange(nextSorting);
      else setInternalSorting(nextSorting);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: props.onSortingChange ? undefined : getSortedRowModel(),
    manualSorting: props.onSortingChange !== undefined,
    getRowId: props.getRowId
  });
  const emptyStateKind = props.isError
    ? 'error'
    : props.hasCriteria
      ? 'criteria-empty'
      : 'source-empty';
  const isInitialLoading = props.isLoading && props.data.length === 0;

  return (
    <section className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden px-4 pb-0 md:pb-4">
      <div className="w-full min-w-0 shrink-0">
        <DataTableTabs
          activeTab={props.activeTab}
          disabled={props.isFetching}
          onTabChange={props.onTabChange}
          tabs={props.tabs}
        />
      </div>
      <div className="mt-2 shrink-0 max-md:mb-1 md:mt-4">
        <div className="flex flex-row items-center justify-between gap-2 md:gap-3">
          <EntriesCounter
            icon={props.entriesIcon}
            isLoading={isInitialLoading}
            label={props.labels.entriesLabel}
            totalRows={props.totalRows}
          />
          <DynamicPopover>
            <div className="flex items-center gap-2 md:gap-3">
              {props.onSearchChange ? (
                <DataTableSearch
                  value={props.searchQuery ?? ''}
                  onChange={props.onSearchChange}
                  placeholder={props.searchPlaceholder ?? ''}
                />
              ) : null}
              {props.advancedFilters ? (
                <AdvancedFilterTrigger
                  advancedFilters={props.advancedFilters}
                />
              ) : null}
              {props.actionExtra}
              {props.action ? (
                <Button
                  onClick={props.action.onClick}
                  prefixIcon={props.action.icon}
                  prefixIconProps={{ weight: 'bold' }}
                >
                  {props.action.label}
                </Button>
              ) : null}
              {props.advancedFilters ? (
                <DynamicPopoverContent align="end" sideOffset={8}>
                  <DynamicPopoverPanel
                    panelId="filters"
                    className="flex h-auto max-h-[50dvh] w-max max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-4xl"
                  >
                    <AdvancedFilterPanelContent
                      advancedFilters={props.advancedFilters}
                    />
                  </DynamicPopoverPanel>
                </DynamicPopoverContent>
              ) : null}
            </div>
          </DynamicPopover>
        </div>
      </div>
      <div className="relative mt-3 min-h-0 min-w-0 flex-1 md:mt-6">
        <div
          className={cn(
            'h-full transition-opacity duration-300',
            props.isFetching && 'opacity-90'
          )}
        >
          <DataTableCore
            emptyStateKind={emptyStateKind}
            getRowClassName={props.getRowClassName}
            getRowId={props.getRowId}
            labels={props.labels}
            onRetry={props.onRetry}
            onRowClick={props.onRowClick}
            suppressRowInteractions={props.isFetching}
            table={table}
          />
        </div>
        {props.isFetching ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background-base/15">
            <LoadingSpinner />
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-auto shrink-0 transition-opacity duration-300',
          props.isFetching && 'pointer-events-none'
        )}
      >
        <DataTablePagination
          labels={props.labels}
          onPageChange={props.onPageChange}
          onPageSizeChange={props.onPageSizeChange}
          page={props.page}
          pageSize={props.pageSize}
          totalRows={props.totalRows}
        />
      </div>
    </section>
  );
}

export const DataTablePage = DataTablePageComponent;
