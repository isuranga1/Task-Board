import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { dayKey } from "../../utils/calendar";
import type { CalendarItem } from "./types";

// How many chips fit in a cell before it collapses into "+N more". Enough to be
// useful at a glance; beyond this the cell height starts driving the whole grid.
const MAX_CHIPS_PER_DAY = 3;

// The phone-sized equivalent: bare colour markers, so a few more fit before
// the cell has to stop showing them.
const MAX_DOTS_PER_DAY = 6;

interface MonthGridProps {
  month: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
}

function Chip({ item }: { item: CalendarItem }) {
  const isTask = item.kind === "task";
  const done = isTask && item.task.status === "done";

  return (
    <div
      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
        done ? "opacity-50" : ""
      }`}
      style={{ backgroundColor: `${item.color}22`, color: item.color }}
      title={item.title}
    >
      {/* A square marks a deadline, a dot marks a calendar event — so the two
          stay distinguishable for anyone who can't rely on the color alone. */}
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 ${isTask ? "rounded-[1px]" : "rounded-full"}`}
        style={{ backgroundColor: item.color }}
      />
      <span className={`truncate ${done ? "line-through" : ""}`}>{item.title}</span>
    </div>
  );
}

export function MonthGrid({ month, itemsByDay, selectedDay, onSelectDay }: MonthGridProps) {
  // A full 6-week grid keeps the calendar the same height every month, so
  // paging through them doesn't make the page jump around.
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weekdayLabels = days.slice(0, 7).map((d) => format(d, "EEEEE"));

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="grid grid-cols-7 border-b border-white/10">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const items = itemsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const selected = selectedDay !== null && isSameDay(day, selectedDay);
          const overflow = items.length - MAX_CHIPS_PER_DAY;

          return (
            <button
              key={key}
              onClick={() => onSelectDay(day)}
              className={`min-h-[3.25rem] border-b border-r border-white/[0.06] p-1 text-left align-top transition-colors
                [&:nth-child(7n)]:border-r-0 sm:min-h-[5.5rem] sm:p-1.5
                ${inMonth ? "" : "opacity-40"}
                ${selected ? "bg-white/10" : "hover:bg-white/[0.04]"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs
                    ${today ? "bg-indigo-400 font-semibold text-black" : "text-zinc-400"}`}
                >
                  {format(day, "d")}
                </span>
                {items.length > 0 && (
                  <span className="hidden text-[10px] text-zinc-600 sm:inline">
                    {items.length}
                  </span>
                )}
              </div>

              {/* A phone gives each cell roughly 50px of width — far too little
                  for a title, even truncated. Below sm the day's items collapse
                  to their colour markers alone; tapping the day opens DayDetail
                  underneath, which is where the reading actually happens. */}
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {items.slice(0, MAX_DOTS_PER_DAY).map((item) => (
                  <span
                    key={item.id}
                    aria-hidden
                    className={`h-1.5 w-1.5 ${
                      item.kind === "task" ? "rounded-[1px]" : "rounded-full"
                    } ${item.kind === "task" && item.task.status === "done" ? "opacity-50" : ""}`}
                    style={{ backgroundColor: item.color }}
                  />
                ))}
              </div>

              <div className="hidden space-y-0.5 sm:block">
                {items.slice(0, MAX_CHIPS_PER_DAY).map((item) => (
                  <Chip key={item.id} item={item} />
                ))}
                {overflow > 0 && (
                  <div className="px-1 text-[10px] text-zinc-500">+{overflow} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
