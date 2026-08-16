import { useCallback, useState } from "react";
import type { Task } from "../types";

/**
 * Decides when the "what did you get out of it?" prompt should appear, and
 * holds the task it's asking about.
 *
 * This lives in a hook rather than inside the modal or the board because a task
 * can reach Done from three places — dragged into the column, switched with the
 * status buttons in the detail modal, or edited from the Deadlines/Calendar
 * views — and all three should feel identical. Each of those call sites just
 * reports the before/after pair here and lets this work out whether to ask.
 */
export function useReflection() {
  const [pending, setPending] = useState<Task | null>(null);

  /**
   * Ask about `after`, but only on a real transition into Done that hasn't
   * already been reflected on.
   *
   * The `before.status !== "done"` check is what stops the prompt reappearing
   * every time an already-finished task is saved — renaming a done task, or
   * ticking one of its checklist items, must not re-open this. And a task that
   * already carries a reflection is left alone: it's editable from the detail
   * modal, which is the right place to revisit it deliberately.
   */
  const maybeAsk = useCallback((before: Task | undefined, after: Task) => {
    if (!before) return;
    if (after.status !== "done" || before.status === "done") return;
    if (after.reflection || after.satisfaction !== null) return;
    setPending(after);
  }, []);

  const dismiss = useCallback(() => setPending(null), []);

  return { pending, maybeAsk, dismiss };
}
