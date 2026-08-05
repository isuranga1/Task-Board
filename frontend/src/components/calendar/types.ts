import type { GoogleEvent, Task } from "../../types";

/**
 * One thing on one day of the calendar.
 *
 * Task deadlines and Google events are genuinely different — different sources,
 * different actions when clicked, different colors — but a day cell just wants
 * a list of chips to render in time order. This union is the shared shape that
 * makes that possible without either side pretending to be the other.
 */
export type CalendarItem =
  | { kind: "task"; id: string; task: Task; color: string; title: string; sortKey: string }
  | { kind: "event"; id: string; event: GoogleEvent; color: string; title: string; sortKey: string };

/** All-day events and task deadlines have no clock time, so they sort first. */
export const ALL_DAY_SORT_KEY = "";
