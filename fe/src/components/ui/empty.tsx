import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

function Empty(props: { children: React.ReactNode; className?: string }) {
  const { children, className } = props;

  return (
    <div
      className={cn(
        'group/empty flex min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance rounded-xl border-dashed p-4 text-center md:gap-6 md:p-12',
        className
      )}
      data-slot="empty"
    >
      {children}
    </div>
  );
}

function EmptyHeader(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <div
      className="flex max-w-sm flex-col items-center text-center"
      data-slot="empty-header"
    >
      {children}
    </div>
  );
}

const emptyMediaVariants = cva(
  'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    defaultVariants: {
      variant: 'default'
    },
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "relative flex size-9 shrink-0 items-center justify-center rounded-md border bg-card text-foreground shadow-black/5 shadow-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-sm [&_svg:not([class*='size-'])]:size-4.5"
      }
    }
  }
);

function EmptyMedia(
  props: { children: React.ReactNode } & VariantProps<typeof emptyMediaVariants>
) {
  const { variant = 'default', children } = props;

  return (
    <div
      className="relative mb-3"
      data-slot="empty-media"
      data-variant={variant}
    >
      {variant === 'icon' && (
        <>
          <div
            aria-hidden="true"
            className={cn(
              emptyMediaVariants({ variant }),
              '-translate-x-0.5 -rotate-10 pointer-events-none absolute bottom-px origin-bottom-left scale-84 shadow-none'
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              emptyMediaVariants({ variant }),
              'pointer-events-none absolute bottom-px origin-bottom-right translate-x-0.5 rotate-10 scale-84 shadow-none'
            )}
          />
        </>
      )}
      <div className={emptyMediaVariants({ variant })}>{children}</div>
    </div>
  );
}

function EmptyTitle(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <div
      className="font-heading text-xl leading-snug"
      data-slot="empty-title"
    >
      {children}
    </div>
  );
}

function EmptyDescription(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <div
      className="hidden text-muted-foreground text-sm/relaxed md:block [@media(hover:hover)]:[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4 [[data-slot=empty-title]+&]:mt-1"
      data-slot="empty-description"
    >
      {children}
    </div>
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia };
