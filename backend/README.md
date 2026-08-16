# Task Dashboard — Backend

FastAPI + SQLAlchemy + Alembic + PostgreSQL.

## Setup

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Edit `.env` and put your real Postgres credentials (create the DB and user first,
see the main setup guide — `CREATE DATABASE`, `CREATE USER`, `GRANT` commands).

## Run migrations

```powershell
alembic upgrade head
```

This creates all 4 tables (`sections`, `subsections`, `tasks`, `subtasks`) matching
`app/models.py`. Whenever you change a model, generate a new migration instead of
hand-editing the DB:

```powershell
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

## Run the API

```powershell
uvicorn app.main:app --reload --port 8000
```

Then open **http://localhost:8000/docs** — FastAPI's interactive Swagger UI, where
you can try every endpoint by hand before the frontend even exists.

## Endpoints (verified working)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/sections/` | list / create sections (Jobs, Music, Guitar...) |
| PATCH/DELETE | `/sections/{id}` | edit / delete a section |
| POST | `/sections/{id}/subsections` | add a subsection to a section |
| GET | `/sections/{id}/tasks` | all tasks in a section |
| PATCH/DELETE | `/subsections/{id}` | edit / delete a subsection |
| POST | `/tasks/` | create a task (needs `section_id`) |
| GET/PATCH/DELETE | `/tasks/{id}` | read / partial-update / delete a task |
| POST | `/tasks/{id}/subtasks` | add a subtask |
| PATCH/DELETE | `/tasks/subtasks/{id}` | edit / delete a subtask (e.g. toggle `is_done`) |

**Drag-and-drop tip:** moving a card between Todo/In Progress/Done from the frontend
is just `PATCH /tasks/{id}` with `{"status": "in_progress"}` — you don't need to
resend the whole task object, only changed fields.

## Notes on the `task_metadata` JSONB field

This is where links, tags, and anything you invent later live, without needing a
migration each time:

```json
{
  "links": [{"label": "PR", "url": "https://github.com/..."}],
  "tags": ["Evaluations"],
  "assignee_avatar_url": "https://..."
}
```

`schemas.py`'s `TaskMetadata` model has `extra="allow"`, so you can throw new keys
in from the frontend immediately and formalize them into typed fields later once
you know you'll actually reuse them.

## New endpoints (dependencies, attachments, analytics)

| Method | Path | Purpose |
|---|---|---|
| POST | `/tasks/{id}/dependencies?depends_on_id={id}` | mark this task as depending on another |
| DELETE | `/tasks/{id}/dependencies/{depends_on_id}` | remove a dependency |
| POST | `/tasks/{id}/attachments` | upload a file (multipart form, field name `file`) |
| DELETE | `/tasks/{id}/attachments/{filename}` | delete an uploaded file |
| GET | `/analytics/summary?section_id=` (optional) | completion stats, priority breakdown, overdue count |

**Dependencies** are self-referential: a task's `depends_on` list and `blocks` list
are two sides of the same relationship — adding "A depends on B" automatically makes
B's `blocks` list include A, with no separate API call needed. A shallow check
rejects an immediate two-task cycle (A depends on B, B depends on A), though it
won't catch a longer chain (A→B→C→A) — good enough for a personal tool, not a full
graph-cycle solver.

**Attachments** are stored as actual files on disk under `uploads/` (configurable
via `UPLOADS_DIR` in `.env`), served back through a static mount at `/uploads/...`.
Only the filename/size/type metadata lives in Postgres's `task_metadata` JSONB
column — the file bytes themselves never touch the database.

## Reflections and the look-back

| Method | Path | Purpose |
|---|---|---|
| GET | `/summaries/{period}?ref=` (optional) | what you finished in a week/month/year, plus the written review if there is one — **free** |
| POST | `/summaries/{period}?ref=` (optional) | write (or rewrite) that review — costs one of the day's generations |

`{period}` is `week`, `month` or `year`; anything else is a 404. `ref` is any
date inside the window and defaults to today — the server normalises it to the
containing Monday / 1st / Jan 1, which is what makes a summary cacheable rather
than one-per-day-you-happened-to-ask.

**Reflections** live on the task itself (`satisfaction` 1-5, `reflection` text),
set through the ordinary `PATCH /tasks/{id}`. `reflected_at` is server-computed,
exactly like `started_at`/`completed_at`: writing either field stamps it,
clearing both clears it. Moving a task *out* of done deliberately leaves the
reflection alone — what you learned doesn't stop being true because the task
reopened.

The POST is the only endpoint here that spends money. It refuses with **400**
before making any API call if nothing was completed in the window, **429** once
the day's `SUMMARY_DAILY_LIMIT` is used up, and **502** if OpenRouter itself
fails. A failed call writes no row, so it costs no quota.

## Email reminders — requires SMTP configuration

Add these to your `.env` to enable them (all optional — if left blank, the
reminder scheduler still runs but silently skips sending, logging a warning
instead of crashing):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=you@gmail.com
REMINDER_TO_EMAIL=you@gmail.com
```

**If using Gmail**: you need an "App Password", not your regular account
password — Google blocks plain password SMTP login by default. Generate one
under Google Account → Security → 2-Step Verification → App Passwords.

The scheduler (`app/reminders.py`) checks once an hour for any task whose
`remind_at` date has arrived and hasn't been emailed yet, sends one email, then
flips `reminder_sent` so it never fires twice for the same task. This was
**not testable from the sandbox this was built in** — no outbound SMTP access
there — so the first real test of actual email delivery will be on your machine.
If it doesn't send, check `uvicorn`'s console output first; `reminders.py` logs
a warning there whenever SMTP isn't configured or a send fails.
