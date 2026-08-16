from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


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
    # What you got out of finishing it. Both stay None if the prompt that
    # appears on completion is skipped — see models.Task.
    satisfaction: int | None = Field(default=None, ge=1, le=5)
    reflection: str | None = None


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
    satisfaction: int | None = Field(default=None, ge=1, le=5)
    reflection: str | None = None


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
    # Also server-computed: stamped whenever a reflection is written, cleared
    # when one is emptied. Not settable directly.
    reflected_at: datetime | None = None
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


# ---------- Growth (the "learn one grown-up thing" orb) ----------

class GrowthTipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    topic: str
    title: str
    body: str
    try_this: str | None = None
    created_at: datetime


class GrowthStatus(BaseModel):
    """Everything the orb needs to decide what to render before you click it.

    `configured` and the quota fields are separate concerns, same as the Google
    status shape: no API key on the server is a deployment matter the UI can
    only explain, whereas "configured but 25/25 used" is a normal state that
    deserves a real countdown rather than a broken-looking button.
    """
    configured: bool
    used_today: int
    daily_limit: int
    remaining: int
    # The most recent tip, so reopening the panel shows what you last got
    # instead of an empty box that implies you have to spend a request.
    latest: GrowthTipRead | None = None


# ---------- Period review (the week/month/year look-back) ----------

class CompletedTaskBrief(BaseModel):
    """One finished task as the review page lists it.

    Not TaskRead: this is a read-only recap, and shipping every task's
    subtasks, links and dependency graph to render a one-line row would be a
    lot of payload for a year's worth of work.
    """
    id: int
    title: str
    section_name: str
    completed_at: datetime | None = None
    satisfaction: int | None = None
    reflection: str | None = None


class PeriodSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    period: str
    period_start: date
    period_end: date
    label: str
    headline: str
    narrative: str
    themes: list[str] = []
    advice: str | None = None
    # How many completed tasks it was written from — compared against the live
    # count to work out whether it has fallen behind.
    task_count: int
    created_at: datetime


class PeriodReview(BaseModel):
    """Everything the look-back panel needs in one request.

    The completed-task list and the written summary are deliberately in the
    same response: reading what you finished is free and should never require
    spending a request, so the page is useful before the LLM is ever called.
    """
    period: str
    period_start: date
    period_end: date
    label: str
    completed: list[CompletedTaskBrief] = []
    # How many of those carry a reflection — what the summary has to work with.
    reflected_count: int = 0
    summary: PeriodSummaryRead | None = None
    # A summary exists but more has been finished since it was written.
    stale: bool = False
    configured: bool
    used_today: int
    daily_limit: int
    remaining: int


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
