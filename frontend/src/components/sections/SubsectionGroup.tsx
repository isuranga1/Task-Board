import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, ChevronDown, ChevronRight, X, GripVertical, Pencil } from "lucide-react";
import type { Subsection, Task } from "../../types";
import { Board } from "../board/Board";

interface SubsectionGroupProps {
  subsection: Subsection | null; // null = the "General" bucket
  tasks: Task[];
  onToggleSubtask: (taskId: number, subtaskId: number, isDone: boolean) => void;
  onAddTask: (title: string) => void;
  onOpenTask: (task: Task) => void;
  onRenameGroup: (subsectionId: number, name: string) => void;
  onDeleteGroup: (subsectionId: number) => void;
}

export function SubsectionGroup({
  subsection,
  tasks,
  onToggleSubtask,
  onAddTask,
  onOpenTask,
  onRenameGroup,
  onDeleteGroup,
}: SubsectionGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(subsection?.name ?? "");

  // The "General" bucket isn't a real subsection, so it's always called with
  // `disabled: true` here — the hook still has to be called every render
  // (rules of hooks), it just never activates for that instance.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subsection ? `group:${subsection.id}` : "group:general",
    data: { type: "group" as const, subsectionId: subsection?.id ?? null },
    disabled: subsection === null,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask(title.trim());
    setTitle("");
    setIsAdding(false);
  }

  function startEditingName() {
    if (!subsection) return; // "General" isn't a real group, so nothing to rename
    setNameDraft(subsection.name);
    setEditingName(true);
  }

  // Commits on Enter or on blur, so clicking away saves rather than discards.
  function commitName(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!subsection) return;
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === subsection.name) {
      setNameDraft(subsection.name);
      return;
    }
    onRenameGroup(subsection.id, next);
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
    <div ref={setNodeRef} style={style} className={`mb-8 ${isDragging ? "opacity-40" : ""}`}>
      {/* flex-wrap so a long group name plus the inline "add task" field drop
          onto a second line on a phone instead of squeezing each other out. */}
      <div className="group mb-3 flex flex-wrap items-center gap-2">
        {subsection && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="hover-reveal drag-only -m-1 cursor-grab p-1 text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical size={15} />
          </button>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="-m-1 p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          aria-label={collapsed ? "Expand group" : "Collapse group"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
        </button>
        {editingName ? (
          <form onSubmit={commitName}>
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNameDraft(subsection?.name ?? ""); // discard; the blur then no-ops
                  setEditingName(false);
                }
              }}
              onFocus={(e) => e.target.select()}
              className="glass rounded-lg px-2 py-0.5 text-sm font-semibold text-white outline-none focus:border-white/30 w-48"
            />
          </form>
        ) : (
          <h3
            onDoubleClick={startEditingName}
            className="text-zinc-200 font-semibold text-sm tracking-wide"
          >
            {subsection?.name ?? "General"}
          </h3>
        )}
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
            renamed or deleted — only show these for actual named groups.
            Hidden until hover so the header doesn't look cluttered by
            default. Double-clicking the title renames too. */}
        {subsection && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={startEditingName}
              className="hover-reveal p-1.5 text-zinc-600 hover:text-indigo-300"
              title="Rename group"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDeleteGroup}
              className="hover-reveal p-1.5 text-zinc-600 hover:text-red-400"
              title="Delete group"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <Board
          subsectionId={subsection?.id ?? null}
          tasks={tasks}
          onToggleSubtask={onToggleSubtask}
          onOpenTask={onOpenTask}
        />
      )}
    </div>
  );
}
