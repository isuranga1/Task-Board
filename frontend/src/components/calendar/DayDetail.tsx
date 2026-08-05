import { format, parseISO, isValid } from "date-fns";
import { ExternalLink, MapPin, Clock } from "lucide-react";
import type { CalendarItem } from "./types";
import type { Task } from "../../types";

interface DayDetailProps {
  day: Date;
  items: CalendarItem[];
  /** Opens the task detail modal — Google events have no equivalent here. */
  onOpenTask: (task: Task) => void;
}

/** "9:30 AM – 11:00 AM", or "All day". */
function timeRange(startIso: string | null, endIso: string | null, allDay: boolean): string {
  if (allDay || !startIso) return "All day";
  const start = parseISO(startIso);
  if (!isValid(start)) return "All day";
  const startLabel = format(start, "h:mm a");
  if (!endIso) return startLabel;
  const end = parseISO(endIso);
  return isValid(end) ? `${startLabel} – ${format(end, "h:mm a")}` : startLabel;
}

export function DayDetail({ day, items, onOpenTask }: DayDetailProps) {
  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">
        {format(day, "EEEE, MMMM d")}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">Nothing on this day.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) =>
            item.kind === "task" ? (
              <button
                key={item.id}
                onClick={() => onOpenTask(item.task)}
                className="flex w-full items-start gap-2.5 rounded-xl border-l-[3px] bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.07]"
                style={{ borderLeftColor: item.color }}
              >
                <span
                  aria-hidden
                  className="mt-1 h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm ${
                      item.task.status === "done"
                        ? "text-zinc-500 line-through"
                        : "text-zinc-100"
                    }`}
                  >
                    {item.task.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Deadline
                    {item.task.status === "done" && " · done"}
                    {item.task.status === "in_progress" && " · in progress"}
                  </p>
                </div>
              </button>
            ) : (
              <div
                key={item.id}
                className="flex items-start gap-2.5 rounded-xl border-l-[3px] bg-white/[0.03] px-3 py-2"
                style={{ borderLeftColor: item.color }}
              >
                <span
                  aria-hidden
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                      {item.event.title}
                    </p>
                    {item.event.html_link && (
                      <a
                        href={item.event.html_link}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in Google Calendar"
                        className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-300"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {timeRange(item.event.start, item.event.end, item.event.all_day)}
                    </span>
                    <span className="truncate">· {item.event.calendar_name}</span>
                    {item.event.location && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{item.event.location}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
