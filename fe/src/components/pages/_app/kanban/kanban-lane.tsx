import { useDroppable } from '@dnd-kit/core';
import { DotsThreeIcon, PlusIcon } from '@phosphor-icons/react';
import { KanbanCard } from '@/components/pages/_app/kanban/kanban-card';
import type {
  KanbanLaneData,
  KanbanTask
} from '@/components/pages/_app/kanban/kanban-mock-data';
import { KANBAN_LABELS } from '@/components/pages/_app/kanban/kanban-mock-data';

interface KanbanLaneProps {
  lane: KanbanLaneData;
  tasks: KanbanTask[];
  activeTaskId: string | null;
}

export function KanbanLane(props: KanbanLaneProps) {
  const { lane } = props;
  const droppable = useDroppable({
    id: `lane:${lane.id}`,
    data: { laneId: lane.id }
  });

  return (
    <section
      aria-label={lane.title}
      className="flex max-h-full w-80 shrink-0 flex-col"
    >
      <header className="mb-2 flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-background-elevated px-3 py-3 transition-colors hover:bg-background-muted">
        <h2 className="min-w-0 truncate text-sm font-bold text-text-primary">
          {lane.title}
        </h2>
        <span className="text-sm tabular-nums text-text-tertiary">
          {props.tasks.length}
        </span>
        <button
          aria-label={`${lane.title} options`}
          className="ms-auto cursor-pointer rounded-md p-1 text-text-tertiary transition-colors hover:bg-background-muted hover:text-text-primary"
          type="button"
        >
          <DotsThreeIcon className="size-6" weight="bold" />
        </button>
      </header>
      <div className="flex min-h-0 flex-col overflow-y-auto">
        <div
          ref={droppable.setNodeRef}
          className="flex min-h-14 flex-col gap-2.5"
        >
          {props.tasks.map((task, index) => (
            <KanbanCard
              key={task.id}
              index={index}
              isActive={task.id === props.activeTaskId}
              laneId={lane.id}
              task={task}
            />
          ))}
        </div>
        <button
          className="mt-1.5 flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-light px-2 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          type="button"
        >
          <PlusIcon className="size-5" weight="bold" />
          {KANBAN_LABELS.addTask}
        </button>
      </div>
    </section>
  );
}
