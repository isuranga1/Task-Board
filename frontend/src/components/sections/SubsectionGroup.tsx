import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, X } from "lucide-react";
import type { Subsection, Task, TaskStatus } from "../../types";
import { Board } from "../board/Board";

interface SubsectionGroupProps {
  subsection: Subsection | null; // null = the "ungrouped" bucket
  tasks: Task[];
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onAddTask: (title: string) => void;
  onOpenTask: (task: Task) => void;
  onDeleteGroup: (subsectionId: number) => void;
}

export function SubsectionGroup({
  subsection,
  tasks,
  onStatusChange,
  onToggleSubtask,
  onAddTask,
  onOpenTask,
  onDeleteGroup,
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

  function handleDeleteGroup() {
    if (!subsection) return;
    const taskCount = tasks.length;
    const message =
      taskCount > 0
        ? `Delete group "${subsection.name}"? Its ${taskCount} task${taskCount === 1 ? "" : "s"} will become ungrouped, not deleted.`
        : `Delete group "${subsection.name}"?`;
    if (!confirm(message)) return;
    onDeleteGroup(subsection.id);
  }

  return (
    <div className="mb-8">
      <div className="group flex items-center gap-2 mb-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <h3 className="text-zinc-200 font-semibold text-sm tracking-wide">
          {subsection?.name ?? "General"}
        </h3>
        <span className="text-zinc-500 text-xs bg-white/5 rounded-full px-1.5 py-0.5">
          {tasks.length}
        </span>

        {isAdding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2 ml-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title && setIsAdding(false)}
              placeholder="Task title"
              className="glass rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-white/30"
            />
            <button type="submit" className="text-xs text-indigo-300 hover:text-indigo-200 font-medium">
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 ml-2 transition-colors"
          >
            <Plus size={12} /> Task
          </button>
        )}

        {/* The "General" bucket isn't a real subsection, so it can't be
            deleted — only show this for actual named groups. Hidden until
            hover so the header doesn't look cluttered by default. */}
        {subsection && (
          <button
            onClick={handleDeleteGroup}
            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity ml-auto"
            title="Delete group"
          >
            <X size={14} />
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
