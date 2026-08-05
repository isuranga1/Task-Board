from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from datetime import date, datetime, timezone

from . import models, schemas


# ---------- Sections ----------

def get_sections(db: Session) -> list[models.Section]:
    stmt = select(models.Section).options(
        selectinload(models.Section.subsections)
    ).order_by(models.Section.position, models.Section.id)
    return db.execute(stmt).scalars().all()


def get_section(db: Session, section_id: int) -> models.Section | None:
    return db.get(models.Section, section_id)


def create_section(db: Session, section: schemas.SectionCreate) -> models.Section:
    # New sections always go at the end, regardless of whatever `position`
    # the payload happened to carry — the UI never lets a person set it
    # explicitly on create, only via drag-to-reorder afterwards.
    max_position = db.execute(select(func.max(models.Section.position))).scalar()
    data = section.model_dump(exclude={"position"})
    db_section = models.Section(**data, position=(max_position or 0) + 1)
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    return db_section


def update_section(
    db: Session, section_id: int, section: schemas.SectionUpdate
) -> models.Section | None:
    db_section = db.get(models.Section, section_id)
    if not db_section:
        return None
    for key, value in section.model_dump(exclude_unset=True).items():
        setattr(db_section, key, value)
    db.commit()
    db.refresh(db_section)
    return db_section


def delete_section(db: Session, section_id: int) -> bool:
    db_section = db.get(models.Section, section_id)
    if not db_section:
        return False
    db.delete(db_section)
    db.commit()
    return True


# ---------- Subsections ----------

def create_subsection(
    db: Session, section_id: int, subsection: schemas.SubsectionCreate
) -> models.Subsection:
    # Same reasoning as create_section: always append to the end of this
    # section's groups, ignoring whatever `position` the payload carried.
    max_position = db.execute(
        select(func.max(models.Subsection.position)).where(
            models.Subsection.section_id == section_id
        )
    ).scalar()
    data = subsection.model_dump(exclude={"position"})
    db_subsection = models.Subsection(
        section_id=section_id, **data, position=(max_position or 0) + 1
    )
    db.add(db_subsection)
    db.commit()
    db.refresh(db_subsection)
    return db_subsection


def update_subsection(
    db: Session, subsection_id: int, subsection: schemas.SubsectionUpdate
) -> models.Subsection | None:
    db_subsection = db.get(models.Subsection, subsection_id)
    if not db_subsection:
        return None
    for key, value in subsection.model_dump(exclude_unset=True).items():
        setattr(db_subsection, key, value)
    db.commit()
    db.refresh(db_subsection)
    return db_subsection


def delete_subsection(db: Session, subsection_id: int) -> bool:
    db_subsection = db.get(models.Subsection, subsection_id)
    if not db_subsection:
        return False
    db.delete(db_subsection)
    db.commit()
    return True


# ---------- Tasks ----------

def get_tasks_for_section(db: Session, section_id: int) -> list[models.Task]:
    stmt = (
        select(models.Task)
        .where(models.Task.section_id == section_id)
        .options(
            selectinload(models.Task.subtasks),
            selectinload(models.Task.depends_on),
            selectinload(models.Task.blocks),
        )
        .order_by(models.Task.created_at)
    )
    return db.execute(stmt).scalars().all()


def get_all_tasks(
    db: Session,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list[models.Task]:
    """Every task across every section, for the deadline list and calendar.

    Sorted so undated tasks land last: Postgres puts NULLs first on an ASC
    sort by default, which would bury the actually-urgent dated tasks under
    everything that has no deadline at all.

    The date window is optional and only ever narrows dated tasks — a request
    for "this month" still returns undated tasks, because the calendar's
    "no deadline" bucket needs them regardless of which month is on screen.
    """
    stmt = select(models.Task).options(
        selectinload(models.Task.subtasks),
        selectinload(models.Task.depends_on),
        selectinload(models.Task.blocks),
    )
    if due_from is not None:
        stmt = stmt.where(
            (models.Task.due_date.is_(None)) | (models.Task.due_date >= due_from)
        )
    if due_to is not None:
        stmt = stmt.where(
            (models.Task.due_date.is_(None)) | (models.Task.due_date <= due_to)
        )
    stmt = stmt.order_by(
        models.Task.due_date.asc().nullslast(), models.Task.created_at
    )
    return db.execute(stmt).scalars().all()


def get_task(db: Session, task_id: int) -> models.Task | None:
    stmt = (
        select(models.Task)
        .where(models.Task.id == task_id)
        .options(
            selectinload(models.Task.subtasks),
            selectinload(models.Task.depends_on),
            selectinload(models.Task.blocks),
        )
    )
    return db.execute(stmt).scalar_one_or_none()


def create_task(db: Session, task: schemas.TaskCreate) -> models.Task:
    data = task.model_dump()
    data["task_metadata"] = data.pop("task_metadata")  # already a plain dict via model_dump
    # Tasks are almost always created as "todo", but handle the rare case of
    # creating one already in progress/done so the time-tracking badges have
    # something sane to show from the start.
    if data.get("status") == schemas.TaskStatus.in_progress:
        data["started_at"] = datetime.now(timezone.utc)
    elif data.get("status") == schemas.TaskStatus.done:
        data["completed_at"] = datetime.now(timezone.utc)
    db_task = models.Task(**data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task(
    db: Session, task_id: int, task: schemas.TaskUpdate
) -> models.Task | None:
    db_task = db.get(models.Task, task_id)
    if not db_task:
        return None
    update_data = task.model_dump(exclude_unset=True)
    if "task_metadata" in update_data and update_data["task_metadata"] is not None:
        update_data["task_metadata"] = update_data["task_metadata"]

    # Time tracking: `started_at` marks the most recent time this task
    # entered "in_progress" (re-entering restarts the clock), and
    # `completed_at` marks when it most recently reached "done". Together
    # they let the UI show a live "time in doing" badge and, once both are
    # set, a "took Xh Ym" badge — without the person ever touching a timer.
    new_status = update_data.get("status")
    if new_status is not None and new_status != db_task.status:
        now = datetime.now(timezone.utc)
        if new_status == models.TaskStatus.in_progress:
            update_data["started_at"] = now
            update_data["completed_at"] = None
        elif new_status == models.TaskStatus.done:
            update_data["completed_at"] = now
        else:
            update_data["completed_at"] = None

    for key, value in update_data.items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: int) -> bool:
    db_task = db.get(models.Task, task_id)
    if not db_task:
        return False
    db.delete(db_task)
    db.commit()
    return True


# ---------- Subtasks ----------

def create_subtask(
    db: Session, task_id: int, subtask: schemas.SubtaskCreate
) -> models.Subtask:
    db_subtask = models.Subtask(task_id=task_id, **subtask.model_dump())
    db.add(db_subtask)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask


def update_subtask(
    db: Session, subtask_id: int, subtask: schemas.SubtaskUpdate
) -> models.Subtask | None:
    db_subtask = db.get(models.Subtask, subtask_id)
    if not db_subtask:
        return None
    for key, value in subtask.model_dump(exclude_unset=True).items():
        setattr(db_subtask, key, value)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask


def delete_subtask(db: Session, subtask_id: int) -> bool:
    db_subtask = db.get(models.Subtask, subtask_id)
    if not db_subtask:
        return False
    db.delete(db_subtask)
    db.commit()
    return True


# ---------- Task dependencies (blocking relationships) ----------

def add_dependency(db: Session, task_id: int, depends_on_id: int) -> models.Task | None:
    if task_id == depends_on_id:
        raise ValueError("A task cannot depend on itself")

    task = get_task(db, task_id)
    depends_on_task = db.get(models.Task, depends_on_id)
    if not task or not depends_on_task:
        return None

    # Prevent an immediate two-task cycle (A depends on B, B depends on A).
    # This is a shallow check, not full cycle detection across a longer
    # chain — good enough for a personal task tool, and cheap to compute.
    if task in depends_on_task.depends_on:
        raise ValueError("That would create a circular dependency")

    if depends_on_task not in task.depends_on:
        task.depends_on.append(depends_on_task)
        db.commit()
        db.refresh(task)
    return task


def remove_dependency(db: Session, task_id: int, depends_on_id: int) -> models.Task | None:
    task = get_task(db, task_id)
    depends_on_task = db.get(models.Task, depends_on_id)
    if not task or not depends_on_task:
        return None
    if depends_on_task in task.depends_on:
        task.depends_on.remove(depends_on_task)
        db.commit()
        db.refresh(task)
    return task


# ---------- Attachments (stored in task_metadata JSONB, files on disk) ----------

def add_attachment(db: Session, task_id: int, attachment: dict) -> models.Task | None:
    task = db.get(models.Task, task_id)
    if not task:
        return None
    # JSONB columns don't auto-detect in-place mutation in SQLAlchemy, so we
    # reassign the whole dict (rather than task.task_metadata["attachments"].append(...))
    # to guarantee the ORM notices the change and includes it in the UPDATE.
    metadata = dict(task.task_metadata or {})
    attachments = list(metadata.get("attachments", []))
    attachments.append(attachment)
    metadata["attachments"] = attachments
    task.task_metadata = metadata
    db.commit()
    db.refresh(task)
    return task


def remove_attachment(db: Session, task_id: int, filename: str) -> models.Task | None:
    task = db.get(models.Task, task_id)
    if not task:
        return None
    metadata = dict(task.task_metadata or {})
    attachments = [a for a in metadata.get("attachments", []) if a.get("filename") != filename]
    metadata["attachments"] = attachments
    task.task_metadata = metadata
    db.commit()
    db.refresh(task)
    return task


# ---------- Google Calendar credentials ----------
#
# There's only ever one row (id=1). The app has no user accounts, so being
# connected to Google is a property of the deployment — pinning the primary key
# means "connect" is idempotent and can never leave two half-configured rows
# behind if a consent flow is completed twice.

GOOGLE_CREDENTIAL_ID = 1


def get_google_credential(db: Session) -> models.GoogleCredential | None:
    return db.get(models.GoogleCredential, GOOGLE_CREDENTIAL_ID)


def upsert_google_credential(db: Session, **fields) -> models.GoogleCredential:
    cred = db.get(models.GoogleCredential, GOOGLE_CREDENTIAL_ID)
    if cred is None:
        cred = models.GoogleCredential(id=GOOGLE_CREDENTIAL_ID, **fields)
        db.add(cred)
    else:
        for key, value in fields.items():
            setattr(cred, key, value)
    db.commit()
    db.refresh(cred)
    return cred


def set_selected_calendars(db: Session, calendar_ids: list[str]) -> models.GoogleCredential | None:
    cred = get_google_credential(db)
    if not cred:
        return None
    cred.selected_calendar_ids = list(calendar_ids)  # reassign so the ORM sees the JSONB change
    db.commit()
    db.refresh(cred)
    return cred


def delete_google_credential(db: Session) -> bool:
    cred = get_google_credential(db)
    if not cred:
        return False
    db.delete(cred)
    db.commit()
    return True


# ---------- Analytics ----------

def get_analytics(db: Session, section_id: int | None = None) -> dict:
    task_query = select(models.Task)
    if section_id is not None:
        task_query = task_query.where(models.Task.section_id == section_id)
    tasks = db.execute(task_query).scalars().all()

    total = len(tasks)
    by_status = {"todo": 0, "in_progress": 0, "done": 0}
    by_priority = {"low": 0, "medium": 0, "high": 0, "urgent": 0}
    overdue = 0
    today = date.today()

    for t in tasks:
        by_status[t.status.value] += 1
        by_priority[t.priority.value] += 1
        if t.due_date and t.due_date < today and t.status != models.TaskStatus.done:
            overdue += 1

    subtask_query = select(models.Subtask).join(models.Task)
    if section_id is not None:
        subtask_query = subtask_query.where(models.Task.section_id == section_id)
    subtasks = db.execute(subtask_query).scalars().all()
    subtasks_done = sum(1 for s in subtasks if s.is_done)

    # Completion trend: tasks marked done, grouped by the day they were last
    # updated — a rough but useful proxy for "how many tasks finished per day"
    # without needing a separate completed_at timestamp/history table.
    completed_by_day: dict[str, int] = {}
    for t in tasks:
        if t.status == models.TaskStatus.done:
            day = t.updated_at.date().isoformat()
            completed_by_day[day] = completed_by_day.get(day, 0) + 1

    return {
        "total_tasks": total,
        "by_status": by_status,
        "by_priority": by_priority,
        "completion_rate": round(by_status["done"] / total, 3) if total else 0,
        "overdue_count": overdue,
        "subtasks_total": len(subtasks),
        "subtasks_done": subtasks_done,
        "completed_by_day": completed_by_day,
    }
