import * as React from 'react';
import { cn } from '@/lib/utils';

type TableProps = React.ComponentProps<'table'> & {
  containerClassName?: string;
};

const Table = React.forwardRef<HTMLDivElement, TableProps>((props, ref) => {
  const { className, containerClassName, ...tableProps } = props;
  return (
    <div
      ref={ref}
      className={cn(
        'group/table relative w-full overflow-x-auto overscroll-x-contain',
        containerClassName
      )}
      data-slot="table-container"
    >
      <table
        className={cn(
          'relative w-full min-w-full caption-bottom text-sm',
          className
        )}
        data-slot="table"
        {...tableProps}
      />
    </div>
  );
});
Table.displayName = 'Table';

function TableHeader(props: React.ComponentProps<'thead'>) {
  return (
    <thead
      {...props}
      className={cn('[&_tr]:border-b', props.className)}
      data-slot="table-header"
    />
  );
}

function TableBody(props: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      {...props}
      className={cn('[&_tr:last-child]:border-0', props.className)}
      data-slot="table-body"
    />
  );
}

function TableRow(props: React.ComponentProps<'tr'>) {
  return (
    <tr
      {...props}
      className={cn(
        'border-b transition-colors [@media(hover:hover)]:[&:hover>td]:bg-secondary-hover/30',
        'data-[state=selected]:shadow-[inset_3px_0_0_0_var(--primary)] [&[data-state=selected]>td]:bg-secondary-hover/30',
        props.className
      )}
      data-slot="table-row"
    />
  );
}

function TableHead(props: React.ComponentProps<'th'>) {
  return (
    <th
      {...props}
      className={cn(
        'h-10 max-w-xs whitespace-nowrap px-2 align-middle font-medium text-foreground',
        props.className
      )}
      data-slot="table-head"
    />
  );
}

function TableCell(props: React.ComponentProps<'td'>) {
  return (
    <td
      {...props}
      className={cn(
        'max-w-xs whitespace-nowrap p-2 align-middle transition-colors',
        props.className
      )}
      data-slot="table-cell"
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
