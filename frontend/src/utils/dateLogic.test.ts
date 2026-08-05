/**
 * Tests for the two pure date modules the new views depend on.
 *
 * These are the pieces most likely to be subtly wrong and least likely to look
 * wrong on screen: an off-by-one in Google's exclusive all-day `end` puts a
 * phantom chip on the following day, and a bucket boundary that's a day out
 * only shows up on one particular day of the week.
 *
 * Run with:  node --test src/utils/dateLogic.test.ts
 * (Node strips the TypeScript types natively; no test framework needed.)
 */

import test from "node:test";
import assert from "node:assert/strict";

import { bucketFor, groupByDeadline, countOverdue } from "./deadlines.ts";
import { eventDayKeys, dayKey, eventTimeLabel } from "./calendar.ts";
import type { GoogleEvent, Task } from "../types/index.ts";

// A Wednesday, so "rest of this week" has room on both sides.
const NOW = new Date(2026, 7, 5, 12, 0, 0); // 2026-08-05

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    section_id: 1,
    subsection_id: null,
    title: "t",
    description: null,
    status: "todo",
    priority: "medium",
    ticket_code: null,
    due_date: null,
    remind_at: null,
    reminder_sent: false,
    started_at: null,
    completed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    task_metadata: { links: [], tags: [], attachments: [] },
    subtasks: [],
    depends_on: [],
    blocks: [],
    ...overrides,
  };
}

function event(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: "e1",
    calendar_id: "c1",
    calendar_name: "Personal",
    color: "#7c8cff",
    title: "Event",
    description: null,
    location: null,
    start: null,
    end: null,
    all_day: false,
    html_link: null,
    status: "confirmed",
    ...overrides,
  };
}

test("bucketFor places dates in the right bucket relative to a Wednesday", () => {
  assert.equal(bucketFor(task({ due_date: null }), NOW), "none");
  assert.equal(bucketFor(task({ due_date: "2026-08-04" }), NOW), "overdue");
  assert.equal(bucketFor(task({ due_date: "2026-07-01" }), NOW), "overdue");
  assert.equal(bucketFor(task({ due_date: "2026-08-05" }), NOW), "today");
  assert.equal(bucketFor(task({ due_date: "2026-08-06" }), NOW), "tomorrow");
  // Fri/Sat of the same calendar week.
  assert.equal(bucketFor(task({ due_date: "2026-08-07" }), NOW), "this_week");
  assert.equal(bucketFor(task({ due_date: "2026-08-08" }), NOW), "this_week");
  // Sunday starts the NEXT week (date-fns weeks start on Sunday by default).
  assert.equal(bucketFor(task({ due_date: "2026-08-09" }), NOW), "later");
  assert.equal(bucketFor(task({ due_date: "2026-12-25" }), NOW), "later");
});

test("a task due today is not overdue, even late in the day", () => {
  const lateInDay = new Date(2026, 7, 5, 23, 59, 0);
  assert.equal(bucketFor(task({ due_date: "2026-08-05" }), lateInDay), "today");
  assert.equal(countOverdue([task({ due_date: "2026-08-05" })], lateInDay), 0);
});

test("countOverdue ignores completed tasks", () => {
  const tasks = [
    task({ id: 1, due_date: "2026-08-01", status: "todo" }),
    task({ id: 2, due_date: "2026-08-01", status: "done" }),
    task({ id: 3, due_date: "2026-08-01", status: "in_progress" }),
  ];
  assert.equal(countOverdue(tasks, NOW), 2);
});

test("groupByDeadline drops empty buckets and keeps urgency order", () => {
  const buckets = groupByDeadline(
    [
      task({ id: 1, due_date: "2026-12-25" }),
      task({ id: 2, due_date: "2026-08-01" }),
      task({ id: 3, due_date: "2026-08-05" }),
    ],
    NOW
  );
  assert.deepEqual(
    buckets.map((b) => b.key),
    ["overdue", "today", "later"]
  );
});

test("within a bucket, earlier dates come first, then higher priority", () => {
  const buckets = groupByDeadline(
    [
      task({ id: 1, due_date: "2026-08-20", priority: "low" }),
      task({ id: 2, due_date: "2026-08-15", priority: "low" }),
      task({ id: 3, due_date: "2026-08-15", priority: "urgent" }),
    ],
    NOW
  );
  const later = buckets.find((b) => b.key === "later")!;
  assert.deepEqual(
    later.tasks.map((t) => t.id),
    [3, 2, 1]
  );
});

test("a single-day all-day event occupies exactly one day", () => {
  // Google represents Aug 5 alone as start=05, end=06 (end is EXCLUSIVE).
  const keys = eventDayKeys(
    event({ all_day: true, start: "2026-08-05", end: "2026-08-06" })
  );
  assert.deepEqual(keys, ["2026-08-05"]);
});

test("a multi-day all-day event drops the exclusive end day", () => {
  // Aug 5-7 inclusive comes back as end=08.
  const keys = eventDayKeys(
    event({ all_day: true, start: "2026-08-05", end: "2026-08-08" })
  );
  assert.deepEqual(keys, ["2026-08-05", "2026-08-06", "2026-08-07"]);
});

test("a timed event within one day occupies one day", () => {
  const keys = eventDayKeys(
    event({ start: "2026-08-05T19:00:00+05:30", end: "2026-08-05T21:00:00+05:30" })
  );
  assert.deepEqual(keys, ["2026-08-05"]);
});

test("a timed event spanning days keeps its inclusive end", () => {
  const keys = eventDayKeys(
    event({ start: "2026-08-05T09:00:00+05:30", end: "2026-08-07T17:00:00+05:30" })
  );
  assert.deepEqual(keys, ["2026-08-05", "2026-08-06", "2026-08-07"]);
});

test("malformed events degrade instead of throwing", () => {
  assert.deepEqual(eventDayKeys(event({ start: null })), []);
  assert.deepEqual(eventDayKeys(event({ start: "not-a-date" })), []);
  // end before start would otherwise blow up eachDayOfInterval
  assert.deepEqual(
    eventDayKeys(event({ start: "2026-08-05T10:00:00Z", end: "2026-08-01T10:00:00Z" })),
    ["2026-08-05"]
  );
  assert.deepEqual(
    eventDayKeys(event({ start: "2026-08-05T10:00:00Z", end: "garbage" })),
    ["2026-08-05"]
  );
});

test("eventTimeLabel distinguishes all-day from timed", () => {
  assert.equal(eventTimeLabel(event({ all_day: true, start: "2026-08-05" })), "All day");
  assert.equal(eventTimeLabel(event({ start: null })), "All day");
});

test("dayKey formats in local time, not UTC", () => {
  assert.equal(dayKey(new Date(2026, 7, 5, 23, 30)), "2026-08-05");
  assert.equal(dayKey(new Date(2026, 7, 5, 0, 15)), "2026-08-05");
});
