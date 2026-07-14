import { useCallback, useEffect, useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';
import { Combobox } from '@/components/ui';
import { cn } from '@/lib/utils';

interface AssistantThread {
  id: string;
  title: string;
}

interface AiAssistantThreadPickerProps<T extends AssistantThread> {
  threads: T[];
  currentThreadId: string | null;
  titlePlaceholder: string;
  emptyLabel: string;
  noResultsLabel: string;
  searchPlaceholder: string;
  disabled: boolean;
  onSelectThread: (thread: T) => void;
}

export function AiAssistantThreadPicker<T extends AssistantThread>(
  props: AiAssistantThreadPickerProps<T>
) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!props.disabled) return;
    setIsOpen(false);
    setQuery('');
  }, [props.disabled]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (props.disabled) {
        setIsOpen(false);
        setQuery('');
        return;
      }
      setIsOpen(open);
      if (!open) setQuery('');
    },
    [props.disabled]
  );

  const handleSelectThread = useCallback(
    (_threadId: string, thread: T) => {
      props.onSelectThread(thread);
      setIsOpen(false);
      setQuery('');
    },
    [props]
  );

  return (
    <div
      className="min-w-0 max-w-full"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Combobox
        open={isOpen}
        onOpenChange={handleOpenChange}
        items={props.threads}
        value={props.currentThreadId}
        onValueChange={handleSelectThread}
        getItemValue={(thread) => thread.id}
        getItemLabel={(thread) => thread.title}
        getItemSearchValue={(thread) => thread.title}
        disabled={props.disabled}
        align="start"
        sideOffset={6}
        matchTriggerWidth={false}
        contentClassName="z-100 w-[min(18rem,calc(100vw-2rem))]"
        listClassName="max-h-60"
        motionKey="ai-assistant-thread-highlight"
        stopPropagation
        search={{
          value: query,
          onValueChange: setQuery,
          placeholder: props.searchPlaceholder,
          autoFocus: true,
          containerClassName: 'p-3',
          inputClassName:
            'h-9 rounded-md border border-border-default bg-background-surface px-3 focus-visible:ring-1 focus-visible:ring-ring'
        }}
        emptyLabel={props.emptyLabel}
        noResultsLabel={query.trim() ? props.noResultsLabel : props.emptyLabel}
        renderTrigger={({ selectedLabel }) => (
          <button
            type="button"
            disabled={props.disabled}
            className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-background-elevated focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none disabled:pointer-events-none"
          >
            <span className="truncate">
              {selectedLabel ?? props.titlePlaceholder}
            </span>
            <CaretDownIcon
              className={cn(
                'size-4 shrink-0 text-text-tertiary transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
              weight="bold"
            />
          </button>
        )}
        renderOption={(thread) => (
          <span className="line-clamp-2">{thread.title}</span>
        )}
      />
    </div>
  );
}
