"""The look-back — an LLM-written review of a week, a month, or a year.

The board is very good at telling you what is left. It is bad at telling you
what you did, which is the part that's easy to lose. This reads back the tasks
that actually reached Done inside a window, together with whatever you wrote in
each one's reflection when you finished it, and asks a model to say what that
adds up to.

The reflections are the whole point. Fed only a list of task titles, a model
writes a status report ("you completed 14 tasks across 3 areas"), which you
could already see on the Insights page. Fed the sentences you wrote about what
each one taught you, it can say something you didn't already know you'd said.

Two constraints shape everything below:

  * A review is a much bigger prompt than a Grow tip — potentially every task
    of a year. MAX_TASKS_IN_PROMPT caps that, keeping a single call's cost
    bounded no matter how much work a period holds.
  * Like growth.py, the daily budget is counted from rows in the table rather
    than an in-process counter, because this backend restarts on every deploy.
"""

import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import crud, llm, models
from .config import settings

logger = logging.getLogger(__name__)

PERIODS = ("week", "month", "year")

# Enough that a normal week or month arrives whole, and a heavy year arrives as
# its most recent 120 completions rather than as a prompt that costs real money
# and gets truncated by the model anyway. The count of what was left out is
# still given to the model, so it never claims the sample is the whole picture.
MAX_TASKS_IN_PROMPT = 120

# A reflection is meant to be a couple of sentences. Truncating a runaway one
# keeps a single task from crowding out the other forty in the same prompt.
MAX_REFLECTION_CHARS = 400

MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


# Anything that stopped a review being written, with a message fit to show a
# user. An alias rather than a subclass, for the same reason as growth.py's
# GrowthError: llm.chat_completion raises LLMError itself, and a subclass here
# would let every transport failure slip past the router's `except` and surface
# as a 500 instead of the 502 it should be.
SummaryError = llm.LLMError


class SummaryQuotaExceeded(SummaryError):
    """Today's review budget is spent — a limit, not a failure, so the router
    turns this into a 429 rather than a 502."""


class NothingToSummarise(SummaryError):
    """No task reached Done inside the window. Raised *before* any API call, so
    an empty week costs nothing; the router answers 400."""


def period_bounds(period: str, ref: date) -> tuple[date, date, str]:
    """The window `ref` falls inside, as (first day, last day, human label).

    Normalising to the containing window rather than counting back N days from
    `ref` is what makes the summary cacheable: every day of the same week has
    to resolve to the same Monday, or Tuesday's request would never find the
    review written on Monday and each visit would spend another generation.
    """
    if period == "week":
        start = ref - timedelta(days=ref.weekday())  # Monday
        end = start + timedelta(days=6)
        return start, end, f"Week of {start.day} {MONTHS[start.month - 1][:3]} {start.year}"

    if period == "month":
        start = ref.replace(day=1)
        # First of next month, minus a day — avoids hardcoding month lengths
        # and gets February right in a leap year for free.
        next_month = (
            start.replace(year=start.year + 1, month=1)
            if start.month == 12
            else start.replace(month=start.month + 1)
        )
        end = next_month - timedelta(days=1)
        return start, end, f"{MONTHS[start.month - 1]} {start.year}"

    if period == "year":
        start = date(ref.year, 1, 1)
        end = date(ref.year, 12, 31)
        return start, end, str(ref.year)

    raise ValueError(f"Unknown period {period!r}")


SYSTEM_PROMPT = """\
You write an honest, warm look back over a period of someone's work, from the \
tasks they actually finished and the notes they wrote about each one.

You are talking to the person who did the work. Use "you".

Rules:
- Ground everything in what you were given. Refer to real tasks by name. Never \
invent work, feelings, or details that aren't in the notes.
- The notes people wrote when finishing each task matter more than the task \
titles. Titles say what got done; notes say what it was worth. Lead with the \
notes where there are any.
- Look for the thread running through it — a skill that kept coming up, a kind \
of work they clearly enjoyed, something they got better at, a pattern in what \
drained them. That's the part they can't see themselves.
- Be truthful about a thin period. If little got finished, or nothing was \
reflected on, say so plainly and kindly. Do not inflate three tasks into a \
triumph; false praise makes the whole review worthless.
- No motivational filler, no "in today's fast-paced world", no corporate \
performance-review language.

Reply with ONLY a JSON object, no prose around it, in exactly this shape:
{"headline": "...", "narrative": "...", "themes": ["...", "..."], "advice": "..."}

- headline: one line capturing the period, under 80 characters, no trailing \
full stop.
- narrative: 2-4 short paragraphs, separated by blank lines. What you did, what \
it seems to have taught you, how it hung together.
- themes: 2-5 short phrases (2-4 words each) naming the threads you noticed.
- advice: one specific thing worth carrying into the next period, 1-2 \
sentences, grounded in what actually happened.\
"""


def _describe_task(task: models.Task) -> str:
    """One task as a line of the prompt: what it was, and what it was worth."""
    section = task.section.name if task.section else "Unfiled"
    when = task.completed_at.strftime("%d %b") if task.completed_at else "unknown date"
    line = f"- [{section}] {task.title} (finished {when})"

    if task.satisfaction is not None:
        line += f"\n  satisfaction: {task.satisfaction}/5"
    if task.reflection and task.reflection.strip():
        note = task.reflection.strip()
        if len(note) > MAX_REFLECTION_CHARS:
            note = note[:MAX_REFLECTION_CHARS].rstrip() + "…"
        # Collapse newlines so one multi-paragraph note can't visually swallow
        # the tasks after it in the prompt.
        note = " ".join(note.split())
        line += f"\n  what they said about it: {note}"
    return line


def _build_user_prompt(
    label: str, period: str, tasks: list[models.Task], total: int
) -> str:
    reflected = sum(1 for t in tasks if (t.reflection or "").strip())

    header = f"Period: {label} (one {period})\nTasks finished: {total}"
    if total > len(tasks):
        header += (
            f"\nShowing the {len(tasks)} most recent of them — say 'and more besides' "
            "rather than implying this is everything."
        )
    header += f"\nOf those shown, {reflected} have a note about what it was worth."
    if reflected == 0:
        header += (
            "\nNone of them were reflected on, so you only have titles to go on. "
            "Say what you can honestly say from that, and no more."
        )

    body = "\n".join(_describe_task(t) for t in tasks)
    return f"{header}\n\nWhat got finished:\n{body}\n\nWrite the look back."


def quota(db: Session) -> tuple[int, int]:
    """(used today, daily limit)."""
    return crud.count_period_summaries_today(db), settings.summary_daily_limit


def generate_summary(db: Session, period: str, ref: date):
    """Write and store one review of the window containing `ref`.

    Raises NothingToSummarise before spending anything if the period is empty,
    and SummaryQuotaExceeded if today's budget is gone.
    """
    if period not in PERIODS:
        raise ValueError(f"Unknown period {period!r}")

    if not settings.llm_configured:
        raise SummaryError(
            "Summaries aren't configured on the server — set OPENROUTER_API_KEY."
        )

    start, end, label = period_bounds(period, ref)
    tasks = crud.get_completed_tasks_between(db, start, end)
    if not tasks:
        raise NothingToSummarise(
            f"Nothing was finished in {label}, so there's nothing to look back on yet."
        )

    used, limit = quota(db)
    if used >= limit:
        raise SummaryQuotaExceeded(
            f"That's all {limit} summaries for today. The counter resets at midnight UTC."
        )

    # Newest first when trimming: a year's review is better served by what you
    # just did than by what you did last January.
    sample = tasks[-MAX_TASKS_IN_PROMPT:]

    content = llm.chat_completion(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _build_user_prompt(label, period, sample, len(tasks)),
            },
        ],
        x_title="Task Dashboard Review",
        # Cooler than the Grow orb: this one is reporting on real events, and
        # the failure mode to avoid is embellishment, not repetition.
        temperature=0.6,
        max_tokens=1200,
    )
    parsed = llm.extract_json(content)

    headline = (parsed.get("headline") or "").strip()
    narrative = (parsed.get("narrative") or "").strip()
    if not headline or not narrative:
        raise SummaryError("The model's reply was missing the summary itself. Try again.")

    raw_themes = parsed.get("themes")
    themes = (
        [str(t).strip() for t in raw_themes if str(t).strip()][:5]
        if isinstance(raw_themes, list)
        else []
    )

    # Written only once the reply has actually arrived and parsed, so the same
    # as growth.py: a network blip or a malformed response costs no quota.
    summary = crud.create_period_summary(
        db,
        period=period,
        period_start=start,
        period_end=end,
        label=label,
        headline=headline,
        narrative=narrative,
        themes=themes,
        advice=(parsed.get("advice") or "").strip() or None,
        task_count=len(tasks),
        model=settings.openrouter_model,
    )
    logger.info("Period summary #%s written for %s (%s tasks)", summary.id, label, len(tasks))
    return summary
