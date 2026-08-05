import { parseISO, differenceInCalendarDays, endOfWeek, isAfter } from "date-fns";
import type { Task } from "../types";

export type DeadlineBucketKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this_week"
  | "later"
  | "none";

export interface DeadlineBucket {
  key: DeadlineBucketKey;
  label: string;
  /** Short line under the heading — omitted for the self-explanatory ones. */
  hint?: string;
  tasks: Task[];
}

// Order matters: this is the order they render in, most urgent first.
const BUCKET_ORDER: { key: DeadlineBucketKey; label: string; hint?: string }[] = [
  { key: "overdue", label: "Overdue", hint: "Past their deadline" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "this_week", label: "Rest of this week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No deadline", hint: "Nothing scheduled yet" },
];

/**
 * Which bucket a task falls into, purely by its due date.
 *
 * Status deliberately doesn't enter into it — a finished task with last
 * Tuesday's deadline still *was* overdue, and quietly reclassifying it would
 * make the list disagree with the dates it's showing. The Deadlines page hides
 * completed tasks by default instead, which handles the common case without
 * the bucketing rule having to lie about anything.
 */
export function bucketFor(task: Task, now: Date): DeadlineBucketKey {
  if (!task.due_date) return "none";

  const due = parseISO(task.due_date);
  const days = differenceInCalendarDays(due, now);

  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";

  // "This week" runs to the end of the CURRENT calendar week, so on a Friday
  // it covers a day or two, not a rolling seven — which is what someone
  // scanning for "what's left before the weekend" actually means by it.
  const weekEnd = endOfWeek(now);
  if (!isAfter(due, weekEnd)) return "this_week";

  return "later";
}

/**
 * Groups tasks into the ordered buckets above, each internally sorted by due
 * date then priority. Empty buckets are dropped so the page doesn't render a
 * column of headings with nothing under them.
 */
export function groupByDeadline(tasks: Task[], now: Date = new Date()): DeadlineBucket[] {
  const grouped = new Map<DeadlineBucketKey, Task[]>();
  for (const { key } of BUCKET_ORDER) grouped.set(key, []);

  for (const task of tasks) {
    grouped.get(bucketFor(task, now))!.push(task);
  }

  const priorityRank: Record<Task["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  for (const list of grouped.values()) {
    list.sort((a, b) => {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) {
        return a.due_date < b.due_date ? -1 : 1;
      }
      // Same day (or both undated): the more urgent one goes first, then
      // oldest-created, so the order is stable across renders.
      const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
      return byPriority !== 0 ? byPriority : a.id - b.id;
    });
  }

  return BUCKET_ORDER.filter((b) => grouped.get(b.key)!.length > 0).map((b) => ({
    ...b,
    tasks: grouped.get(b.key)!,
  }));
}

/** Tasks past their deadline and not yet done — the number worth alarming about. */
export function countOverdue(tasks: Task[], now: Date = new Date()): number {
  return tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.due_date &&
      differenceInCalendarDays(parseISO(t.due_date), now) < 0
  ).length;
}
