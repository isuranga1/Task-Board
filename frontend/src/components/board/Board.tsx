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
    // On a phone the three columns stack and you scroll down through them.
    // The obvious alternative — a horizontal carousel — reads well but drags
    // badly: a sideways swipe is ambiguous between "scroll the board" and
    // "move this card", and dnd-kit's auto-scroll can't drive a snap-scroll
    // container the way it drives the window. Stacked, a drag is one vertical
    // gesture and the page scrolls itself as you approach the edge.
    // From sm there's room for all three side by side, as before.
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:gap-4 sm:overflow-x-auto">
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
