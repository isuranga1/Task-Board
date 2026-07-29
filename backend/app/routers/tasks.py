from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


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
