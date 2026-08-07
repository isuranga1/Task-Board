# Task Dashboard

Personal task dashboard with configurable sections (Jobs, Music, Guitar, ...),
each with subsections (groups) and a Todo / In Progress / Done board.

- `backend/` — FastAPI + SQLAlchemy + Alembic + PostgreSQL. See `backend/README.md`.
- `frontend/` — React + Vite + TypeScript + Tailwind v4. See `frontend/README.md`.

## Quickstart (Windows / PowerShell)

**1. Postgres** — create the database and user (see `backend/README.md` for the
exact `CREATE DATABASE` / `CREATE USER` / `GRANT` commands).

**2. Backend:**
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# put your real DB credentials in a new .env file (see backend/README.md)
# optionally add SMTP settings there too, for email reminders
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**3. Frontend** (in a second terminal):
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open **http://localhost:5173**. The backend must be running first — the
dashboard fetches sections from `http://localhost:8000` on load.

## Feature tour

- **Sections**: the top tab bar (Jobs/Music/Guitar/...). "+ Section" to add
  one, hover a tab and click the ✕ to delete it (and everything inside it).
- **Grouping**: "+ Add group" above the board creates a subsection. Assign a
  task to one via the "Group" dropdown inside its detail modal.
- **Task details**: click any card (not its subtask checkboxes) to open it —
  description, due date (calendar widget), priority, ticket code, tags,
  links, attachments, dependencies, and an email reminder date all live here.
  Nothing saves until "Save changes"; closing without saving discards edits.
- **Link previews**: explicit "Links" list, expandable — YouTube/Vimeo embed
  a real player, other links attempt a generic iframe preview (some sites
  block this; use the open-in-new-tab icon in that case).
- **Description embeds**: paste a URL directly into the description text
  itself and it's auto-detected as a separate expandable preview, Notion-style.
- **Attachments**: upload PDFs/images/anything; stored in `backend/uploads/`.
- **Dependencies**: mark one task as depending on another. A 🔒 shows on a
  card if it's blocked by something unfinished.
- **Priority**: low/medium/high/urgent, shown as a colored dot on each card.
- **Email reminders**: set a date on a task, get one email when it arrives
  (requires SMTP config — see `backend/README.md`).
- **Deadlines tab**: every task across every section in one list, ordered by
  how soon it's due — Overdue, Today, Tomorrow, Rest of this week, Later, No
  deadline. Tick spaces on/off in the left panel; completed tasks are hidden
  until you tick them on. Click any row to open its detail modal.
- **Calendar tab**: a month grid of task deadlines, optionally with your
  Google Calendar events layered on top. Each space and each Google calendar
  gets its own tick-box, so you can narrow it down to just what you care
  about. Click a day for a detailed list of everything on it. Setting up the
  Google connection is documented in `DEPLOY.md` §8 — it's read-only and
  entirely optional.
- **Analytics tab**: completion rate, overdue count, priority/status
  breakdowns, and a completed-per-day trend, filterable by section.
- **Grow orb**: the floating circle in the bottom-right, on every tab. Click
  it and an LLM hands you one grown-up thing worth understanding — how a car
  engine breathes, what an index fund really is, what your payslip's tax code
  means — with something concrete to go and try. Capped at 25 requests a day
  (server-side, shared across devices, resets midnight UTC) and rotated across
  ~18 topic areas so it doesn't keep suggesting the same five things. Needs an
  OpenRouter key; setup is in `DEPLOY.md` §9 and it's entirely optional.
- **Drag and drop**: drag a card between Todo/In Progress/Done to change status.

## Notes

- Neither `backend/.env` nor `frontend/.env` are included in this archive —
  each has an example file (`.env.example`, or the placeholder shown in
  `backend/README.md`) since real credentials shouldn't ship in a project
  export. Create your own before running anything.
- Email reminders could not be tested end-to-end in the environment this was
  built in (no outbound SMTP access there) — the code path is complete and the
  app starts cleanly with the scheduler running, but you'll be the first to
  confirm a real email actually sends once real SMTP credentials are in place.
- `backend/alembic/versions/` includes one migration (`initial schema...`)
  that creates all 5 tables (including the new `task_dependencies` table).
  Run `alembic upgrade head` once before starting the API for the first time.
