import type { ElementType, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Fragment, memo, useEffect, useMemo, useRef } from 'react';
import { CaretDownIcon, CaretUpIcon, TrayIcon } from '@phosphor-icons/react';
import type {
  Cell,
  Header,
  Table as TanStackTable
} from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { TruncateText } from '@/components/common';
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const HEADER_BASE_CLASSES =
  'h-12.5 min-w-0 max-w-none overflow-hidden text-ellipsis py-3 font-medium uppercase tracking-wider text-text-table-header';
const CELL_BASE_CLASSES =
  'relative min-w-0 max-w-none overflow-hidden text-ellipsis py-3 text-[15px] *:min-w-0 *:max-w-full **:min-w-0 **:max-w-full';
const CELL_ACTION_TARGET_SELECTOR =
  'button, a[href], input, select, textarea, [role="button"], [role="menuitem"], [data-cell-action]';

export interface DataTableCoreLabels {
  emptyTitle?: string;
  emptyDescription?: string;
  criteriaEmptyTitle?: string;
  criteriaEmptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  retryLabel?: string;
  emptyIcon?: ElementType;
  selectAllRows?: string;
  selectRow?: string;
}

export interface DataTableSelectionState<TData> {
  selectedRowIds: ReadonlySet<string>;
  getRowId: (row: TData) => string;
  isRowSelectable?: (row: TData) => boolean;
  onToggleRow: (row: TData, selected: boolean) => void;
  onToggleAllVisibleRows: (rows: TData[], selected: boolean) => void;
}

export interface DataTableCoreProps<TData> {
  table: TanStackTable<TData>;
  containerClassName?: string;
  headerClassName?: string;
  headerRowClassName?: string;
  headerCellClassName?: string;
  labels?: DataTableCoreLabels;
  emptyStateKind?: 'source-empty' | 'criteria-empty' | 'error';
  onRetry?: () => void;
  onRowClick?: (row: TData) => void;
  isRowClickable?: (row: TData) => boolean;
  shouldIgnoreRowClick?: (
    row: TData,
    event: MouseEvent<HTMLTableRowElement>
  ) => boolean;
  getRowClassName?: (row: TData) => string;
  renderExpandedRow?: (row: TData, colSpan: number) => ReactNode;
  isRowExpanded?: (row: TData) => boolean;
  onRowHover?: (row: TData) => void;
  selection?: DataTableSelectionState<TData>;
  highlightedRowId?: string;
  highlightedRowClassName?: string;
  getRowId?: (row: TData) => string;
  suppressRowInteractions?: boolean;
}

interface ResolvedEmptyState {
  title: string;
  description?: string;
  icon: ElementType;
  retryLabel?: string;
}

function resolveEmptyState(
  labels: DataTableCoreLabels,
  kind: DataTableCoreProps<unknown>['emptyStateKind']
): ResolvedEmptyState {
  if (kind === 'error') {
    return {
      title: labels.errorTitle ?? '',
      description: labels.errorDescription,
      icon: labels.emptyIcon ?? TrayIcon,
      retryLabel: labels.retryLabel
    };
  }
  if (kind === 'criteria-empty') {
    return {
      title: labels.criteriaEmptyTitle ?? labels.emptyTitle ?? '',
      description: labels.criteriaEmptyDescription ?? labels.emptyDescription,
      icon: labels.emptyIcon ?? TrayIcon
    };
  }
  return {
    title: labels.emptyTitle ?? '',
    description: labels.emptyDescription,
    icon: labels.emptyIcon ?? TrayIcon
  };
}

function renderHeaderContent<TData>(header: Header<TData, unknown>) {
  const canSort = header.column.getCanSort();
  const sortState = header.column.getIsSorted();
  const content = flexRender(
    header.column.columnDef.header,
    header.getContext()
  );

  if (!canSort) {
    return (
      <div className="flex min-w-0 items-center justify-start gap-1.5 overflow-hidden text-ellipsis text-sm text-inherit">
        <TruncateText className="text-inherit">{content}</TruncateText>
      </div>
    );
  }
  return (
    <button
      className="flex h-full w-full min-w-0 cursor-pointer touch-pan-x touch-pan-y items-center justify-start gap-1.5 px-2 text-sm text-inherit outline-none"
      onClick={header.column.getToggleSortingHandler()}
      type="button"
    >
      <TruncateText className="text-inherit">{content}</TruncateText>
      <span className="inline-flex shrink-0 flex-col items-center justify-center leading-none">
        <CaretUpIcon
          className={cn(
            'size-3',
            sortState === 'asc' ? 'text-text-primary' : 'text-text-tertiary/50'
          )}
          weight="bold"
        />
        <CaretDownIcon
          className={cn(
            'size-3 -mt-1',
            sortState === 'desc' ? 'text-text-primary' : 'text-text-tertiary/50'
          )}
          weight="bold"
        />
      </span>
    </button>
  );
}

function renderCellContent<TData>(cell: Cell<TData, unknown>) {
  const content = flexRender(cell.column.columnDef.cell, cell.getContext());
  if (typeof content === 'string' || typeof content === 'number') {
    return <TruncateText>{content}</TruncateText>;
  }
  return content;
}

function DataTableCheckbox(props: {
  checked: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current)
      inputRef.current.indeterminate = props.indeterminate ?? false;
  }, [props.indeterminate]);

  return (
    <input
      ref={inputRef}
      aria-label={props.label}
      checked={props.checked}
      className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
      type="checkbox"
    />
  );
}

function DataTableCoreComponent<TData>(props: DataTableCoreProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const labels = useMemo(
    () => resolveEmptyState(props.labels ?? {}, props.emptyStateKind),
    [props.emptyStateKind, props.labels]
  );
  const rows = props.table.getRowModel().rows;
  const visibleColumns = props.table.getVisibleLeafColumns();
  const selectionRows = props.selection
    ? rows.filter(
        (row) => props.selection?.isRowSelectable?.(row.original) ?? true
      )
    : [];
  const allVisibleSelected =
    selectionRows.length > 0 &&
    selectionRows.every((row) => {
      if (!props.selection) return false;
      return props.selection.selectedRowIds.has(
        props.selection.getRowId(row.original)
      );
    });
  const someVisibleSelected =
    !allVisibleSelected &&
    selectionRows.some((row) => {
      if (!props.selection) return false;
      return props.selection.selectedRowIds.has(
        props.selection.getRowId(row.original)
      );
    });
  const colSpan = Math.max(
    1,
    visibleColumns.length + (props.selection ? 1 : 0)
  );

  useEffect(() => {
    if (!props.highlightedRowId) return;
    const highlightedRow =
      tableContainerRef.current?.querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(props.highlightedRowId)}"]`
      );
    highlightedRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [props.highlightedRowId]);

  return (
    <Table
      ref={tableContainerRef}
      className="table-fixed"
      containerClassName={cn(
        'h-full overflow-x-auto overflow-y-auto rounded-xl',
        props.containerClassName
      )}
    >
      <colgroup>
        {props.selection ? <col className="w-10" /> : null}
        {visibleColumns.map((column) => (
          <col key={column.id} style={{ width: column.getSize() }} />
        ))}
      </colgroup>
      <TableHeader
        className={cn(
          'sticky top-0 z-10 bg-background-table-header [&_tr]:border-0',
          props.headerClassName
        )}
      >
        {props.table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className={cn(
              'border-b border-border-default/60 bg-background-table-header hover:bg-background-table-header',
              props.headerRowClassName
            )}
          >
            {props.selection ? (
              <TableHead className="h-12.5 text-center">
                <DataTableCheckbox
                  checked={allVisibleSelected}
                  disabled={selectionRows.length === 0}
                  indeterminate={someVisibleSelected}
                  label={props.labels?.selectAllRows ?? ''}
                  onChange={(checked) =>
                    props.selection?.onToggleAllVisibleRows(
                      selectionRows.map((row) => row.original),
                      checked
                    )
                  }
                />
              </TableHead>
            ) : null}
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                aria-sort={
                  header.column.getIsSorted() === 'asc'
                    ? 'ascending'
                    : header.column.getIsSorted() === 'desc'
                      ? 'descending'
                      : 'none'
                }
                className={cn(
                  HEADER_BASE_CLASSES,
                  header.column.getCanSort() && 'cursor-pointer p-0',
                  props.headerCellClassName
                )}
              >
                {header.isPlaceholder ? null : renderHeaderContent(header)}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody
        {...(props.suppressRowInteractions ? { inert: true as const } : {})}
      >
        {rows.length > 0 ? (
          rows.map((row) => {
            const rowId = props.getRowId?.(row.original) ?? row.id;
            const clickable =
              props.isRowClickable?.(row.original) ?? Boolean(props.onRowClick);
            const isSelected = props.selection
              ? props.selection.selectedRowIds.has(
                  props.selection.getRowId(row.original)
                )
              : false;
            const activate = (event: MouseEvent<HTMLTableRowElement>) => {
              const target = event.target;
              if (
                !clickable ||
                props.shouldIgnoreRowClick?.(row.original, event) ||
                (target instanceof Element &&
                  target.closest(CELL_ACTION_TARGET_SELECTOR))
              )
                return;
              props.onRowClick?.(row.original);
            };
            const activateFromKeyboard = (
              event: KeyboardEvent<HTMLTableRowElement>
            ) => {
              if (!clickable || (event.key !== 'Enter' && event.key !== ' '))
                return;
              event.preventDefault();
              props.onRowClick?.(row.original);
            };

            return (
              <Fragment key={row.id}>
                <TableRow
                  className={cn(
                    'h-13 min-h-[52px] border-b border-border-default/40 outline-none',
                    clickable && 'cursor-pointer',
                    props.highlightedRowId === rowId &&
                      (props.highlightedRowClassName ??
                        '[&>td]:bg-primary/10 [@media(hover:hover)]:[&:hover>td]:bg-primary/10'),
                    props.getRowClassName?.(row.original)
                  )}
                  data-row-id={rowId}
                  data-state={isSelected ? 'selected' : undefined}
                  onClick={activate}
                  onKeyDown={activateFromKeyboard}
                  onMouseEnter={() => props.onRowHover?.(row.original)}
                  tabIndex={clickable ? 0 : undefined}
                >
                  {props.selection ? (
                    <TableCell className={cn(CELL_BASE_CLASSES, 'text-center')}>
                      <DataTableCheckbox
                        checked={isSelected}
                        disabled={
                          props.selection.isRowSelectable?.(row.original) ===
                          false
                        }
                        label={props.labels?.selectRow ?? ''}
                        onChange={(checked) =>
                          props.selection?.onToggleRow(row.original, checked)
                        }
                      />
                    </TableCell>
                  ) : null}
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={CELL_BASE_CLASSES}>
                      {renderCellContent(cell)}
                    </TableCell>
                  ))}
                </TableRow>
                {props.isRowExpanded?.(row.original)
                  ? props.renderExpandedRow?.(row.original, colSpan)
                  : null}
              </Fragment>
            );
          })
        ) : (
          <tr className="hover:bg-transparent">
            <TableCell
              className="max-w-none whitespace-normal py-8 text-center md:py-12"
              colSpan={colSpan}
            >
              <div className="sticky start-0 w-[calc(100vw-2rem)] md:static md:w-auto">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <labels.icon className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>
                      <TruncateText className="text-inherit">
                        {labels.title}
                      </TruncateText>
                    </EmptyTitle>
                    {labels.description ? (
                      <EmptyDescription>
                        <TruncateText className="text-inherit">
                          {labels.description}
                        </TruncateText>
                      </EmptyDescription>
                    ) : null}
                  </EmptyHeader>
                  {labels.retryLabel && props.onRetry ? (
                    <Button onClick={props.onRetry} size="sm" variant="outline">
                      {labels.retryLabel}
                    </Button>
                  ) : null}
                </Empty>
              </div>
            </TableCell>
          </tr>
        )}
      </TableBody>
    </Table>
  );
}

export const DataTableCore = memo(
  DataTableCoreComponent
) as typeof DataTableCoreComponent;
