import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X, Pencil } from "lucide-react";
import type { Section } from "../../types";

interface SectionTabsProps {
  sections: Section[];
  activeSectionId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (sections: Section[]) => void;
}

// Turns "Job Opportunities" into "job-opportunities" — a URL/DB-friendly
// slug generated from what the person actually types, so they never have
// to think about slugs at all.
function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SortableTab({
  section,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  section: Section;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.name);

  // Dragging has to be off while renaming, otherwise the pointer sensor
  // swallows the clicks/selection you make inside the text input.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function startEditing(e: React.SyntheticEvent) {
    e.stopPropagation(); // don't also select the tab
    setDraft(section.name);
    setEditing(true);
  }

  // Called on both submit (Enter) and blur (clicking away) — committing on
  // blur means you never lose a rename just because you clicked elsewhere.
  async function commit(e: React.SyntheticEvent) {
    e.preventDefault();
    const next = draft.trim();
    setEditing(false);
    // Nothing typed, or nothing actually changed — leave the section alone.
    if (!next || next === section.name) {
      setDraft(section.name);
      return;
    }
    await onRename(next);
  }

  if (editing) {
    return (
      <form
        ref={setNodeRef}
        style={style}
        onSubmit={commit}
        className="flex items-center"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(section.name); // discard, and let the blur no-op
              setEditing(false);
            }
          }}
          onFocus={(e) => e.target.select()}
          className="glass rounded-full px-4 py-2 text-sm font-medium text-white outline-none focus:border-white/30 w-36"
        />
      </form>
    );
  }

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onDoubleClick={startEditing}
      // touch-manipulation rather than touch-none: `none` would stop the page
      // scrolling whenever a swipe happened to begin on a tab. The delay-based
      // TouchSensor already suppresses scrolling once a drag actually starts,
      // and this still drops the 300ms double-tap-to-zoom delay on the tap.
      className={`group flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-grab active:cursor-grabbing touch-manipulation
        ${isDragging ? "opacity-40" : ""}
        ${isActive ? "glass text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
      style={
        isActive && section.color
          ? { boxShadow: `0 0 0 1.5px ${section.color}55 inset`, ...style }
          : style
      }
    >
      {section.color && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: section.color }} />
      )}
      {section.name}
      {/* Only visible on hover — keeps the tab bar uncluttered until you
          actually mean to rename or delete something. Double-clicking the
          tab renames too; this icon is just the discoverable version of it.
          On a touchscreen there is no hover and no double-click either, so
          .hover-reveal pins both icons open there (see index.css) — they're
          the only way to rename or delete a space from a phone. */}
      <span
        role="button"
        onClick={startEditing}
        title="Rename space"
        className="hover-reveal -m-1 p-1 text-zinc-500 hover:text-indigo-300"
      >
        <Pencil size={12} />
      </span>
      <span
        role="button"
        onClick={onDelete}
        title="Delete space"
        className="hover-reveal -m-1 p-1 text-zinc-500 hover:text-red-300"
      >
        <X size={13} />
      </span>
    </button>
  );
}

export function SectionTabs({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: SectionTabsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Same split as the board's sensors: a mouse drags on movement, a finger has
  // to hold first — otherwise swiping across the tab strip to reach a space
  // that's scrolled off-screen would reorder it instead of scrolling to it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(newName.trim());
      setNewName("");
      setIsAdding(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, section: Section) {
    e.stopPropagation(); // don't also trigger onSelect on the parent button
    if (!confirm(`Delete section "${section.name}" and everything in it? This can't be undone.`)) {
      return;
    }
    await onDelete(section.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          {sections.map((section) => (
            <SortableTab
              key={section.id}
              section={section}
              isActive={section.id === activeSectionId}
              onSelect={() => onSelect(section.id)}
              onRename={(name) => onRename(section.id, name)}
              onDelete={(e) => handleDelete(e, section)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {isAdding ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => !newName && setIsAdding(false)}
            placeholder="Space name"
            className="glass rounded-full px-3 py-1.5 text-sm text-white outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={submitting}
            className="text-xs text-indigo-300 hover:text-indigo-200 font-medium disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Plus size={14} /> New space
        </button>
      )}
    </div>
  );
}

export { slugify };
