import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Task, TaskStatus, Subsection } from "../../types";
import { Column } from "./Column";

interface BoardProps {
  tasks: Task[];
  subsections?: Subsection[];
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onOpenTask: (task: Task) => void;
}

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "Todo" },
  { status: "in_progress", title: "In Progress" },
  { status: "done", title: "Done" },
];

export function Board({ tasks, subsections = [], onStatusChange, onToggleSubtask, onOpenTask }: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus);
    }
  }

  // Group tasks by subsection. If no subsections exist, place them in a default "Ungrouped" array.
  const groupedTasks = subsections.length > 0 
    ? subsections.map(sub => ({
        ...sub,
        tasks: tasks.filter(t => t.subsection_id === sub.id)
      })) 
    : [{ id: null, name: "Tasks", tasks }];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-8 pb-4">
        {groupedTasks.map((group) => (
          <div key={group.id ?? 'ungrouped'} className="flex flex-col gap-4">
            {subsections.length > 0 && (
              <h3 className="text-lg font-bold text-zinc-100 border-b border-[var(--color-border)] pb-2">
                {group.name}
              </h3>
            )}
            <div className="flex gap-4 overflow-x-auto">
              {COLUMNS.map((col) => (
                <Column
                  key={`${group.id}-${col.status}`}
                  status={col.status}
                  title={col.title}
                  tasks={group.tasks.filter((t) => t.status === col.status)}
                  onToggleSubtask={onToggleSubtask}
                  onOpenTask={onOpenTask}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  );
}