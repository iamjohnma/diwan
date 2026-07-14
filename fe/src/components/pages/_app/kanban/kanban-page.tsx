import { useMemo, useRef, useState } from 'react';
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { motion } from 'motion/react';
import { TaskCardContent } from '@/components/pages/_app/kanban/kanban-card';
import { KanbanLane } from '@/components/pages/_app/kanban/kanban-lane';
import type { KanbanTask } from '@/components/pages/_app/kanban/kanban-mock-data';
import {
  KANBAN_LABELS,
  KANBAN_LANES
} from '@/components/pages/_app/kanban/kanban-mock-data';
import { useDocumentTitle } from '@/hooks/core';

type LaneTasksMap = Record<string, KanbanTask[]>;

interface DropTarget {
  laneId: string;
  index?: number;
}

function buildInitialLaneTasks(): LaneTasksMap {
  return Object.fromEntries(KANBAN_LANES.map((lane) => [lane.id, lane.tasks]));
}

// Prefer the droppable directly under the pointer; fall back to the nearest
// corner so drops just outside a lane's cards still land somewhere sensible.
const detectCollisions: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);

  return withinPointer.length > 0 ? withinPointer : closestCorners(args);
};

function resolveDropTarget(over: DragEndEvent['over']): DropTarget | null {
  const data = over?.data.current;
  if (!over || typeof data?.laneId !== 'string') return null;
  if (String(over.id).startsWith('lane:')) return { laneId: data.laneId };

  return {
    laneId: data.laneId,
    index: typeof data.index === 'number' ? data.index : undefined
  };
}

function moveTask(
  lanes: LaneTasksMap,
  taskId: string,
  target: DropTarget
): LaneTasksMap {
  const sourceLaneId = Object.keys(lanes).find((laneId) =>
    (lanes[laneId] ?? []).some((task) => task.id === taskId)
  );
  if (!sourceLaneId) return lanes;
  const sourceLane = lanes[sourceLaneId] ?? [];
  const task = sourceLane.find((entry) => entry.id === taskId);
  if (!task) return lanes;

  const sourceTasks = sourceLane.filter((entry) => entry.id !== taskId);
  const targetTasks =
    target.laneId === sourceLaneId
      ? [...sourceTasks]
      : [...(lanes[target.laneId] ?? [])];
  const insertAt = Math.min(
    target.index ?? targetTasks.length,
    targetTasks.length
  );
  targetTasks.splice(insertAt, 0, task);

  // No-op moves (dragging over its own slot) must return the same reference
  // so live onDragOver updates don't re-render or fight the drop animation.
  if (
    target.laneId === sourceLaneId &&
    targetTasks.every((entry, index) => entry === sourceLane[index])
  ) {
    return lanes;
  }

  return {
    ...lanes,
    [sourceLaneId]: target.laneId === sourceLaneId ? targetTasks : sourceTasks,
    [target.laneId]: targetTasks
  };
}

export function KanbanPage() {
  useDocumentTitle(KANBAN_LABELS.boardTitle);
  const [laneTasks, setLaneTasks] = useState<LaneTasksMap>(
    buildInitialLaneTasks
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const dragStartSnapshot = useRef<LaneTasksMap | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;

    return (
      Object.values(laneTasks)
        .flat()
        .find((task) => task.id === activeTaskId) ?? null
    );
  }, [activeTaskId, laneTasks]);

  // Reorder live while dragging so lanes open a slot under the pointer and
  // the source lane closes the gap immediately.
  const handleDragOver = (event: DragOverEvent) => {
    const target = resolveDropTarget(event.over);
    if (!target) return;
    setLaneTasks((lanes) => moveTask(lanes, String(event.active.id), target));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    dragStartSnapshot.current = null;
    const target = resolveDropTarget(event.over);
    if (!target) return;
    setLaneTasks((lanes) => moveTask(lanes, String(event.active.id), target));
  };

  const handleDragCancel = () => {
    if (dragStartSnapshot.current) {
      setLaneTasks(dragStartSnapshot.current);
      dragStartSnapshot.current = null;
    }

    setActiveTaskId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" dir="rtl">
      <DndContext
        collisionDetection={detectCollisions}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        sensors={sensors}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={(event) => {
          dragStartSnapshot.current = laneTasks;
          setActiveTaskId(String(event.active.id));
        }}
      >
        <div className="flex min-h-0 flex-1 items-start gap-10 overflow-x-auto p-app-lg">
          {KANBAN_LANES.map((lane) => (
            <KanbanLane
              key={lane.id}
              activeTaskId={activeTaskId}
              lane={lane}
              tasks={laneTasks[lane.id] ?? []}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: 'ease' }}>
          {activeTask && (
            <motion.div
              animate={{ scale: 1.03 }}
              initial={{ scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <TaskCardContent isOverlay task={activeTask} />
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
