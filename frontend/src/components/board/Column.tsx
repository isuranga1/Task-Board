import { useDroppable } from "@dnd-kit/core";
import type { Task, TaskStatus } from "../../types";
import { TaskCard } from "./TaskCard";

interface ColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onOpenTask: (task: Task) => void;
}

export function Column({ status, title, tasks, onToggleSubtask, onOpenTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] rounded-xl p-4 transition-colors
        ${isOver ? "bg-[var(--color-surface-hover)]" : "bg-[#111114]"}`}
    >
      <h2 className="text-white font-semibold mb-4">
        {title} <span className="text-zinc-500 font-normal">({tasks.length})</span>
      </h2>

      {tasks.length === 0 ? (
        <p className="text-zinc-600 text-sm italic">Nothing here yet.</p>
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggleSubtask={(subtaskId, isDone) =>
              onToggleSubtask(task.id, subtaskId, isDone)
            }
            onOpen={onOpenTask}
          />
        ))
      )}
    </div>
  );
}
