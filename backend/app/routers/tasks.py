import os
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


# Declared before "/{task_id}" purely for readability — FastAPI matches the
# literal "/" path first regardless, since "{task_id}" needs a non-empty segment.
@router.get("/", response_model=list[schemas.TaskRead])
def list_all_tasks(
    due_from: date | None = Query(None, description="Only tasks due on/after this date"),
    due_to: date | None = Query(None, description="Only tasks due on/before this date"),
    db: Session = Depends(get_db),
):
    """Every task in every section — what the Deadlines and Calendar views read.

    The per-section board keeps using /sections/{id}/tasks; this exists because
    both cross-section views need one list they can group by section themselves.
    """
    return crud.get_all_tasks(db, due_from=due_from, due_to=due_to)


@router.post("/", response_model=schemas.TaskRead, status_code=201)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    section = crud.get_section(db, task.section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return crud.create_task(db, task)


@router.get("/{task_id}", response_model=schemas.TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=schemas.TaskRead)
def update_task(task_id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db)):
    updated = crud.update_task(db, task_id, task)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")


# ---------- Subtasks (nested under a task) ----------

@router.post(
    "/{task_id}/subtasks", response_model=schemas.SubtaskRead, status_code=201
)
def create_subtask(
    task_id: int, subtask: schemas.SubtaskCreate, db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return crud.create_subtask(db, task_id, subtask)


@router.patch("/subtasks/{subtask_id}", response_model=schemas.SubtaskRead)
def update_subtask(
    subtask_id: int, subtask: schemas.SubtaskUpdate, db: Session = Depends(get_db)
):
    updated = crud.update_subtask(db, subtask_id, subtask)
    if not updated:
        raise HTTPException(status_code=404, detail="Subtask not found")
    return updated


@router.delete("/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    if not crud.delete_subtask(db, subtask_id):
        raise HTTPException(status_code=404, detail="Subtask not found")


# ---------- Dependencies (blocking relationships) ----------

@router.post("/{task_id}/dependencies", response_model=schemas.TaskRead)
def add_dependency(task_id: int, depends_on_id: int, db: Session = Depends(get_db)):
    try:
        updated = crud.add_dependency(db, task_id, depends_on_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


@router.delete("/{task_id}/dependencies/{depends_on_id}", response_model=schemas.TaskRead)
def remove_dependency(task_id: int, depends_on_id: int, db: Session = Depends(get_db)):
    updated = crud.remove_dependency(db, task_id, depends_on_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


# ---------- Attachments (files stored on disk, referenced from task_metadata) ----------

@router.post("/{task_id}/attachments", response_model=schemas.TaskRead)
async def upload_attachment(
    task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_size_mb}MB limit",
        )

    uploads_path = Path(settings.uploads_dir)
    uploads_path.mkdir(parents=True, exist_ok=True)

    # Prefix with a UUID so two different tasks' "report.pdf" never collide
    # on disk, while keeping the original filename visible/readable.
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    dest = uploads_path / safe_name
    with open(dest, "wb") as f:
        f.write(contents)

    attachment = {
        "filename": safe_name,
        "url": f"/uploads/{safe_name}",
        "size": len(contents),
        "content_type": file.content_type or "application/octet-stream",
    }
    return crud.add_attachment(db, task_id, attachment)


@router.delete("/{task_id}/attachments/{filename}", response_model=schemas.TaskRead)
def delete_attachment(task_id: int, filename: str, db: Session = Depends(get_db)):
    updated = crud.remove_attachment(db, task_id, filename)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    # Best-effort file cleanup — the DB record is the source of truth, so a
    # failure to delete the physical file shouldn't fail the whole request.
    file_path = Path(settings.uploads_dir) / filename
    if file_path.exists():
        os.remove(file_path)
    return updated
