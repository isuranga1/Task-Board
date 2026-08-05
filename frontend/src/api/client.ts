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
} from "../types";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Every real request funnels through this one function so error handling
// (and later: auth headers, logging, etc.) lives in exactly one place.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
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
};
