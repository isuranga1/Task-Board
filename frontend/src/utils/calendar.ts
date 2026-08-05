import { format, parseISO, eachDayOfInterval, subDays, isValid } from "date-fns";
import type { GoogleEvent, Task } from "../types";

/** The key every day-indexed map in the calendar uses: "2026-08-05". */
export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * The day(s) a Google event should appear on.
 *
 * Two shapes have to be reconciled here:
 *  - All-day events use bare dates and Google's `end.date` is EXCLUSIVE — an
 *    event on the 5th alone comes back as start 2026-08-05, end 2026-08-06.
 *    Rendering that literally puts a phantom chip on the 6th, so the last day
 *    is stepped back by one.
 *  - Timed events use full timestamps, where `end` is inclusive and in local
 *    time once parsed. A dinner from 7pm to 9pm is one day; a conference from
 *    Monday 9am to Wednesday 5pm is genuinely three.
 */
export function eventDayKeys(event: GoogleEvent): string[] {
  if (!event.start) return [];

  const start = parseISO(event.start);
  if (!isValid(start)) return [];

  if (!event.end) return [dayKey(start)];

  let end = parseISO(event.end);
  if (!isValid(end)) return [dayKey(start)];

  if (event.all_day) {
    end = subDays(end, 1);
  }

  // Guard against a malformed range (end before start) producing an
  // eachDayOfInterval throw — fall back to just the start day.
  if (end < start) return [dayKey(start)];

  // A multi-week event would otherwise generate a huge array; the calendar only
  // ever renders ~6 weeks, so cap the expansion well above that and no further.
  const days = eachDayOfInterval({ start, end });
  return days.slice(0, 400).map(dayKey);
}

/** The day a task's deadline sits on, or null if it has no deadline. */
export function taskDayKey(task: Task): string | null {
  if (!task.due_date) return null;
  const due = parseISO(task.due_date);
  return isValid(due) ? dayKey(due) : null;
}

/** "9:30 AM", or "All day" for an event with no clock time. */
export function eventTimeLabel(event: GoogleEvent): string {
  if (event.all_day || !event.start) return "All day";
  const start = parseISO(event.start);
  return isValid(start) ? format(start, "h:mm a") : "All day";
}

/**
 * Buckets items by day key in one pass.
 * Used for both tasks and events so each day cell is a map lookup, not a
 * filter over every item in the month.
 */
export function groupByDay<T>(items: T[], keysFor: (item: T) => string[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    for (const key of keysFor(item)) {
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
  }
  return map;
}
