import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Section } from "../../types";

interface SectionTabsProps {
  sections: Section[];
  activeSectionId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string) => Promise<void>;
  onDeleteSection?: (id: number) => Promise<void>;
}

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
  onDeleteSection,
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

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] mb-6 pb-2">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSelect(section.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
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
          <span>{section.name}</span>
          
          {/* Show delete button only on the currently active tab */}
          {section.id === activeSectionId && onDeleteSection && (
            <div 
              onClick={(e) => { 
                e.stopPropagation(); 
                if(window.confirm("Are you sure you want to delete this section?")) {
                  onDeleteSection(section.id); 
                }
              }} 
              className="text-zinc-500 hover:text-red-400 transition-colors p-0.5 rounded-sm hover:bg-red-400/10"
              title="Delete Section"
            >
              <Trash2 size={14} />
            </div>
          )}
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