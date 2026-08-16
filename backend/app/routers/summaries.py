from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import crud, schemas, summaries
from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/summaries", tags=["summaries"])


def _review(db: Session, period: str, ref: date | None) -> schemas.PeriodReview:
    """The whole panel's state for one window.

    Deliberately free: reading back what you finished never spends a request,
    so the page is useful the moment it opens and the LLM stays opt-in. Both
    endpoints below return this same shape — the only difference between them
    is whether a generation happens first.
    """
    start, end, label = summaries.period_bounds(period, ref or crud.utc_today())
    completed = crud.get_completed_tasks_between(db, start, end)
    summary = crud.get_latest_period_summary(db, period, start)
    used, limit = summaries.quota(db)

    return schemas.PeriodReview(
        period=period,
        period_start=start,
        period_end=end,
        label=label,
        completed=[
            schemas.CompletedTaskBrief(
                id=t.id,
                title=t.title,
                section_name=t.section.name if t.section else "Unfiled",
                completed_at=t.completed_at,
                satisfaction=t.satisfaction,
                reflection=t.reflection,
            )
            # Newest first: the review reads top-down as "most recently
            # finished", which is the opposite of the order the prompt wants.
            for t in reversed(completed)
        ],
        reflected_count=sum(1 for t in completed if (t.reflection or "").strip()),
        summary=summary,
        # More has been finished since this was written, so the page can offer
        # a refresh instead of showing a review that quietly omits last night.
        stale=bool(summary and summary.task_count != len(completed)),
        configured=settings.llm_configured,
        used_today=used,
        daily_limit=limit,
        remaining=max(0, limit - used),
    )


def _validate(period: str) -> str:
    if period not in summaries.PERIODS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown period '{period}'. Expected one of: {', '.join(summaries.PERIODS)}.",
        )
    return period


@router.get("/{period}", response_model=schemas.PeriodReview)
def get_review(
    period: str,
    ref: date | None = Query(
        None,
        description="Any date inside the window; defaults to today. Normalised to "
        "the containing week/month/year.",
    ),
    db: Session = Depends(get_db),
):
    """What you finished in this window, plus the written review if one exists."""
    return _review(db, _validate(period), ref)


@router.post("/{period}", response_model=schemas.PeriodReview)
def create_review(
    period: str,
    ref: date | None = Query(None, description="Any date inside the window; defaults to today."),
    db: Session = Depends(get_db),
):
    """Spend one of today's requests writing (or rewriting) this window's review.

    Returns the full review shape rather than just the summary so the caller
    gets the refreshed quota and staleness in the same round trip.
    """
    period = _validate(period)
    try:
        summaries.generate_summary(db, period, ref or crud.utc_today())
    except summaries.SummaryQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except summaries.NothingToSummarise as e:
        # 400, not 502: the request was fine, the period is simply empty.
        raise HTTPException(status_code=400, detail=str(e))
    except summaries.SummaryError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return _review(db, period, ref)
