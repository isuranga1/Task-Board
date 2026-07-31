import { useState, useRef } from "react";
import { X, Plus, Trash2, Paperclip, Upload, Link as LinkIcon } from "lucide-react";
import type { Task, TaskUpdatePayload, Link, Subsection, TaskPriority } from "../../types";
import { DatePicker } from "../shared/DatePicker";
import { LinkRow } from "./LinkRow";
import { EmbedPreview } from "./EmbedPreview";
import { extractUrls } from "../../utils/extractUrls";
import { BASE_URL } from "../../api/client";

interface TaskDetailModalProps {
  task: Task;
  subsections: Subsection[]; // subsections of the task's own section, for the grouping dropdown
  sectionTasks: Task[]; // every other task in this section, for the dependency picker
  onClose: () => void;
  onSave: (payload: TaskUpdatePayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (filename: string) => Promise<void>;
  onAddDependency: (dependsOnId: number) => Promise<void>;
  onRemoveDependency: (dependsOnId: number) => Promise<void>;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-zinc-700 text-zinc-300",
  medium: "bg-blue-900/50 text-blue-300",
  high: "bg-orange-900/50 text-orange-300",
  urgent: "bg-red-900/50 text-red-300",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDetailModal({
  task,
  subsections,
  sectionTasks,
  onClose,
  onSave,
  onDelete,
  onUploadAttachment,
  onDeleteAttachment,
  onAddDependency,
  onRemoveDependency,
}: TaskDetailModalProps) {
  // Local editable copy — nothing is sent to the API until "Save changes"
  // is clicked. This avoids firing a PATCH request on every keystroke.
  // Attachments and dependencies are the exception: those mutate immediately
  // (see the handlers below) since they're their own API calls, not part of
  // this task's field set.
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [remindAt, setRemindAt] = useState(task.remind_at ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [ticketCode, setTicketCode] = useState(task.ticket_code ?? "");
  const [subsectionId, setSubsectionId] = useState<number | null>(task.subsection_id);
  const [links, setLinks] = useState<Link[]>(task.task_metadata.links ?? []);
  const [tagsInput, setTagsInput] = useState((task.task_metadata.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depPickerId, setDepPickerId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const descriptionUrls = extractUrls(description).filter(
    (url) => !links.some((l) => l.url === url) // don't double-show a URL that's also an explicit link
  );

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

      // Drop any link rows the person left half-empty rather than saving junk.
      const cleanLinks = links.filter((l) => l.label.trim() && l.url.trim());

      await onSave({
        title,
        description: description.trim() === "" ? null : description,
        due_date: dueDate === "" ? null : dueDate,
        remind_at: remindAt === "" ? null : remindAt,
        priority,
        ticket_code: ticketCode.trim() === "" ? null : ticketCode,
        subsection_id: subsectionId,
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
    if (!confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
      setDeleting(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await onUploadAttachment(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Candidates for "depends on": every other task in the section, minus
  // whatever it already depends on (no point offering a duplicate).
  const dependencyCandidates = sectionTasks.filter(
    (t) => t.id !== task.id && !task.depends_on.some((d) => d.id === t.id)
  );

  return (
    // Backdrop — clicking outside the modal card closes it, clicking inside
    // the card itself must NOT close it, hence stopPropagation on the inner div.
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
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
            <DatePicker value={dueDate} onChange={setDueDate} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`w-full rounded px-2 py-1.5 text-sm outline-none border border-[var(--color-border)] focus:border-blue-500 ${PRIORITY_STYLES[priority]}`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Ticket code</label>
            <input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              placeholder="tai-0001945-dz"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Group (subsection)</label>
            <select
              value={subsectionId ?? ""}
              onChange={(e) =>
                setSubsectionId(e.target.value === "" ? null : Number(e.target.value))
              }
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="">Ungrouped</option>
              {subsections.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-2">
          <label className="text-xs text-zinc-500 block mb-1">
            Email reminder <span className="text-zinc-700">— sends once, on this date</span>
          </label>
          <DatePicker value={remindAt} onChange={setRemindAt} />
          {task.remind_at && task.reminder_sent && (
            <p className="text-[10px] text-emerald-500 mt-1">✓ Already sent for this date</p>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Optional notes about this task... paste a link and it'll show a preview below"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 resize-none"
          />
          {/* Links found directly IN the description text, Notion-style —
              separate from the explicit "Links" list below. */}
          {descriptionUrls.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {descriptionUrls.map((url) => (
                <EmbedPreview key={url} url={url} />
              ))}
            </div>
          )}
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
            <label className="text-xs text-zinc-500">
              Links <span className="text-zinc-700">— click the arrow to preview</span>
            </label>
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
          <div className="space-y-2">
            {links.map((link, i) => (
              <LinkRow
                key={i}
                link={link}
                onChangeLabel={(v) => updateLink(i, "label", v)}
                onChangeUrl={(v) => updateLink(i, "url", v)}
                onRemove={() => removeLink(i)}
              />
            ))}
          </div>
        </div>

        {/* ---------- Attachments ---------- */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-zinc-500">Attachments (PDFs, images, etc.)</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              <Upload size={12} /> {uploading ? "Uploading…" : "Upload file"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelected}
              className="hidden"
            />
          </div>
          {task.task_metadata.attachments.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No files attached.</p>
          ) : (
            <div className="space-y-1.5">
              {task.task_metadata.attachments.map((att) => (
                <div
                  key={att.filename}
                  className="flex items-center gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5"
                >
                  <Paperclip size={13} className="text-zinc-500 shrink-0" />
                  <a
                    href={`${BASE_URL}${att.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 truncate flex-1"
                  >
                    {att.filename.replace(/^[0-9a-f]{32}_/, "")}
                  </a>
                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {formatBytes(att.size)}
                  </span>
                  <button
                    onClick={() => onDeleteAttachment(att.filename)}
                    className="text-zinc-600 hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Dependencies ---------- */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 block mb-1">
            Depends on <span className="text-zinc-700">— must finish before this task can</span>
          </label>
          {task.depends_on.length === 0 ? (
            <p className="text-xs text-zinc-600 italic mb-2">No dependencies.</p>
          ) : (
            <div className="space-y-1.5 mb-2">
              {task.depends_on.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5"
                >
                  <LinkIcon size={12} className="text-zinc-500 shrink-0" />
                  <span
                    className={`text-xs flex-1 ${dep.status === "done" ? "text-emerald-400" : "text-zinc-300"}`}
                  >
                    {dep.title}
                  </span>
                  <span className="text-[10px] text-zinc-600">{dep.status}</span>
                  <button
                    onClick={() => onRemoveDependency(dep.id)}
                    className="text-zinc-600 hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {dependencyCandidates.length > 0 && (
            <div className="flex gap-2">
              <select
                value={depPickerId}
                onChange={(e) => setDepPickerId(e.target.value)}
                className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="">Add a dependency…</option>
                {dependencyCandidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!depPickerId) return;
                  await onAddDependency(Number(depPickerId));
                  setDepPickerId("");
                }}
                disabled={!depPickerId}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-30 shrink-0"
              >
                Add
              </button>
            </div>
          )}
          {task.blocks.length > 0 && (
            <p className="text-[10px] text-zinc-600 mt-2">
              Blocking: {task.blocks.map((b) => b.title).join(", ")}
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex justify-between items-center gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete task"}
          </button>
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
