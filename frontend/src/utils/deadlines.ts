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

/**
 * How a task's deadline should read right now.
 *
 * The distinction that matters here is whether the clock is still running. An
 * unfinished task measures its lateness against *today*, so it grows more
 * overdue every morning — correct, and the point of the red text. A finished
 * one must measure against the day it was actually finished instead: a task
 * closed one day late is permanently one day late, and comparing it to today
 * made completed work look worse and worse the longer you left it on the
 * board. That was the bug this type exists to make un-writable.
 *
 * `completed_at` is set by the backend on the transition into "done", so it's
 * present for anything closed through the UI. Tasks finished before that
 * column existed have none, and report `finished_unknown` rather than guessing
 * from `updated_at` — which moves on every later edit and would invent a
 * completion date that never happened.
 *
 * Timezone: `completed_at` is a UTC instant while `due_date` is a bare
 * calendar date, so the two are only comparable once both are read on the
 * same calendar. That calendar is the viewer's local one, because that's the
 * calendar the date picker used when the deadline was chosen — finishing at
 * 11pm on the 4th is on time for a deadline of the 4th, wherever you are.
 */
export type DueState =
  | { kind: "upcoming"; days: number }
  /** Still open and past its date. `days` grows with time. */
  | { kind: "late"; days: number }
  /** Done, and it missed the date. `days` is frozen at what it cost. */
  | { kind: "finished_late"; days: number }
  | { kind: "finished_on_time" }
  | { kind: "finished_unknown" };

export function dueState(task: Task, now: Date = new Date()): DueState | null {
  if (!task.due_date) return null;
  const due = parseISO(task.due_date);

  if (task.status === "done") {
    if (!task.completed_at) return { kind: "finished_unknown" };
    const lateBy = differenceInCalendarDays(parseISO(task.completed_at), due);
    return lateBy > 0 ? { kind: "finished_late", days: lateBy } : { kind: "finished_on_time" };
  }

  const days = differenceInCalendarDays(due, now);
  return days < 0 ? { kind: "late", days: -days } : { kind: "upcoming", days };
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
