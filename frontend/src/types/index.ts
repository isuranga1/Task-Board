// These mirror backend/app/schemas.py field-for-field. Keeping them in sync
// by hand is fine at this size — if the project grows a lot, generating these
// from the FastAPI OpenAPI schema becomes worth it, but not yet.

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Link {
  label: string;
  url: string;
}

export interface TaskMetadata {
  links: Link[];
  tags: string[];
  assignee_avatar_url?: string | null;
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

export interface Task {
  id: number;
  section_id: number;
  subsection_id: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  ticket_code: string | null;
  due_date: string | null; // ISO date string, e.g. "2026-07-10"
  created_at: string;
  updated_at: string;
  task_metadata: TaskMetadata;
  subtasks: Subtask[];
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
  created_at: string;
  subsections: Subsection[];
}

// ---------- Payload shapes for creating/updating (mirrors *Create / *Update schemas) ----------

export interface TaskCreatePayload {
  section_id: number;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  ticket_code?: string | null;
  due_date?: string | null;
  subsection_id?: number | null;
  task_metadata?: Partial<TaskMetadata>;
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
