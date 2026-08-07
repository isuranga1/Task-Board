from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import crud, growth, schemas
from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/growth", tags=["growth"])


def _status(db: Session) -> schemas.GrowthStatus:
    used, limit = growth.quota(db)
    recent = crud.get_recent_growth_tips(db, limit=1)
    return schemas.GrowthStatus(
        configured=settings.growth_configured,
        used_today=used,
        daily_limit=limit,
        # max(0, ...) so lowering GROWTH_DAILY_LIMIT below what's already been
        # used today shows "0 left" rather than a negative countdown.
        remaining=max(0, limit - used),
        latest=recent[0] if recent else None,
    )


@router.get("/status", response_model=schemas.GrowthStatus)
def get_status(db: Session = Depends(get_db)):
    """What the orb loads on mount: whether it's usable, how many requests are
    left today, and the last tip so reopening the panel costs nothing."""
    return _status(db)


@router.post("/tip", response_model=schemas.GrowthTipRead)
def create_tip(db: Session = Depends(get_db)):
    """Spend one of today's requests on a fresh tip.

    429 rather than 400 for an exhausted quota: it's the status that means
    "correct request, come back later", and it lets the frontend tell a spent
    budget apart from a real failure without string-matching the message.
    """
    try:
        return growth.generate_tip(db)
    except growth.GrowthQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except growth.GrowthError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/tips", response_model=list[schemas.GrowthTipRead])
def list_tips(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Previously generated tips, newest first — reading history is free."""
    return crud.get_recent_growth_tips(db, limit=limit)
