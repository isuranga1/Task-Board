from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/sections", tags=["sections"])


@router.get("/", response_model=list[schemas.SectionRead])
def list_sections(db: Session = Depends(get_db)):
    return crud.get_sections(db)


@router.post("/", response_model=schemas.SectionRead, status_code=201)
def create_section(section: schemas.SectionCreate, db: Session = Depends(get_db)):
    return crud.create_section(db, section)


@router.patch("/{section_id}", response_model=schemas.SectionRead)
def update_section(
    section_id: int, section: schemas.SectionUpdate, db: Session = Depends(get_db)
):
    updated = crud.update_section(db, section_id, section)
    if not updated:
        raise HTTPException(status_code=404, detail="Section not found")
    return updated


@router.delete("/{section_id}", status_code=204)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    if not crud.delete_section(db, section_id):
        raise HTTPException(status_code=404, detail="Section not found")


@router.post(
    "/{section_id}/subsections",
    response_model=schemas.SubsectionRead,
    status_code=201,
)
def create_subsection(
    section_id: int,
    subsection: schemas.SubsectionCreate,
    db: Session = Depends(get_db),
):
    section = crud.get_section(db, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return crud.create_subsection(db, section_id, subsection)


@router.get("/{section_id}/tasks", response_model=list[schemas.TaskRead])
def list_tasks_for_section(section_id: int, db: Session = Depends(get_db)):
    section = crud.get_section(db, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return crud.get_tasks_for_section(db, section_id)
