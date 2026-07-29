from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/subsections", tags=["subsections"])


@router.patch("/{subsection_id}", response_model=schemas.SubsectionRead)
def update_subsection(
    subsection_id: int,
    subsection: schemas.SubsectionUpdate,
    db: Session = Depends(get_db),
):
    updated = crud.update_subsection(db, subsection_id, subsection)
    if not updated:
        raise HTTPException(status_code=404, detail="Subsection not found")
    return updated


@router.delete("/{subsection_id}", status_code=204)
def delete_subsection(subsection_id: int, db: Session = Depends(get_db)):
    if not crud.delete_subsection(db, subsection_id):
        raise HTTPException(status_code=404, detail="Subsection not found")
