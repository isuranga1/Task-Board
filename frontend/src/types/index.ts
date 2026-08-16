// These mirror backend/app/schemas.py field-for-field. Keeping them in sync
// by hand is fine at this size — if the project grows a lot, generating these
// from the FastAPI OpenAPI schema becomes worth it, but not yet.

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Link {
  label: string;
  url: string;
}

export interface Attachment {
  filename: string;
  url: string;
  size: number;
  content_type: string;
}

export interface TaskMetadata {
  links: Link[];
  tags: string[];
  assignee_avatar_url?: string | null;
  attachments: Attachment[];
  // `extra="allow"` on the backend means more keys can show up here than
  // the ones above — this index signature lets TS accept them without
  // you needing to redeclare every possible key.
  [key: string]: unknown;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_done: boolean;
  position: number;
}

// Minimal shape used inside a task's depends_on/blocks lists — mirrors
// backend's TaskSummary, which deliberately avoids embedding a FULL task
// (that would recurse into ITS OWN depends_on/blocks forever).
export interface TaskSummary {
  id: number;
  title: string;
  status: TaskStatus;
}

export interface Task {
  id: number;
  section_id: number;
  subsection_id: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  ticket_code: string | null;
  due_date: string | null; // ISO date string, e.g. "2026-07-10"
  remind_at: string | null;
  reminder_sent: boolean;
  started_at: string | null; // set when the task most recently entered "in_progress"
  completed_at: string | null; // set when the task most recently reached "done"
  /** 1-5, how finishing it felt. Null if the reflection prompt was skipped. */
  satisfaction: number | null;
  /** What you learned or got out of it. Null if the prompt was skipped. */
  reflection: string | null;
  /** Server-stamped when a reflection is written; cleared when one is emptied. */
  reflected_at: string | null;
  created_at: string;
  updated_at: string;
  task_metadata: TaskMetadata;
  subtasks: Subtask[];
  depends_on: TaskSummary[];
  blocks: TaskSummary[];
}

export interface Subsection {
  id: number;
  section_id: number;
  name: string;
  position: number;
}

export interface Section {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  position: number;
  created_at: string;
  subsections: Subsection[];
}

// ---------- Payload shapes for creating/updating (mirrors *Create / *Update schemas) ----------

export interface TaskCreatePayload {
  section_id: number;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  ticket_code?: string | null;
  due_date?: string | null;
  remind_at?: string | null;
  subsection_id?: number | null;
  task_metadata?: Partial<TaskMetadata>;
  satisfaction?: number | null;
  reflection?: string | null;
}

// All optional, mirroring TaskUpdate on the backend — a drag-and-drop status
// change only ever sends `{ status: "..." }`, never the whole task.
export type TaskUpdatePayload = Partial<Omit<TaskCreatePayload, "section_id">>;

export interface SectionCreatePayload {
  name: string;
  slug: string;
  color?: string | null;
}

export interface SubsectionCreatePayload {
  name: string;
  position?: number;
}

export interface SectionUpdatePayload {
  name?: string;
  slug?: string;
  color?: string | null;
  position?: number;
}

export interface SubsectionUpdatePayload {
  name?: string;
  position?: number;
}

// ---------- Google Calendar ----------

export interface GoogleCalendarInfo {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  primary: boolean;
}

export interface GoogleCalendarStatus {
  /** Server has a client id/secret. False = nothing the UI can do about it. */
  configured: boolean;
  /** An account has actually completed consent. */
  connected: boolean;
  account_email: string | null;
  calendars: GoogleCalendarInfo[];
  selected_calendar_ids: string[];
  /** Set when the stored tokens exist but Google refused them. */
  error: string | null;
}

export interface GoogleEvent {
  id: string;
  calendar_id: string;
  calendar_name: string;
  color: string | null;
  title: string;
  description: string | null;
  location: string | null;
  /** All-day events carry "2026-08-05"; timed ones a full ISO timestamp. */
  start: string | null;
  end: string | null;
  all_day: boolean;
  html_link: string | null;
  status: string | null;
}

// ---------- Grow orb ----------

export interface GrowthTip {
  id: number;
  /** Which area it came from, e.g. "Money & finance — saving, investing, …". */
  topic: string;
  title: string;
  body: string;
  /** One concrete thing to go and do. Null if the model omitted it. */
  try_this: string | null;
  created_at: string;
}

export interface GrowthStatus {
  /** Server has an OpenRouter key. False = nothing the UI can do about it. */
  configured: boolean;
  used_today: number;
  daily_limit: number;
  remaining: number;
  /** The last tip generated, so opening the orb doesn't have to spend one. */
  latest: GrowthTip | null;
}

// ---------- Look back (the week/month/year review) ----------

export type ReviewPeriod = "week" | "month" | "year";

/** One finished task as the review lists it — a recap row, not a full Task. */
export interface CompletedTaskBrief {
  id: number;
  title: string;
  section_name: string;
  completed_at: string | null;
  satisfaction: number | null;
  reflection: string | null;
}

export interface PeriodSummary {
  id: number;
  period: ReviewPeriod;
  period_start: string;
  period_end: string;
  /** "Week of 10 Aug 2026", "August 2026", "2026". */
  label: string;
  headline: string;
  /** Paragraphs separated by blank lines. */
  narrative: string;
  themes: string[];
  advice: string | null;
  /** How many completed tasks it was written from — see `stale` below. */
  task_count: number;
  created_at: string;
}

export interface PeriodReview {
  period: ReviewPeriod;
  period_start: string;
  period_end: string;
  label: string;
  completed: CompletedTaskBrief[];
  /** How many of `completed` carry a reflection. */
  reflected_count: number;
  summary: PeriodSummary | null;
  /** A summary exists, but more has been finished since it was written. */
  stale: boolean;
  /** Server has an OpenRouter key. False = nothing the UI can do about it. */
  configured: boolean;
  used_today: number;
  daily_limit: number;
  remaining: number;
}

export interface AnalyticsSummary {
  total_tasks: number;
  by_status: Record<TaskStatus, number>;
  by_priority: Record<TaskPriority, number>;
  completion_rate: number;
  overdue_count: number;
  subtasks_total: number;
  subtasks_done: number;
  completed_by_day: Record<string, number>;
}
