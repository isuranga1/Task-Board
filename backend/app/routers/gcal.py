from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .. import crud, gcal, schemas
from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/gcal", tags=["google-calendar"])


@router.get("/status", response_model=schemas.GoogleCalendarStatus)
def get_status(db: Session = Depends(get_db)):
    """What the Calendar page polls on load to decide between
    "not configured" / "Connect" / the calendar tick-list."""
    cred = crud.get_google_credential(db)
    if not cred:
        return schemas.GoogleCalendarStatus(
            configured=settings.google_configured, connected=False
        )

    # Listing calendars is also the cheapest liveness check on the stored
    # tokens — if the grant was revoked from the Google side, this is where we
    # find out, and the page gets a real message instead of an empty month.
    try:
        calendars = gcal.list_calendars(db)
        error = None
    except gcal.GoogleCalendarError as e:
        calendars, error = [], str(e)

    return schemas.GoogleCalendarStatus(
        configured=settings.google_configured,
        connected=True,
        account_email=cred.account_email,
        calendars=calendars,
        selected_calendar_ids=cred.selected_calendar_ids or [],
        error=error,
    )


@router.get("/auth-url")
def get_auth_url():
    """The consent URL for the frontend to send the browser to.

    Returned as JSON rather than a 302 from here because the caller is fetch(),
    and a redirect to accounts.google.com would be an opaque CORS failure
    instead of a page the user can actually interact with.
    """
    try:
        return {"url": gcal.build_auth_url()}
    except gcal.GoogleCalendarError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/callback")
def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Where Google sends the browser back to after consent.

    Always ends in a redirect to the frontend, success or failure — this is a
    real browser navigation, so a JSON error body would leave the user staring
    at raw text on the API's origin with no way back.
    """
    base = settings.frontend_url.rstrip("/")

    if error:
        return RedirectResponse(f"{base}/?gcal=error&reason={error}")
    if not code or not state:
        return RedirectResponse(f"{base}/?gcal=error&reason=missing_code")

    try:
        gcal.exchange_code(db, code, state)
    except gcal.GoogleCalendarError as e:
        return RedirectResponse(f"{base}/?gcal=error&reason={e}")

    return RedirectResponse(f"{base}/?gcal=connected")


@router.put("/calendars", response_model=schemas.GoogleCalendarStatus)
def set_calendars(
    selection: schemas.GoogleCalendarSelection, db: Session = Depends(get_db)
):
    """Persist which calendars are ticked, so the choice survives a reload
    and applies on whatever device you open the board from next."""
    if not crud.set_selected_calendars(db, selection.calendar_ids):
        raise HTTPException(status_code=404, detail="Google Calendar isn't connected")
    return get_status(db)


@router.get("/events", response_model=list[schemas.GoogleEvent])
def list_events(
    start: datetime = Query(..., description="Window start (ISO 8601)"),
    end: datetime = Query(..., description="Window end (ISO 8601)"),
    db: Session = Depends(get_db),
):
    """Events between `start` and `end` from the ticked calendars.

    Returns an empty list rather than a 4xx when Google isn't connected: the
    calendar page renders task deadlines regardless, and a missing Google
    connection isn't an error condition for that page — it's the default state.
    """
    if not crud.get_google_credential(db):
        return []

    # Naive datetimes would make Google's timeMin/timeMax ambiguous; assume UTC,
    # which is what the frontend sends (it builds the window with toISOString()).
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    try:
        return gcal.list_events(db, time_min=start, time_max=end)
    except gcal.GoogleCalendarError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/connection", status_code=204)
def disconnect(db: Session = Depends(get_db)):
    if not gcal.disconnect(db):
        raise HTTPException(status_code=404, detail="Google Calendar isn't connected")
