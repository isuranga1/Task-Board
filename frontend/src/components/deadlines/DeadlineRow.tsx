import { format, parseISO } from "date-fns";
import { Lock, Paperclip, Link2, FileText } from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "../../types";
import { staggerIndex } from "../../animations";
import { dueState } from "../../utils/deadlines";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-zinc-500",
  medium: "bg-sky-400",
  high: "bg-orange-400",
  urgent: "bg-rose-400",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "Doing",
  done: "Done",
};

const STATUS_CHIP: Record<TaskStatus, string> = {
  todo: "bg-white/5 text-zinc-400",
  in_progress: "bg-orange-400/10 text-orange-300",
  done: "bg-emerald-400/10 text-emerald-300",
};

/** "3d late" / "Due today" / "in 5d" — the relative bit that makes a list scannable. */
function relativeDue(task: Task): { text: string; className: string } | null {
  const state = dueState(task);
  if (!state) return null;

  switch (state.kind) {
    case "late":
      return { text: `${state.days}d late`, className: "text-rose-300" };
    // Finished work is history, not an alarm — stated once, in a colour that
    // doesn't shout, and never growing again.
    case "finished_late":
      return { text: `${state.days}d late`, className: "text-rose-300/60" };
    case "finished_on_time":
      return { text: "On time", className: "text-emerald-300/60" };
    case "finished_unknown":
      return { text: "Done", className: "text-zinc-500" };
    case "upcoming":
      if (state.days === 0) return { text: "Due today", className: "text-amber-300" };
      if (state.days === 1) return { text: "Tomorrow", className: "text-emerald-300" };
      return { text: `in ${state.days}d`, className: "text-zinc-500" };
  }
}

interface DeadlineRowProps {
  task: Task;
  sectionName: string;
  sectionColor: string;
  subsectionName?: string;
  onOpen: (task: Task) => void;
  index?: number;
}

export function DeadlineRow({
  task,
  sectionName,
  sectionColor,
  subsectionName,
  onOpen,
  index = 0,
}: DeadlineRowProps) {
  const isBlocked = task.depends_on.some((d) => d.status !== "done");
  const doneSubtasks = task.subtasks.filter((s) => s.is_done).length;
  const due = relativeDue(task);
  const isDone = task.status === "done";

  return (
    <button
      onClick={() => onOpen(task)}
      // borderLeftColor is inline because it comes from per-section data — not a
      // fixed palette Tailwind could generate a class for ahead of time.
      style={{ ...staggerIndex(index), borderLeftColor: sectionColor }}
      className={`glass glass-hover motion-enter motion-stagger flex w-full items-center gap-3
        rounded-xl border-l-[3px] px-3.5 py-2.5 text-left ${isDone ? "opacity-55" : ""}`}
    >
      <span
        aria-hidden
        title={`Priority: ${task.priority}`}
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3
            className={`truncate text-sm font-medium ${
              isDone ? "text-zinc-500 line-through" : "text-zinc-100"
            }`}
          >
            {task.title}
          </h3>
          {isBlocked && (
            <span title="Waiting on something else to finish first" className="shrink-0">
              <Lock size={11} className="text-rose-300" />
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="flex shrink-0 items-center gap-1">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: sectionColor }}
            />
            {sectionName}
          </span>
          {subsectionName && <span className="truncate">· {subsectionName}</span>}
          {task.subtasks.length > 0 && (
            <span className="shrink-0">
              · {doneSubtasks}/{task.subtasks.length}
            </span>
          )}
          {task.description && <FileText size={10} className="shrink-0 text-emerald-300/60" />}
          {(task.task_metadata?.links?.length ?? 0) > 0 && (
            <Link2 size={10} className="shrink-0 text-sky-300/60" />
          )}
          {(task.task_metadata?.attachments?.length ?? 0) > 0 && (
            <Paperclip size={10} className="shrink-0 text-zinc-600" />
          )}
        </div>
      </div>

      <span
        className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:inline ${
          STATUS_CHIP[task.status]
        }`}
      >
        {STATUS_LABEL[task.status]}
      </span>

      <div className="shrink-0 text-right">
        {task.due_date ? (
          <>
            <div className="text-xs text-zinc-300">
              {format(parseISO(task.due_date), "MMM d")}
            </div>
            <div className={`text-[11px] ${due!.className}`}>{due!.text}</div>
          </>
        ) : (
          <span className="text-[11px] text-zinc-600">No date</span>
        )}
      </div>
    </button>
  );
}
