# Task Dashboard — Frontend

Vite + React + TypeScript + Tailwind v4. Drag-and-drop board via `@dnd-kit`.

## Setup

```powershell
cd frontend
npm install
```

**Note on Tailwind:** this project uses **Tailwind v4**, not v3. Setup is different
from the older `tailwindcss init -p` workflow — there's no `tailwind.config.js`
with a `content` array. Instead, `postcss.config.js` uses the `@tailwindcss/postcss`
plugin, and theme tokens (colors) are declared directly in `src/index.css` inside
an `@theme { ... }` block. If you followed along with the original setup guide's
Tailwind instructions, this is the one place reality diverged from what was written
there — v4 shipped as the default `npm install -D tailwindcss` version.

Copy the env example and point it at your running backend:
```powershell
copy .env.example .env
```

## Run

Make sure the backend (`uvicorn app.main:app --reload --port 8000`) is running first,
then:
```powershell
npm run dev
```

Open **http://localhost:5173**.

## Project structure

```
src/
├── types/index.ts              # mirrors backend/app/schemas.py field-for-field
├── api/client.ts                # thin typed fetch wrapper — every request goes through here
├── hooks/useTasks.ts            # data + optimistic updates for the active section's tasks
├── components/
│   ├── board/
│   │   ├── Board.tsx             # DndContext + the 3 columns
│   │   ├── Column.tsx            # one droppable column (Todo / In Progress / Done)
│   │   └── TaskCard.tsx          # one draggable card
│   └── sections/
│       ├── SectionTabs.tsx       # section switcher + "add section"
│       └── SubsectionGroup.tsx   # groups tasks by subsection, each with its own Board
└── pages/
    └── Dashboard.tsx             # top-level composition: fetch sections, pick active one, render groups
```

## How drag-and-drop works

`Board.tsx` wraps the columns in `@dnd-kit`'s `<DndContext>`. Each `TaskCard` is
`useDraggable`, each `Column` is `useDroppable`. When a drag ends over a valid
column, `Board`'s `handleDragEnd` reads the dropped-on column's `status` and calls
`onStatusChange`, which flows up to `useTasks`' `updateTaskStatus` — that function
updates React state **immediately** (optimistic update) and fires the `PATCH`
request in the background, only rolling back if the request actually fails. This
is what makes the card visibly move the instant you drop it, instead of waiting
on a network round trip first.

## Adding a new section type

The "Jobs / Music / Guitar" configurability lives entirely in the database, not
hardcoded anywhere in the frontend — `SectionTabs`' "+ Section" button calls
`POST /sections/`, and the new section just shows up as another tab. No code
changes needed to add a new dashboard category.
