from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


# ---------- Link (lives inside task_metadata.links, not its own table) ----------

class Link(BaseModel):
    label: str
    url: str


class Attachment(BaseModel):
    filename: str
    url: str
    size: int
    content_type: str


class TaskMetadata(BaseModel):
    """Shape of the flexible JSONB blob. Extra keys are still allowed —
    this just gives you typed autocomplete for the fields you know about."""
    model_config = ConfigDict(extra="allow")

    links: list[Link] = []
    tags: list[str] = []
    assignee_avatar_url: str | None = None
    attachments: list[Attachment] = []


# ---------- Subtask ----------

class SubtaskBase(BaseModel):
    title: str
    is_done: bool = False
    position: int = 0


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskUpdate(BaseModel):
    title: str | None = None
    is_done: bool | None = None
    position: int | None = None


class SubtaskRead(SubtaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int


# ---------- Task ----------

class TaskSummary(BaseModel):
    """Minimal shape used inside `depends_on` / `blocks` lists — a full
    TaskRead would recurse into ITS OWN depends_on/blocks and so on
    infinitely, so dependency lists only ever show id/title/status."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    status: TaskStatus


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    ticket_code: str | None = None
    due_date: date | None = None
    remind_at: date | None = None
    subsection_id: int | None = None
    task_metadata: TaskMetadata = TaskMetadata()


class TaskCreate(TaskBase):
    section_id: int


class TaskUpdate(BaseModel):
    """All fields optional — used for PATCH (e.g. just dragging a card
    to a new column only needs to send `status`)."""
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    ticket_code: str | None = None
    due_date: date | None = None
    remind_at: date | None = None
    subsection_id: int | None = None
    task_metadata: TaskMetadata | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    section_id: int
    created_at: datetime
    updated_at: datetime
    reminder_sent: bool
    # Server-computed from status transitions (see crud.update_task) — not
    # settable directly via TaskCreate/TaskUpdate.
    started_at: datetime | None = None
    completed_at: datetime | None = None
    subtasks: list[SubtaskRead] = []
    depends_on: list[TaskSummary] = []
    blocks: list[TaskSummary] = []


# ---------- Subsection ----------

class SubsectionBase(BaseModel):
    name: str
    position: int = 0


class SubsectionCreate(SubsectionBase):
    pass


class SubsectionUpdate(BaseModel):
    name: str | None = None
    position: int | None = None


class SubsectionRead(SubsectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    section_id: int


# ---------- Section ----------

class SectionBase(BaseModel):
    name: str
    slug: str
    color: str | None = None
    position: int = 0


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    color: str | None = None
    position: int | None = None


class SectionRead(SectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    subsections: list[SubsectionRead] = []


# ---------- Google Calendar ----------

class GoogleCalendarInfo(BaseModel):
    id: str
    name: str
    description: str | None = None
    color: str | None = None
    primary: bool = False


class GoogleCalendarStatus(BaseModel):
    """Everything the Calendar page needs to decide what to render.

    `configured` and `connected` are separate on purpose: no client id/secret on
    the server is a deployment problem the user can't fix from the UI ("ask your
    admin"/see DEPLOY.md), whereas configured-but-not-connected is exactly the
    case where a Connect button makes sense.
    """
    configured: bool
    connected: bool
    account_email: str | None = None
    calendars: list[GoogleCalendarInfo] = []
    selected_calendar_ids: list[str] = []
    # Set when the tokens exist but Google wouldn't talk to us — lets the page
    # show the real reason instead of silently rendering zero events.
    error: str | None = None


class GoogleCalendarSelection(BaseModel):
    calendar_ids: list[str]


class GoogleEvent(BaseModel):
    id: str
    calendar_id: str
    calendar_name: str
    color: str | None = None
    title: str
    description: str | None = None
    location: str | None = None
    # ISO strings. All-day events carry a bare date ("2026-08-05"); timed ones
    # carry a full offset-aware timestamp. `all_day` says which to expect.
    start: str | None = None
    end: str | None = None
    all_day: bool = False
    html_link: str | None = None
    status: str | None = None


# ---------- Analytics ----------

class AnalyticsSummary(BaseModel):
    total_tasks: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    completion_rate: float
    overdue_count: int
    subtasks_total: int
    subtasks_done: int
    completed_by_day: dict[str, int]
