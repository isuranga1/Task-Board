import type {
  Section,
  Subsection,
  Task,
  Subtask,
  SectionCreatePayload,
  SectionUpdatePayload,
  SubsectionCreatePayload,
  SubsectionUpdatePayload,
  TaskCreatePayload,
  TaskUpdatePayload,
  AnalyticsSummary,
  GoogleCalendarStatus,
  GoogleEvent,
  GrowthStatus,
  GrowthTip,
} from "../types";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Carries the HTTP status alongside the message, so a caller can branch on
 * *which* failure it was — the Grow orb needs to tell "you've used today's 25"
 * (429) apart from a genuine error, and string-matching the message to find
 * that out would break the first time the wording changed.
 *
 * Extends Error, so existing `err instanceof Error` handling still catches it.
 */
export class ApiError extends Error {
  readonly status: number;
  /** The server's `detail` where FastAPI sent one, else the raw body. */
  readonly detail: string;

  constructor(status: number, detail: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// FastAPI puts human-readable errors in a `detail` field; anything else (a
// proxy's HTML error page, an empty body) falls back to the raw text.
function readDetail(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    // Not JSON — the raw body is the best we have.
  }
  return body;
}

// Every real request funnels through this one function so error handling
// (and later: auth headers, logging, etc.) lives in exactly one place.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(
      res.status,
      readDetail(body),
      `API ${res.status} ${res.statusText}: ${body}`
    );
  }

  // DELETE endpoints return 204 No Content — nothing to parse.
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  // ---------- Sections ----------
  listSections: () => request<Section[]>("/sections/"),
  createSection: (payload: SectionCreatePayload) =>
    request<Section>("/sections/", { method: "POST", body: JSON.stringify(payload) }),
  updateSection: (id: number, payload: SectionUpdatePayload) =>
    request<Section>(`/sections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSection: (id: number) =>
    request<void>(`/sections/${id}`, { method: "DELETE" }),

  createSubsection: (sectionId: number, payload: SubsectionCreatePayload) =>
    request<Subsection>(`/sections/${sectionId}/subsections`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSubsection: (id: number, payload: SubsectionUpdatePayload) =>
    request<Subsection>(`/subsections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteSubsection: (id: number) =>
    request<void>(`/subsections/${id}`, { method: "DELETE" }),

  // ---------- Tasks ----------
  listTasksForSection: (sectionId: number) =>
    request<Task[]>(`/sections/${sectionId}/tasks`),

  // Every task in every section — what the Deadlines and Calendar views use.
  // Unlike the per-section call above, this one isn't scoped to whatever tab
  // the board happens to be on.
  listAllTasks: () => request<Task[]>("/tasks/"),

  getTask: (id: number) => request<Task>(`/tasks/${id}`),

  createTask: (payload: TaskCreatePayload) =>
    request<Task>("/tasks/", { method: "POST", body: JSON.stringify(payload) }),

  updateTask: (id: number, payload: TaskUpdatePayload) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),

  // ---------- Subtasks ----------
  createSubtask: (taskId: number, title: string) =>
    request<Subtask>(`/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  toggleSubtask: (subtaskId: number, is_done: boolean) =>
    request<Subtask>(`/tasks/subtasks/${subtaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_done }),
    }),

  deleteSubtask: (subtaskId: number) =>
    request<void>(`/tasks/subtasks/${subtaskId}`, { method: "DELETE" }),

  // ---------- Dependencies ----------
  addDependency: (taskId: number, dependsOnId: number) =>
    request<Task>(`/tasks/${taskId}/dependencies?depends_on_id=${dependsOnId}`, {
      method: "POST",
    }),

  removeDependency: (taskId: number, dependsOnId: number) =>
    request<Task>(`/tasks/${taskId}/dependencies/${dependsOnId}`, {
      method: "DELETE",
    }),

  // ---------- Attachments ----------
  // Uses FormData directly instead of the shared `request()` helper because
  // file uploads must NOT set Content-Type: application/json — the browser
  // needs to set its own multipart/form-data boundary header automatically.
  uploadAttachment: async (taskId: number, file: File): Promise<Task> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/tasks/${taskId}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
    }
    return res.json();
  },

  deleteAttachment: (taskId: number, filename: string) =>
    request<Task>(`/tasks/${taskId}/attachments/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    }),

  // ---------- Analytics ----------
  getAnalytics: (sectionId?: number) =>
    request<AnalyticsSummary>(
      sectionId ? `/analytics/summary?section_id=${sectionId}` : "/analytics/summary"
    ),

  // ---------- Google Calendar ----------
  getGoogleStatus: () => request<GoogleCalendarStatus>("/gcal/status"),

  // Returns the consent URL rather than navigating itself — the caller decides
  // whether to redirect the tab or open a popup.
  getGoogleAuthUrl: () => request<{ url: string }>("/gcal/auth-url"),

  setGoogleCalendars: (calendarIds: string[]) =>
    request<GoogleCalendarStatus>("/gcal/calendars", {
      method: "PUT",
      body: JSON.stringify({ calendar_ids: calendarIds }),
    }),

  // `start`/`end` are Date objects; sent as UTC ISO strings, which is what the
  // backend assumes when a timestamp arrives without an offset.
  listGoogleEvents: (start: Date, end: Date) =>
    request<GoogleEvent[]>(
      `/gcal/events?start=${encodeURIComponent(start.toISOString())}` +
        `&end=${encodeURIComponent(end.toISOString())}`
    ),

  disconnectGoogle: () => request<void>("/gcal/connection", { method: "DELETE" }),

  // ---------- Grow orb ----------
  getGrowthStatus: () => request<GrowthStatus>("/growth/status"),

  // The only call in the app that costs real money — one of the day's 25.
  // The server, not this client, is what enforces that ceiling.
  generateGrowthTip: () => request<GrowthTip>("/growth/tip", { method: "POST" }),

  listGrowthTips: (limit = 20) => request<GrowthTip[]>(`/growth/tips?limit=${limit}`),
};
