"""The Grow orb's brain — one LLM-written nudge toward a grown-up skill.

The idea: a board full of tasks is all *obligation*. This is the opposite — a
button that hands you one small, concrete thing a capable adult benefits from
understanding (what a car's engine is actually doing, how an index fund differs
from a savings account, why bread needs salt), plus something you can go do
about it this week. Curiosity, not another to-do.

The OpenRouter call itself lives in llm.py, shared with the period review in
summaries.py.

Two things are load-bearing and worth not "simplifying" later:

  * The daily cap is enforced by counting rows in `growth_tips`, not by an
    in-process counter. This backend restarts on every deploy; an in-memory
    tally would silently reset the budget several times a day.
  * The last handful of titles are fed back into the prompt. Without that, a
    model asked the same open question twenty times converges hard on the same
    five suggestions (it will recommend you learn to check your tyre pressure
    over and over) and the orb stops being interesting by day two.
"""

import logging
import random

from sqlalchemy.orm import Session

from . import crud, llm
from .config import settings

logger = logging.getLogger(__name__)

# Kept as a name in this module because the routers catch `growth.GrowthError`.
# Aliasing rather than subclassing is deliberate: llm.chat_completion raises
# LLMError directly, and a subclass here would let those escape the router's
# `except` and surface as 500s instead of the 502 they should be.
GrowthError = llm.LLMError


class GrowthQuotaExceeded(GrowthError):
    """Today's request budget is spent. Distinct from GrowthError because the
    router turns it into a 429, not a 502 — it isn't a failure, it's a limit."""


# ---------- Topics ----------
#
# Picking the area *here* rather than asking the model to choose is what keeps
# the orb broad. Left to its own devices an LLM answers "teach me something
# grown-up" with personal finance almost every time; rotating the topic in the
# prompt is the cheapest way to get a car engine one day and sourdough the next.

TOPICS = [
    "How things work — engines, motors, appliances, the machines you rely on",
    "Money & finance — saving, investing, credit, insurance, reading a payslip",
    "Home & repairs — plumbing, electrics, tools, maintenance you can do yourself",
    "Cooking & food — technique, ingredients, why a recipe does what it does",
    "Health & the body — fitness, sleep, nutrition, understanding a check-up",
    "Paperwork & the system — taxes, contracts, warranties, official processes",
    "People & communication — negotiation, conflict, listening, difficult conversations",
    "Safety & emergencies — first aid, fire, road sense, what to do when it goes wrong",
    "Making & fixing — hand tools, materials, DIY, taking something apart to see inside",
    "Civics & society — how laws, elections, councils, and public institutions actually run",
    "Technology & digital life — security, privacy, backups, understanding your own devices",
    "Work & craft — professional judgement, reputation, doing a job properly",
    "Mind & habits — attention, discipline, handling failure, thinking clearly",
    "Culture & taste — music, film, architecture, learning to notice what's good",
    "Nature & the outdoors — weather, plants, navigation, seasons",
    "Cars & driving — ownership, servicing, what the warning lights mean",
    "Travel & getting around — planning, transport systems, being competent somewhere new",
    "History & context — how the modern world got the shape it has",
]

SYSTEM_PROMPT = """\
You write short, curiosity-sparking nudges that help a capable young adult grow \
into a more knowledgeable, more competent human being.

Rules:
- Suggest ONE specific thing worth understanding or experiencing. Not a vague \
theme ("learn about money") but a real, concrete one ("find out what your \
payslip's tax code actually means").
- Favour things a person can meet in ordinary daily life — at home, on the \
street, in a shop, with their own car, phone, body, or kitchen.
- Explain it like an interesting friend would, not like a textbook or a \
self-help book. No motivational filler, no "in today's fast-paced world".
- The action must be genuinely doable in under an hour, with no special \
equipment or spending.
- Never suggest anything unsafe to attempt alone (live mains electricity, gas \
work, structural work, anything needing a licence). Understanding how those \
work is fine; doing them yourself is not.

Reply with ONLY a JSON object, no prose around it, in exactly this shape:
{"title": "...", "body": "...", "try_this": "..."}

- title: the thing to learn, under 70 characters, no trailing full stop.
- body: 2-3 sentences on what it is and why knowing it makes you more capable.
- try_this: one concrete action, 1-2 sentences, starting with a verb.\
"""


def _pick_topic(recent_topics: list[str]) -> str:
    """A topic that hasn't come up in the last few tips, when one is available.

    Sampling with exclusions rather than cycling the list in order: a strict
    rotation is predictable enough that you'd learn the sequence, and with 18
    topics against a 25/day ceiling the exclusion set never empties the pool.
    """
    avoid = set(recent_topics[:6])
    pool = [t for t in TOPICS if t not in avoid] or TOPICS
    return random.choice(pool)


def _build_user_prompt(topic: str, recent_titles: list[str]) -> str:
    prompt = f"Topic for this one: {topic}\n\nGive me one thing worth learning in that area."
    if recent_titles:
        already = "\n".join(f"- {t}" for t in recent_titles)
        prompt += (
            "\n\nI have already been given these, so pick something clearly "
            f"different:\n{already}"
        )
    return prompt


def quota(db: Session) -> tuple[int, int]:
    """(used today, daily limit)."""
    return crud.count_growth_tips_today(db), settings.growth_daily_limit


def generate_tip(db: Session):
    """Produce and store one tip. Raises GrowthQuotaExceeded when today's spent."""
    if not settings.llm_configured:
        raise GrowthError(
            "The Grow orb isn't configured on the server — set OPENROUTER_API_KEY."
        )

    used, limit = quota(db)
    if used >= limit:
        raise GrowthQuotaExceeded(
            f"That's all {limit} for today. The counter resets at midnight UTC."
        )

    recent = crud.get_recent_growth_tips(db, limit=12)
    topic = _pick_topic([t.topic for t in recent])

    content = llm.chat_completion(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(topic, [t.title for t in recent])},
        ],
        x_title="Task Dashboard Grow",
        # Warm enough to give genuinely different suggestions across a day's
        # worth of clicks; not so warm it invents facts about how an
        # alternator works.
        temperature=0.9,
        max_tokens=500,
    )
    parsed = llm.extract_json(content)

    title = (parsed.get("title") or "").strip()
    body = (parsed.get("body") or "").strip()
    if not title or not body:
        raise GrowthError("The model's reply was missing a title or explanation. Try again.")

    # Note where the row is written relative to the call above: the quota is
    # only spent on a tip that actually arrived. A network blip or a bad reply
    # costs you nothing, which matters a lot when the daily budget is 25 and
    # not, say, thousands. The trade is that repeated *failures* can each hit
    # the API, so a hard outage could exceed 25 attempts in a day — acceptable,
    # because failed calls aren't billed, and the alternative (charging quota
    # for errors) makes a flaky evening eat the whole day's budget.
    tip = crud.create_growth_tip(
        db,
        topic=topic,
        title=title,
        body=body,
        try_this=(parsed.get("try_this") or "").strip() or None,
        model=settings.openrouter_model,
    )
    logger.info("Growth tip #%s generated (%s)", tip.id, topic.split(" —")[0])
    return tip
