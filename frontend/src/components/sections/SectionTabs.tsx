import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Section } from "../../types";

interface SectionTabsProps {
  sections: Section[];
  activeSectionId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
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

export function SectionTabs({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  onDelete,
}: SectionTabsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] mb-6 pb-2">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSelect(section.id)}
          className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
            ${
              section.id === activeSectionId
                ? "bg-[var(--color-surface)] text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          style={
            section.id === activeSectionId && section.color
              ? { borderBottom: `2px solid ${section.color}` }
              : undefined
          }
        >
          {section.name}
          {/* Only visible on hover — keeps the tab bar uncluttered until you
              actually mean to delete something. */}
          <span
            role="button"
            onClick={(e) => handleDelete(e, section)}
            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
          >
            <X size={12} />
          </span>
        </button>
      ))}

      {isAdding ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => !newName && setIsAdding(false)}
            placeholder="Section name"
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="text-xs text-blue-400 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <Plus size={14} /> Section
        </button>
      )}
    </div>
  );
}

export { slugify };
