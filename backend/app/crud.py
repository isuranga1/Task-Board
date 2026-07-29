from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from . import models, schemas


# ---------- Sections ----------

def get_sections(db: Session) -> list[models.Section]:
    stmt = select(models.Section).options(
        selectinload(models.Section.subsections)
    ).order_by(models.Section.id)
    return db.execute(stmt).scalars().all()


def get_section(db: Session, section_id: int) -> models.Section | None:
    return db.get(models.Section, section_id)


def create_section(db: Session, section: schemas.SectionCreate) -> models.Section:
    db_section = models.Section(**section.model_dump())
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
    db_subsection = models.Subsection(section_id=section_id, **subsection.model_dump())
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
        .options(selectinload(models.Task.subtasks))
        .order_by(models.Task.created_at)
    )
    return db.execute(stmt).scalars().all()


def get_task(db: Session, task_id: int) -> models.Task | None:
    stmt = (
        select(models.Task)
        .where(models.Task.id == task_id)
        .options(selectinload(models.Task.subtasks))
    )
    return db.execute(stmt).scalar_one_or_none()


def create_task(db: Session, task: schemas.TaskCreate) -> models.Task:
    data = task.model_dump()
    data["task_metadata"] = data.pop("task_metadata")  # already a plain dict via model_dump
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
