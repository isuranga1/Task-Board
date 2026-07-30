import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { Task, TaskUpdatePayload, Link } from "../../types";

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onSave: (payload: TaskUpdatePayload) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
}

// Helper to convert standard youtube links to embeddable iframes
function getEmbedUrl(url: string) {
  if (url.includes("youtube.com/watch?v=")) return url.replace("watch?v=", "embed/");
  if (url.includes("youtu.be/")) return url.replace("youtu.be/", "www.youtube.com/embed/");
  return null;
}

export function TaskDetailModal({ task, onClose, onSave, onDelete }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [ticketCode, setTicketCode] = useState(task.ticket_code ?? "");
  const [links, setLinks] = useState<Link[]>(task.task_metadata.links ?? []);
  const [tagsInput, setTagsInput] = useState((task.task_metadata.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLink(index: number, field: keyof Link, value: string) {
    setLinks((current) =>
      current.map((link, i) => (i === index ? { ...link, [field]: value } : link))
    );
  }

  function addLink() {
    setLinks((current) => [...current, { label: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const cleanLinks = links.filter((l) => l.label.trim() && l.url.trim());

      await onSave({
        title,
        description: description.trim() === "" ? null : description,
        due_date: dueDate === "" ? null : dueDate,
        ticket_code: ticketCode.trim() === "" ? null : ticketCode,
        task_metadata: { ...task.task_metadata, links: cleanLinks, tags },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 flex flex-col"
      >
        <div className="flex justify-between items-start mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg font-semibold text-white outline-none w-full mr-4 border-b border-transparent focus:border-[var(--color-border)]"
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Due date</label>
            {/* The type="date" natively provides a calendar widget on click */}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Ticket code</label>
            <input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              placeholder="tai-0001945-dz"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Optional notes about this task..."
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 block mb-1">Tags (comma separated)</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Evaluations, Urgent"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-zinc-500">Links & Media</label>
            <button
              onClick={addLink}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <Plus size={12} /> Add link
            </button>
          </div>
          {links.length === 0 && (
            <p className="text-xs text-zinc-600 italic">No links yet.</p>
          )}
          <div className="space-y-4">
            {links.map((link, i) => {
              const embedUrl = getEmbedUrl(link.url);
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <input
                      value={link.label}
                      onChange={(e) => updateLink(i, "label", e.target.value)}
                      placeholder="Label (e.g. PR)"
                      className="w-24 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <input
                      value={link.url}
                      onChange={(e) => updateLink(i, "url", e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => removeLink(i)}
                      className="text-zinc-600 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Notion-style expandable embed view */}
                  {embedUrl && (
                    <details className="w-full border border-[var(--color-border)] rounded-md overflow-hidden bg-black/50">
                      <summary className="text-xs text-zinc-400 cursor-pointer p-2 hover:text-white transition-colors select-none">
                        Show embedded video
                      </summary>
                      <iframe 
                        className="w-full aspect-video border-t border-[var(--color-border)]" 
                        src={embedUrl} 
                        allowFullScreen 
                      />
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex justify-between items-center pt-4 mt-auto border-t border-[var(--color-border)]">
          {onDelete ? (
             <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete Task"}
            </button>
          ) : <div />}
         
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}