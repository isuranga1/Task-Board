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
- **Reflections**: the moment a task lands in Done — dragged there, or switched
  with the status buttons in its detail modal — you get asked how it felt (a
  1-5 scale) and what you learned or got out of it. Both are optional and the
  prompt is always skippable; the task is already saved as done before it
  appears. What you write shows on the done card in your own words, and stays
  editable from the detail modal afterwards.
- **Looking back**: at the bottom of the Analytics tab, a week/month/year
  review. The list of what you finished — with each task's rating and note — is
  always there and costs nothing. Press the button and an LLM reads it back to
  you: what you did, the threads running through it, and one thing to carry
  forward. Those reflections are what make it worth reading; fed titles alone
  it can only write a status report. Capped at 10 a day (server-side, resets
  midnight UTC), cached per window so revisiting is free, and re-offered only
  once more has actually been finished since. Shares the OpenRouter key with
  the Grow orb — `DEPLOY.md` §9 — and is entirely optional.
- **Grow orb**: the floating circle in the bottom-right, on every tab. Click
  it and an LLM hands you one grown-up thing worth understanding — how a car
  engine breathes, what an index fund really is, what your payslip's tax code
  means — with something concrete to go and try. Capped at 25 requests a day
  (server-side, shared across devices, resets midnight UTC) and rotated across
  ~18 topic areas so it doesn't keep suggesting the same five things. Needs an
  OpenRouter key; setup is in `DEPLOY.md` §9 and it's entirely optional.
- **Drag and drop**: drag a card between Todo/In Progress/Done to change status.
  On a touchscreen, *hold* a card for a moment first and then drag — a plain
  swipe scrolls the board instead, which is what you want the rest of the time.

## On a phone

The whole dashboard is built to be used from a phone browser, not just a
desktop one. Point Safari at the same address you'd use on a laptop (over
Tailscale, that's `http://<pi-tailscale-address>`) and everything works.

What changes below ~640px wide:

- **Navigation** moves from the floating pill at the top to a bar along the
  bottom edge, within thumb reach.
- **The board's three columns** stack vertically — To Do, then Doing, then
  Done — and you scroll down through them. Dragging a card between them is one
  vertical gesture, and the page scrolls itself as you near the edge.
- **Task status** also gains a To Do / Doing / Done selector inside the task
  detail sheet, for when a drag isn't convenient.
- **Task details** open as a bottom sheet rather than a centered dialog.
- **The calendar's** day cells show coloured dots instead of titles; tap a day
  to read what's on it in the panel underneath.
- **Filters** on the Deadlines and Calendar tabs collapse behind a "Filters"
  button so they don't push the list off-screen.
- **Rename/delete buttons** that appear on hover on a desktop are simply always
  visible on a touchscreen, since there's no hover to trigger them with.

**Add to Home Screen** (Safari → Share → Add to Home Screen) gives it an icon
and runs it without Safari's chrome. Note there's no service worker, so this
is a bookmark with a nice icon rather than an offline-capable app — with the
backend unreachable it will show the "couldn't reach the API" message.

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
