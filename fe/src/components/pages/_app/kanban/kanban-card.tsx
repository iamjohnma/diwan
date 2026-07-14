import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import type {
  KanbanAssignee,
  KanbanTask
} from '@/components/pages/_app/kanban/kanban-mock-data';
import { cn } from '@/lib/utils';

function AssigneeAvatar(props: { assignee: KanbanAssignee }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!props.assignee.avatarUrl && !imageFailed;
  const initials = props.assignee.name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        props.assignee.colorClassName
      )}
      style={{ fontSize: '10px' }}
      title={props.assignee.name}
    >
      {showImage ? (
        <img
          alt={props.assignee.name}
          className="size-full object-cover"
          draggable={false}
          src={props.assignee.avatarUrl}
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

interface TaskCardContentProps {
  task: KanbanTask;
  isOverlay?: boolean;
  className?: string;
}

export function TaskCardContent(props: TaskCardContentProps) {
  const { task } = props;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border-2 border-border-default bg-background-base px-3.5 py-3',
        props.isOverlay && 'border-border-strong shadow-xl shadow-black/10',
        props.className
      )}
    >
      <button
        aria-label={`Complete ${task.title}`}
        className={cn(
          'mt-0.5 size-5 shrink-0 cursor-pointer rounded-full border-2 transition-colors',
          task.isPriority
            ? 'border-red-500 bg-red-500/10 hover:bg-red-500/20'
            : 'border-border-strong hover:bg-background-elevated'
        )}
        type="button"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 text-text-primary">
          {task.title}
        </span>
        {task.description && (
          <span className="truncate text-xs leading-4.5 text-text-tertiary">
            {task.description}
          </span>
        )}
        {task.meta && task.meta.length > 0 && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            {task.meta.map((meta) => {
              const MetaIcon = meta.icon;

              return (
                <span
                  key={meta.id}
                  className={cn(
                    'flex items-center gap-0.5 text-xs',
                    meta.colorClassName ?? 'text-text-tertiary'
                  )}
                >
                  <MetaIcon aria-hidden="true" className="size-3.5" />
                  {meta.label}
                </span>
              );
            })}
          </span>
        )}
      </div>
      {task.assignee && <AssigneeAvatar assignee={task.assignee} />}
    </div>
  );
}

interface KanbanCardProps {
  task: KanbanTask;
  laneId: string;
  index: number;
  /** True while this card is being dragged: renders as an empty drop slot. */
  isActive: boolean;
}

export function KanbanCard(props: KanbanCardProps) {
  const draggable = useDraggable({
    id: props.task.id,
    data: { laneId: props.laneId, index: props.index }
  });
  const droppable = useDroppable({
    id: `card-drop:${props.task.id}`,
    data: { laneId: props.laneId, index: props.index }
  });

  return (
    <motion.div
      layout
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      className="touch-none select-none"
      transition={{ layout: { type: 'spring', stiffness: 550, damping: 40 } }}
      {...draggable.attributes}
      {...draggable.listeners}
    >
      {props.isActive ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="rounded-xl bg-background-elevated"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <TaskCardContent className="invisible" task={props.task} />
        </motion.div>
      ) : (
        <TaskCardContent task={props.task} />
      )}
    </motion.div>
  );
}
