import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Task, TaskStatus } from "../../types";
import { Column } from "./Column";

interface BoardProps {
  tasks: Task[];
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onOpenTask: (task: Task) => void;
}

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "Todo" },
  { status: "in_progress", title: "In Progress" },
  { status: "done", title: "Done" },
];

export function Board({ tasks, onStatusChange, onToggleSubtask, onOpenTask }: BoardProps) {
  // Without this, dnd-kit starts a "drag" the instant the mouse moves even
  // 1px — which means a plain click to open the task modal would sometimes
  // get swallowed as an accidental drag. Requiring 8px of movement before a
  // drag is considered "started" means a stationary click always reaches
  // TaskCard's onClick instead.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fires when a drag gesture ends over a valid drop target. `active` is the
  // card being dragged, `over` is the column it was dropped on — we only
  // need their ids to know what moved where.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return; // dropped outside any column — no-op

    const taskId = Number(active.id);
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            title={col.title}
            tasks={tasks.filter((t) => t.status === col.status)}
            onToggleSubtask={onToggleSubtask}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </DndContext>
  );
}
