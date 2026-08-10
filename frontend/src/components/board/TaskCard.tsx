import { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { Link2, FileText, Puzzle, Paperclip, Lock, Clock } from "lucide-react";
import type { Task, TaskPriority } from "../../types";
import {
  cardMotionClass,
  staggerIndex,
  strikeMotionClass,
  useCardMotion,
} from "../../animations";
import { dueState } from "../../utils/deadlines";

interface TaskCardProps {
  task: Task;
  onToggleSubtask: (subtaskId: number, isDone: boolean) => void;
  onOpen: (task: Task) => void;
  /** Position in its column — only used to stagger the entrance. */
  index?: number;
}

// Column accent colors — a soft glow on the left edge instead of a hard line.
const STATUS_ACCENT: Record<Task["status"], string> = {
  todo: "border-l-[var(--color-accent-todo)]",
  in_progress: "border-l-[var(--color-accent-progress)]",
  done: "border-l-[var(--color-accent-done)]",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-zinc-500",
  medium: "bg-sky-400",
  high: "bg-orange-400",
  urgent: "bg-rose-400",
};

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Ticks itself every 30s while a task sits in "Doing" so the elapsed time
// stays live without anyone having to open the card.
function ElapsedTime({ since }: { since: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="mt-2 flex items-center gap-1 text-xs text-indigo-300"
      title="Time spent in Doing"
    >
      <Clock size={11} />
      {formatDuration(Date.now() - new Date(since).getTime())}
    </div>
  );
}

// Only renders once a task has actually been through "Doing" — a task
// dragged straight from To Do to Done was never timed, so it stays silent
// rather than showing a misleading 0m.
function TimeBadge({ task }: { task: Task }) {
  if (task.status === "in_progress" && task.started_at) {
    return <ElapsedTime since={task.started_at} />;
  }
  if (task.status === "done" && task.started_at && task.completed_at) {
    const ms = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500" title="Time it took">
        <Clock size={11} />
        {formatDuration(ms)}
      </div>
    );
  }
  return null;
}

function DueBadge({ task }: { task: Task }) {
  const state = dueState(task);
  if (!state) return null;

  switch (state.kind) {
    case "late":
      return (
        <span className="text-rose-300 text-xs font-medium">Late by {state.days}d</span>
      );
    // Once a card is in Done the clock has stopped. Reporting how late it was
    // *finished* keeps the number honest and static; measuring against today
    // meant a card sitting in Done climbed a day every morning forever.
    case "finished_late":
      return (
        <span className="text-rose-300/60 text-xs font-medium">
          Finished {state.days}d late
        </span>
      );
    case "finished_on_time":
      return <span className="text-emerald-300/60 text-xs font-medium">On time</span>;
    case "finished_unknown":
      return null;
    case "upcoming":
      return (
        <span className="text-emerald-300 text-xs font-medium">
          {state.days === 0 ? "Due today" : `${state.days}d left`}
        </span>
      );
  }
}

// The visual content shared by the in-column card and its drag-overlay
// clone — kept as one function so the two never drift out of sync.
function CardBody({
  task,
  onToggleSubtask,
}: {
  task: Task;
  onToggleSubtask?: (subtaskId: number, isDone: boolean) => void;
}) {
  const doneCount = task.subtasks.filter((s) => s.is_done).length;
  const links = task.task_metadata?.links ?? [];
  const attachments = task.task_metadata?.attachments ?? [];
  // "Blocked" means at least one dependency isn't done yet — a visual nudge
  // that this task probably shouldn't be worked on until that clears.
  const isBlocked = task.depends_on.some((d) => d.status !== "done");

  return (
    <>
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            title={`Priority: ${task.priority}`}
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`}
          />
          <h3 className="text-sm font-semibold text-zinc-100 leading-snug truncate">
            {task.title}
          </h3>
          {isBlocked && (
            <span title="Waiting on something else to finish first" className="shrink-0">
              <Lock size={11} className="text-rose-300" />
            </span>
          )}
        </div>
      </div>

      {task.task_metadata?.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {task.task_metadata.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
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
        {links.length > 0 && <Link2 size={13} className="text-sky-300" />}
        {task.description && <FileText size={13} className="text-emerald-300" />}
        {task.subtasks.length > 0 && <Puzzle size={13} className="text-zinc-500" />}
        {attachments.length > 0 && <Paperclip size={13} className="text-zinc-500" />}
        <div className="ml-auto">
          <DueBadge task={task} />
        </div>
      </div>

      {task.subtasks.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-2">
          <p className="text-xs text-zinc-500 mb-1">
            {doneCount}/{task.subtasks.length} done
          </p>
          <ul className="space-y-1">
            {task.subtasks.map((subtask) => (
              <li key={subtask.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={subtask.is_done}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSubtask?.(subtask.id, e.target.checked);
                  }}
                  onPointerDown={(e) => e.stopPropagation()} // don't start a drag when clicking the checkbox
                  className="accent-emerald-500"
                />
                <span
                  className={`${strikeMotionClass(subtask.is_done)} ${
                    subtask.is_done ? "text-zinc-600" : "text-zinc-300"
                  }`}
                >
                  {subtask.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TimeBadge task={task} />
    </>
  );
}

export function TaskCard({ task, onToggleSubtask, onOpen, index = 0 }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task" as const, status: task.status },
  });

  // Moving a card between columns remounts it, so this is where the board finds
  // out a task changed status — see animations/hooks.ts.
  const motion = useCardMotion(task.id, task.status);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
      style={staggerIndex(index)}
      className={`glass glass-hover border-l-[3px] ${STATUS_ACCENT[task.status]}
        rounded-2xl p-3.5 mb-3 cursor-grab active:cursor-grabbing
        ${cardMotionClass(motion, task.status)}
        ${isDragging ? "opacity-30" : ""}`}
    >
      <CardBody task={task} onToggleSubtask={onToggleSubtask} />
    </div>
  );
}

// Rendered inside dnd-kit's <DragOverlay>, which portals to the document
// root — this is what actually floats above every column while dragging.
// The in-place card above just dims to a ghost (isDragging opacity-30) so
// nothing gets clipped by a neighboring column's own glass stacking context.
export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div
      className={`glass border-l-[3px] ${STATUS_ACCENT[task.status]}
        rounded-2xl p-3.5 cursor-grabbing shadow-2xl scale-105 rotate-1`}
    >
      <CardBody task={task} />
    </div>
  );
}
