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
      className={`flex-1 min-w-[280px] rounded-2xl p-4 glass transition-colors
        ${isOver ? "bg-white/10" : ""}`}
    >
      <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
        {title}{" "}
        <span className="text-zinc-500 font-normal text-xs bg-white/5 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </h2>

      {tasks.length === 0 ? (
        <p className="text-zinc-500 text-sm italic">Nothing here yet.</p>
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
