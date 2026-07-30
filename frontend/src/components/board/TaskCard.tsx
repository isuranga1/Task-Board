import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, differenceInCalendarDays } from "date-fns";
import { Link2, FileText, Puzzle } from "lucide-react";
import type { Task } from "../../types";

interface TaskCardProps {
  task: Task;
  onToggleSubtask: (subtaskId: number, isDone: boolean) => void;
  onOpen: (task: Task) => void;
}

// Column accent colors — echoes the colored left-border treatment from the
// screenshot (purple todo card, red overdue "in progress" card).
const STATUS_ACCENT: Record<Task["status"], string> = {
  todo: "border-l-[var(--color-accent-todo)]",
  in_progress: "border-l-[var(--color-accent-progress)]",
  done: "border-l-[var(--color-accent-done)]",
};

function DueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const days = differenceInCalendarDays(new Date(dueDate), new Date());

  if (days < 0) {
    return (
      <span className="text-red-400 text-xs font-medium">
        Late by {Math.abs(days)}d
      </span>
    );
  }
  return (
    <span className="text-emerald-400 text-xs font-medium">
      {days === 0 ? "Due today" : `${days}d left`}
    </span>
  );
}

export function TaskCard({ task, onToggleSubtask, onOpen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const doneCount = task.subtasks.filter((s) => s.is_done).length;
  const links = task.task_metadata?.links ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] border-l-4 ${STATUS_ACCENT[task.status]}
        rounded-lg p-3 mb-3 cursor-grab active:cursor-grabbing
        hover:bg-[var(--color-surface-hover)] transition-colors`}
    >
      <div className="flex justify-between items-start gap-2">
        <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
          {task.title}
        </h3>
        {task.ticket_code && (
          <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">
            {task.ticket_code}
          </span>
        )}
      </div>

      {task.task_metadata?.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {task.task_metadata.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2 text-zinc-400">
        {task.due_date && (
          <span className="text-xs">{format(new Date(task.due_date), "MMM d")}</span>
        )}
        {links.length > 0 && <Link2 size={13} className="text-blue-400" />}
        {task.description && <FileText size={13} className="text-emerald-400" />}
        {task.subtasks.length > 0 && <Puzzle size={13} className="text-zinc-500" />}
        <div className="ml-auto">
          <DueBadge dueDate={task.due_date} />
        </div>
      </div>

      {task.subtasks.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-2">
          <p className="text-xs text-zinc-500 mb-1">
            Subtasks: {doneCount}/{task.subtasks.length}
          </p>
          <ul className="space-y-1">
            {task.subtasks.map((subtask) => (
              <li key={subtask.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={subtask.is_done}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSubtask(subtask.id, e.target.checked);
                  }}
                  onPointerDown={(e) => e.stopPropagation()} // don't start a drag when clicking the checkbox
                  className="accent-emerald-500"
                />
                <span
                  className={
                    subtask.is_done ? "line-through text-zinc-600" : "text-zinc-300"
                  }
                >
                  {subtask.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
