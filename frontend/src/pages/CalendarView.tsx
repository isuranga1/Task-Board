import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  parseISO,
  isValid,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { useAllTasks } from "../hooks/useAllTasks";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { usePersistedState } from "../hooks/usePersistedState";
import { useReflection } from "../hooks/useReflection";
import { FilterPanel } from "../components/shared/FilterPanel";
import { sectionColorMap } from "../utils/sectionColors";
import { TaskDetailHost } from "../components/shared/TaskDetailHost";
import { ReflectionPrompt } from "../components/reflect/ReflectionPrompt";
import { api } from "../api/client";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { DayDetail } from "../components/calendar/DayDetail";
import { dayKey, eventDayKeys, taskDayKey } from "../utils/calendar";
import { ALL_DAY_SORT_KEY, type CalendarItem } from "../components/calendar/types";
import type { Task } from "../types";

const DEFAULT_EVENT_COLOR = "#7c8cff";

export function CalendarView() {
  const { sections, tasks, loading, error, replaceTask, removeTask } = useAllTasks();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const reflection = useReflection();

  const [hiddenSectionIds, setHiddenSectionIds] = usePersistedState<number[]>(
    "calendar.hiddenSections",
    []
  );
  const [showCompleted, setShowCompleted] = usePersistedState("calendar.showCompleted", true);

  // The visible grid runs from the Sunday before the 1st to the Saturday after
  // the last — fetching Google events for exactly that window means the
  // leading/trailing days from neighbouring months aren't mysteriously empty.
  const windowStart = useMemo(() => startOfWeek(startOfMonth(month)), [month]);
  const windowEnd = useMemo(() => endOfWeek(endOfMonth(month)), [month]);

  const { status, events, loadingEvents, eventError, connect, disconnect, toggleCalendar } =
    useGoogleCalendar(windowStart, windowEnd);

  const hidden = useMemo(() => new Set(hiddenSectionIds), [hiddenSectionIds]);
  const visibleSectionIds = sections.filter((s) => !hidden.has(s.id)).map((s) => s.id);

  const colorForSection = useMemo(() => sectionColorMap(sections), [sections]);

  const taskCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of tasks) {
      if (!t.due_date) continue; // undated tasks never appear on a calendar
      if (!showCompleted && t.status === "done") continue;
      counts.set(t.section_id, (counts.get(t.section_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks, showCompleted]);

  // One pass building the day -> items index the grid and day panel both read.
  // Tasks and events are merged here rather than in the grid so both views
  // agree on ordering and filtering without repeating the rules.
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    function push(key: string, item: CalendarItem) {
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }

    for (const task of tasks) {
      if (hidden.has(task.section_id)) continue;
      if (!showCompleted && task.status === "done") continue;
      const key = taskDayKey(task);
      if (!key) continue;
      push(key, {
        kind: "task",
        id: `task-${task.id}`,
        task,
        color: colorForSection.get(task.section_id) ?? DEFAULT_EVENT_COLOR,
        title: task.title,
        sortKey: ALL_DAY_SORT_KEY,
      });
    }

    for (const event of events) {
      for (const key of eventDayKeys(event)) {
        push(key, {
          kind: "event",
          id: `event-${event.calendar_id}-${event.id}-${key}`,
          event,
          color: event.color ?? DEFAULT_EVENT_COLOR,
          title: event.title,
          // Timed events sort by their clock time; all-day ones keep the empty
          // sort key so they float to the top of the day alongside deadlines.
          sortKey: event.all_day ? ALL_DAY_SORT_KEY : eventClockKey(event.start),
        });
      }
    }

    for (const items of map.values()) {
      items.sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
        // Same time slot: deadlines first — they're the thing this app is about.
        if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    }

    return map;
  }, [tasks, events, hidden, showCompleted, colorForSection]);

  const selectedItems = selectedDay ? itemsByDay.get(dayKey(selectedDay)) ?? [] : [];
  const openTask: Task | null = tasks.find((t) => t.id === openTaskId) ?? null;

  if (loading) return <p className="text-zinc-400">Loading calendar…</p>;

  if (error) {
    return (
      <div className="glass mx-auto max-w-6xl rounded-2xl p-5 text-red-300">
        Couldn't reach the API — is the backend running on port 8000?
        <div className="mt-2 text-xs text-zinc-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <CalendarDays size={24} className="text-indigo-300" /> Calendar
          </h1>
          <p className="text-sm text-zinc-400">
            Task deadlines and your Google events, side by side.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
            className="glass glass-hover rounded-full p-2 text-zinc-300"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-white">
            {format(month, "MMMM yyyy")}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="glass glass-hover rounded-full p-2 text-zinc-300"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => {
              const today = new Date();
              setMonth(startOfMonth(today));
              setSelectedDay(today);
            }}
            className="glass glass-hover ml-1 rounded-full px-3 py-2 text-xs font-medium text-zinc-300"
          >
            Today
          </button>
        </div>
      </div>

      {eventError && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-amber-300">
          <TriangleAlert size={14} /> Google events couldn't be loaded: {eventError}
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        <FilterPanel
          sections={sections}
          visibleSectionIds={visibleSectionIds}
          onToggleSection={(id, visible) =>
            setHiddenSectionIds((current) =>
              visible ? current.filter((x) => x !== id) : [...current, id]
            )
          }
          onSetAllSections={(visible) =>
            setHiddenSectionIds(visible ? [] : sections.map((s) => s.id))
          }
          taskCounts={taskCounts}
          showCompleted={showCompleted}
          onToggleCompleted={setShowCompleted}
          google={{
            status,
            onToggleCalendar: toggleCalendar,
            onConnect: connect,
            onDisconnect: disconnect,
            loading: loadingEvents,
          }}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <MonthGrid
            month={month}
            itemsByDay={itemsByDay}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay && (
            <DayDetail
              day={selectedDay}
              items={selectedItems}
              onOpenTask={(t) => setOpenTaskId(t.id)}
            />
          )}
        </div>
      </div>

      {openTask && (
        <TaskDetailHost
          task={openTask}
          sections={sections}
          allTasks={tasks}
          onClose={() => setOpenTaskId(null)}
          onChanged={replaceTask}
          onDeleted={removeTask}
          onSaved={reflection.maybeAsk}
        />
      )}

      {reflection.pending && (
        <ReflectionPrompt
          task={reflection.pending}
          onDismiss={reflection.dismiss}
          onSave={async (values) => {
            replaceTask(await api.updateTask(reflection.pending!.id, values));
          }}
        />
      )}
    </div>
  );
}

/** "HH:mm" for within-day ordering; empty string if the timestamp is unusable. */
function eventClockKey(startIso: string | null): string {
  if (!startIso) return ALL_DAY_SORT_KEY;
  const start = parseISO(startIso);
  return isValid(start) ? format(start, "HH:mm") : ALL_DAY_SORT_KEY;
}
