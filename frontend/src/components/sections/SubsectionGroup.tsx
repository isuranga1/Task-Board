import { useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import type { Subsection, Task, TaskStatus } from "../../types";
import { Board } from "../board/Board";

interface SubsectionGroupProps {
  subsection: Subsection | null; // null = the "ungrouped" bucket
  tasks: Task[];
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onAddTask: (title: string) => void;
  onOpenTask: (task: Task) => void;
}

export function SubsectionGroup({
  subsection,
  tasks,
  onStatusChange,
  onToggleSubtask,
  onAddTask,
  onOpenTask,
}: SubsectionGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask(title.trim());
    setTitle("");
    setIsAdding(false);
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <h3 className="text-zinc-300 font-semibold text-sm uppercase tracking-wide">
          {subsection?.name ?? "Ungrouped"}
        </h3>
        <span className="text-zinc-600 text-xs">{tasks.length}</span>

        {isAdding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2 ml-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title && setIsAdding(false)}
              placeholder="Task title"
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
            />
            <button type="submit" className="text-xs text-blue-400">
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 ml-2"
          >
            <Plus size={12} /> Task
          </button>
        )}
      </div>

      {!collapsed && (
        <Board
          tasks={tasks}
          onStatusChange={onStatusChange}
          onToggleSubtask={onToggleSubtask}
          onOpenTask={onOpenTask}
        />
      )}
    </div>
  );
}
