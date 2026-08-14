import type { Task, TaskStatus } from "../../types";
import { Column } from "./Column";

interface BoardProps {
  subsectionId: number | null;
  tasks: Task[];
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onOpenTask: (task: Task) => void;
}

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To Do" },
  { status: "in_progress", title: "Doing" },
  { status: "done", title: "Done" },
];

// Drag-and-drop for tasks lives one level up now (see SectionBoard), since a
// task needs to be draggable not just between these three columns but into
// a completely different group's columns too — that only works if every
// group's columns share one DndContext instead of each Board owning its own.
export function Board({ subsectionId, tasks, onToggleSubtask, onOpenTask }: BoardProps) {
  const subsectionKey = subsectionId === null ? "none" : String(subsectionId);

  return (
    // On a phone all three columns can't share the width, so this becomes a
    // snap carousel: one column fills the screen, the next peeks in at the
    // edge to advertise that it's there. From sm the snapping switches off
    // (see .snap-row in index.css) and it's an ordinary three-up row again.
    <div className="snap-row flex gap-3 overflow-x-auto pb-4 sm:gap-4">
      {COLUMNS.map((col, i) => (
        <Column
          key={col.status}
          index={i}
          dropId={`${subsectionKey}::${col.status}`}
          title={col.title}
          tasks={tasks.filter((t) => t.status === col.status)}
          onToggleSubtask={onToggleSubtask}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}
