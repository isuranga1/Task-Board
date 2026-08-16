import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SATISFACTION } from "./satisfaction";
import type { Task } from "../../types";

interface ReflectionPromptProps {
  task: Task;
  /** Skip, or dismiss without saving. The task stays done either way. */
  onDismiss: () => void;
  onSave: (values: { satisfaction: number | null; reflection: string | null }) => Promise<void>;
}

/**
 * The prompt that appears the moment a task reaches Done: how did that feel,
 * and what did you get out of it?
 *
 * Skipping is a real, first-class outcome — the button is right there and
 * Escape does the same thing. A prompt you cannot dismiss would make finishing
 * a task feel like paperwork, and the board would quietly stop being used for
 * small tasks to avoid it. The task is already saved as done by the time this
 * renders; nothing here can fail in a way that undoes that.
 *
 * What gets written here is the raw material for the week/month/year look-back
 * on the Insights page — a review built from task titles alone reads like a
 * status report, and these sentences are what make it worth reading.
 */
export function ReflectionPrompt({ task, onDismiss, onSave }: ReflectionPromptProps) {
  // Pre-filled from the task, so re-opening this on something already
  // reflected on edits the note instead of silently starting over.
  const [satisfaction, setSatisfaction] = useState<number | null>(task.satisfaction);
  const [reflection, setReflection] = useState(task.reflection ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const trimmed = reflection.trim();
  const hasSomething = trimmed !== "" || satisfaction !== null;

  async function handleSave() {
    if (!hasSomething) {
      onDismiss(); // nothing to record — same outcome as skipping
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ satisfaction, reflection: trimmed === "" ? null : trimmed });
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again?");
      setSaving(false);
    }
  }

  return (
    // Same bottom-sheet-on-phone, centered-card-from-sm shape as the task
    // detail modal, so finishing a task doesn't introduce a new kind of surface.
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center app-scrim backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="What did you get out of this?"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5
          pb-[calc(1.25rem+env(safe-area-inset-bottom))]
          sm:max-h-[85dvh] sm:rounded-3xl sm:p-6 sm:pb-6"
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">Done — nice one.</h2>
            <p className="mt-0.5 truncate text-sm text-zinc-400" title={task.title}>
              {task.title}
            </p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Skip"
            className="-m-1.5 shrink-0 p-1.5 text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-xs text-zinc-400">How did that one feel?</label>
          <div className="flex gap-1.5">
            {SATISFACTION.map((s) => {
              const picked = satisfaction === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  // Tapping the chosen one again clears it — otherwise a
                  // mis-tap can never be taken back, only changed.
                  onClick={() => setSatisfaction(picked ? null : s.value)}
                  aria-pressed={picked}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
                    picked
                      ? "bg-white/15 text-white ring-1 ring-white/25"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span className="text-[10px] font-medium">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-zinc-400">
            What did you learn, or get out of it?{" "}
            <span className="text-zinc-600">— optional</span>
          </label>
          <textarea
            autoFocus
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={4}
            placeholder="Even one line helps. What went better than expected? What would you do differently? What do you know now that you didn't?"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm
              text-white outline-none transition-colors focus:border-white/30"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
            This is what your weekly and monthly look-back is written from.
          </p>
        </div>

        {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onDismiss}
            className="px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black
              transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
