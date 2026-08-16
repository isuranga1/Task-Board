import { useState, useRef } from "react";
import { format } from "date-fns";
import { X, Plus, Trash2, Paperclip, Upload, Link as LinkIcon } from "lucide-react";
import type {
  Task,
  TaskUpdatePayload,
  Link,
  Subsection,
  TaskPriority,
  TaskStatus,
} from "../../types";
import { DatePicker } from "../shared/DatePicker";
import { LinkRow } from "./LinkRow";
import { EmbedPreview } from "./EmbedPreview";
import { SATISFACTION } from "../reflect/satisfaction";
import { extractUrls } from "../../utils/extractUrls";
import { BASE_URL } from "../../api/client";
import { strikeMotionClass } from "../../animations";

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
  onAddSubtask: (title: string) => Promise<void>;
  onToggleSubtask: (subtaskId: number, isDone: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: number) => Promise<void>;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-white/5 text-zinc-300",
  medium: "bg-sky-400/10 text-sky-300",
  high: "bg-orange-400/10 text-orange-300",
  urgent: "bg-rose-400/10 text-rose-300",
};

// Labels match the board's own column headings so the two never disagree
// about what a status is called.
const STATUSES: { value: TaskStatus; label: string; active: string }[] = [
  { value: "todo", label: "To Do", active: "bg-[var(--color-accent-todo)] text-black" },
  { value: "in_progress", label: "Doing", active: "bg-[var(--color-accent-progress)] text-black" },
  { value: "done", label: "Done", active: "bg-[var(--color-accent-done)] text-black" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fieldClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors";
const rowClass =
  "flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2";

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
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
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
  // Dragging a card between columns is the other way to set this, and it's the
  // only way on desktop. It's unusable on a phone though — the columns are a
  // horizontal carousel there, so the drag target is usually off-screen — so
  // status is an editable field too, saved with everything else.
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [ticketCode, setTicketCode] = useState(task.ticket_code ?? "");
  const [subsectionId, setSubsectionId] = useState<number | null>(task.subsection_id);
  const [links, setLinks] = useState<Link[]>(task.task_metadata.links ?? []);
  const [tagsInput, setTagsInput] = useState((task.task_metadata.tags ?? []).join(", "));
  // Normally captured by the prompt that fires on completion, but editable
  // here too — a takeaway often only becomes clear a few days later.
  const [satisfaction, setSatisfaction] = useState<number | null>(task.satisfaction);
  const [reflection, setReflection] = useState(task.reflection ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depPickerId, setDepPickerId] = useState<string>("");
  const [newSubtask, setNewSubtask] = useState("");
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
        status,
        ticket_code: ticketCode.trim() === "" ? null : ticketCode,
        subsection_id: subsectionId,
        satisfaction,
        reflection: reflection.trim() === "" ? null : reflection.trim(),
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

  // Checklist items mutate immediately rather than waiting for "Save", the
  // same way attachments and dependencies do — they're their own API calls,
  // not part of this task's field set, and ticking something off should feel
  // instant rather than provisional.
  async function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault();
    const title = newSubtask.trim();
    if (!title) return;
    setNewSubtask(""); // clear first so you can keep typing the next item straight away
    try {
      await onAddSubtask(title);
    } catch (err) {
      setNewSubtask(title); // put it back rather than silently losing what was typed
      setError(err instanceof Error ? err.message : "Failed to add checklist item");
    }
  }

  async function handleToggleSubtask(subtaskId: number, isDone: boolean) {
    try {
      await onToggleSubtask(subtaskId, isDone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update checklist item");
    }
  }

  async function handleDeleteSubtask(subtaskId: number) {
    try {
      await onDeleteSubtask(subtaskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete checklist item");
    }
  }

  const subtaskDoneCount = task.subtasks.filter((s) => s.is_done).length;
  const subtaskProgress =
    task.subtasks.length === 0 ? 0 : (subtaskDoneCount / task.subtasks.length) * 100;

  // Candidates for "depends on": every other task in the section, minus
  // whatever it already depends on (no point offering a duplicate).
  const dependencyCandidates = sectionTasks.filter(
    (t) => t.id !== task.id && !task.depends_on.some((d) => d.id === t.id)
  );

  return (
    // Backdrop — clicking outside the modal card closes it, clicking inside
    // the card itself must NOT close it, hence stopPropagation on the inner div.
    <div
      // On a phone this is a bottom sheet: pinned to the bottom edge, full
      // width, rounded only along the top. From sm it's the centered card it
      // has always been. dvh rather than vh so Safari's toolbar doesn't eat
      // the footer with the Save button in it.
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5
          pb-[calc(1.25rem+env(safe-area-inset-bottom))]
          sm:max-h-[85dvh] sm:rounded-3xl sm:p-6 sm:pb-6"
      >
        {/* A short grab bar — the standard "this sheet came up from the
            bottom, it can go back down" cue on iOS. Purely decorative. */}
        <div
          aria-hidden
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden"
        />

        <div className="flex justify-between items-start mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg font-semibold text-white outline-none w-full mr-4 border-b border-transparent focus:border-white/20"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="-m-1.5 shrink-0 p-1.5 text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1">Status</label>
          <div className="flex gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                aria-pressed={status === s.value}
                className={`flex-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
                  status === s.value
                    ? s.active
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* One column on a phone — two of these side by side leaves the date
            picker about 130px wide, which its popover can't live in. */}
        <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Due date</label>
            <DatePicker value={dueDate} onChange={setDueDate} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`${fieldClass} ${PRIORITY_STYLES[priority]}`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Reference <span className="text-zinc-600">— optional</span>
            </label>
            <input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              placeholder="e.g. #42"
              className={`${fieldClass} font-mono`}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Group</label>
            <select
              value={subsectionId ?? ""}
              onChange={(e) =>
                setSubsectionId(e.target.value === "" ? null : Number(e.target.value))
              }
              className={fieldClass}
            >
              <option value="">General</option>
              {subsections.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-2">
          <label className="text-xs text-zinc-400 block mb-1">
            Reminder <span className="text-zinc-600">— a nudge on this date</span>
          </label>
          <DatePicker value={remindAt} onChange={setRemindAt} />
          {task.remind_at && task.reminder_sent && (
            <p className="text-[10px] text-emerald-400 mt-1">✓ Already sent for this date</p>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Jot down anything about this... paste a link and it'll show a preview below"
            className={`${fieldClass} resize-none`}
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

        {/* ---------- What you got out of it ----------
            Shown once a task is done, or whenever something has already been
            written — so it isn't in the way while the work is still live, but
            an old reflection is never hidden just because the card got
            dragged back out of Done. */}
        {(status === "done" || task.reflection || task.satisfaction !== null) && (
          <div className="mb-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
            <label className="mb-2 block text-xs text-emerald-300/90">
              What you got out of it{" "}
              <span className="text-zinc-500">— feeds your weekly look-back</span>
            </label>

            <div className="mb-2.5 flex gap-1.5">
              {SATISFACTION.map((s) => {
                const picked = satisfaction === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSatisfaction(picked ? null : s.value)}
                    aria-pressed={picked}
                    title={s.label}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors ${
                      picked
                        ? "bg-white/15 text-white ring-1 ring-white/25"
                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="text-[10px] font-medium">{s.label}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              placeholder="What did you learn, or get out of it?"
              className={`${fieldClass} resize-none`}
            />
            {task.reflected_at && (
              <p className="mt-1 text-[10px] text-zinc-500">
                Reflected on {format(new Date(task.reflected_at), "d MMM yyyy")}
              </p>
            )}
          </div>
        )}

        {/* ---------- Checklist ---------- */}
        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1">
            Checklist{" "}
            {task.subtasks.length > 0 && (
              <span className="text-zinc-600">
                — {subtaskDoneCount}/{task.subtasks.length} done
              </span>
            )}
          </label>

          {task.subtasks.length > 0 && (
            <div className="h-1 rounded-full bg-white/5 overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-400/70 rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          )}

          {task.subtasks.length === 0 ? (
            <p className="text-xs text-zinc-500 italic mb-2">
              Nothing to tick off yet — break this task into steps below.
            </p>
          ) : (
            <div className="space-y-1.5 mb-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className={`${rowClass} group`}>
                  <input
                    type="checkbox"
                    checked={subtask.is_done}
                    onChange={(e) => handleToggleSubtask(subtask.id, e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-emerald-500"
                  />
                  {/* The strike lives on an inner inline span so the line hugs
                      the text instead of stretching across the whole row. */}
                  <span className="text-xs flex-1 min-w-0">
                    <span
                      className={`${strikeMotionClass(subtask.is_done)} ${
                        subtask.is_done ? "text-zinc-500" : "text-zinc-200"
                      }`}
                    >
                      {subtask.title}
                    </span>
                  </span>
                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="hover-reveal -m-1 shrink-0 p-1 text-zinc-500 hover:text-rose-300"
                    title="Delete item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddSubtask} className="flex gap-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add a step and press Enter…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors"
            />
            <button
              type="submit"
              disabled={!newSubtask.trim()}
              className="text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-30 shrink-0 transition-colors"
            >
              Add
            </button>
          </form>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1">
            Tags <span className="text-zinc-600">— comma separated</span>
          </label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Personal, Someday, Ideas"
            className={fieldClass}
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-zinc-400">
              Links <span className="text-zinc-600">— click the arrow to preview</span>
            </label>
            <button
              onClick={addLink}
              className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              <Plus size={12} /> Add link
            </button>
          </div>
          {links.length === 0 && (
            <p className="text-xs text-zinc-500 italic">No links yet.</p>
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
            <label className="text-xs text-zinc-400">Attachments</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-50 transition-colors"
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
            <p className="text-xs text-zinc-500 italic">No files attached.</p>
          ) : (
            <div className="space-y-1.5">
              {task.task_metadata.attachments.map((att) => (
                <div key={att.filename} className={rowClass}>
                  <Paperclip size={13} className="text-zinc-500 shrink-0" />
                  <a
                    href={`${BASE_URL}${att.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-300 hover:text-sky-200 truncate flex-1 transition-colors"
                  >
                    {att.filename.replace(/^[0-9a-f]{32}_/, "")}
                  </a>
                  <span className="text-[10px] text-zinc-500 shrink-0">
                    {formatBytes(att.size)}
                  </span>
                  <button
                    onClick={() => onDeleteAttachment(att.filename)}
                    className="text-zinc-500 hover:text-rose-300 shrink-0 transition-colors"
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
          <label className="text-xs text-zinc-400 block mb-1">
            Waiting on <span className="text-zinc-600">— finishes before this can start</span>
          </label>
          {task.depends_on.length === 0 ? (
            <p className="text-xs text-zinc-500 italic mb-2">Nothing blocking this.</p>
          ) : (
            <div className="space-y-1.5 mb-2">
              {task.depends_on.map((dep) => (
                <div key={dep.id} className={rowClass}>
                  <LinkIcon size={12} className="text-zinc-500 shrink-0" />
                  <span
                    className={`text-xs flex-1 ${dep.status === "done" ? "text-emerald-400" : "text-zinc-300"}`}
                  >
                    {dep.title}
                  </span>
                  <span className="text-[10px] text-zinc-500">{dep.status}</span>
                  <button
                    onClick={() => onRemoveDependency(dep.id)}
                    className="text-zinc-500 hover:text-rose-300 shrink-0 transition-colors"
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
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors"
              >
                <option value="">Add something it's waiting on…</option>
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
                className="text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-30 shrink-0 transition-colors"
              >
                Add
              </button>
            </div>
          )}
          {task.blocks.length > 0 && (
            <p className="text-[10px] text-zinc-500 mt-2">
              This is holding up: {task.blocks.map((b) => b.title).join(", ")}
            </p>
          )}
        </div>

        {error && <p className="text-rose-300 text-xs mb-3">{error}</p>}

        <div className="flex justify-between items-center gap-2 pt-4 border-t border-white/10">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1 px-3 py-2 text-sm text-rose-300 hover:text-rose-200 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-medium rounded-full transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
