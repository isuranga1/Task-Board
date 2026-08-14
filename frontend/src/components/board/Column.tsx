import { useDroppable } from "@dnd-kit/core";
import type { Task } from "../../types";
import { TaskCard } from "./TaskCard";
import { columnMotionClass, countMotionClass, staggerIndex, useBumpKey } from "../../animations";

interface ColumnProps {
  dropId: string;
  title: string;
  tasks: Task[];
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onOpenTask: (task: Task) => void;
  /** Position across the board — only used to stagger the entrance. */
  index?: number;
}

export function Column({
  dropId,
  title,
  tasks,
  onToggleSubtask,
  onOpenTask,
  index = 0,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data: { type: "column" } });

  // Changing the key remounts the chip, which is what replays its animation.
  const countKey = useBumpKey(tasks.length);

  return (
    <div
      ref={setNodeRef}
      style={staggerIndex(index)}
      className={`snap-col w-[85vw] max-w-[20rem] shrink-0 rounded-2xl p-3.5 glass transition-colors
        sm:w-auto sm:max-w-none sm:min-w-[280px] sm:flex-1 sm:p-4
        ${columnMotionClass(isOver)}
        ${isOver ? "bg-white/10" : ""}`}
    >
      <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
        {title}{" "}
        <span className="text-zinc-500 font-normal text-xs bg-white/5 rounded-full px-2 py-0.5">
          <span key={countKey} className={countMotionClass()}>
            {tasks.length}
          </span>
        </span>
      </h2>

      {tasks.length === 0 ? (
        <p className="text-zinc-500 text-sm italic">Nothing here yet.</p>
      ) : (
        tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            task={task}
            index={i}
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
