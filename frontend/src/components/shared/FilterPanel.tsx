import { Check, RefreshCw, Link2Off, CalendarPlus, TriangleAlert } from "lucide-react";
import { sectionColor } from "../../utils/sectionColors";
import type { GoogleCalendarStatus, Section } from "../../types";

interface TickProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Dot shown before the label — the item's calendar/section color. */
  color?: string | null;
  count?: number;
}

// A custom control rather than a bare <input type="checkbox"> so the tick can
// carry the item's own color; native checkbox styling can't be themed per-row.
function Tick({ checked, onChange, label, color, count }: TickProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all"
        style={{
          backgroundColor: checked ? color ?? "#7c8cff" : "transparent",
          borderColor: checked ? color ?? "#7c8cff" : "rgba(255,255,255,0.25)",
        }}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-black/80" />}
      </span>
      <span className={`truncate ${checked ? "text-zinc-200" : "text-zinc-500"}`}>
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-auto shrink-0 text-xs text-zinc-600">{count}</span>
      )}
    </label>
  );
}

interface FilterPanelProps {
  sections: Section[];
  /** Section ids currently ticked on. */
  visibleSectionIds: number[];
  onToggleSection: (sectionId: number, visible: boolean) => void;
  onSetAllSections: (visible: boolean) => void;
  /** Task counts per section id, for the number on the right of each row. */
  taskCounts?: Map<number, number>;

  showCompleted: boolean;
  onToggleCompleted: (show: boolean) => void;

  /** Omit the whole Google block by leaving `google` undefined (Deadlines page). */
  google?: {
    status: GoogleCalendarStatus | null;
    onToggleCalendar: (calendarId: string, enabled: boolean) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    loading: boolean;
  };
}

export function FilterPanel({
  sections,
  visibleSectionIds,
  onToggleSection,
  onSetAllSections,
  taskCounts,
  showCompleted,
  onToggleCompleted,
  google,
}: FilterPanelProps) {
  const visible = new Set(visibleSectionIds);
  const allOn = sections.length > 0 && sections.every((s) => visible.has(s.id));

  return (
    <aside className="glass w-full shrink-0 rounded-2xl p-4 lg:w-60">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Spaces
        </h2>
        <button
          onClick={() => onSetAllSections(!allOn)}
          className="text-xs text-indigo-300 transition-colors hover:text-indigo-200"
        >
          {allOn ? "None" : "All"}
        </button>
      </div>

      <div className="-mx-2">
        {sections.map((section, i) => (
          <Tick
            key={section.id}
            checked={visible.has(section.id)}
            onChange={(checked) => onToggleSection(section.id, checked)}
            label={section.name}
            color={sectionColor(section, i)}
            count={taskCounts?.get(section.id)}
          />
        ))}
        {sections.length === 0 && (
          <p className="px-2 py-1 text-sm text-zinc-600">No spaces yet.</p>
        )}
      </div>

      <div className="my-3 border-t border-white/10" />

      <div className="-mx-2">
        <Tick
          checked={showCompleted}
          onChange={onToggleCompleted}
          label="Completed tasks"
          color="#4ee1a0"
        />
      </div>

      {google && (
        <>
          <div className="my-3 border-t border-white/10" />
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Google Calendar
            </h2>
            {google.loading && (
              <RefreshCw size={11} className="animate-spin text-zinc-600" />
            )}
          </div>
          <GoogleBlock {...google} />
        </>
      )}
    </aside>
  );
}

function GoogleBlock({
  status,
  onToggleCalendar,
  onConnect,
  onDisconnect,
}: NonNullable<FilterPanelProps["google"]>) {
  if (!status) {
    return <p className="px-2 py-1 text-sm text-zinc-600">Checking…</p>;
  }

  // Nothing the user can do from the UI about a missing client id/secret —
  // point at the doc instead of showing a Connect button that can only fail.
  if (!status.configured) {
    return (
      <p className="px-2 py-1 text-xs leading-relaxed text-zinc-600">
        Not set up on the server. Add <code className="text-zinc-500">GOOGLE_CLIENT_ID</code>{" "}
        and <code className="text-zinc-500">GOOGLE_CLIENT_SECRET</code> — see DEPLOY.md §8.
      </p>
    );
  }

  if (!status.connected) {
    return (
      <button
        onClick={onConnect}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
      >
        <CalendarPlus size={14} /> Connect
      </button>
    );
  }

  const selected = new Set(status.selected_calendar_ids);

  return (
    <>
      {status.error && (
        <p className="mb-2 flex items-start gap-1.5 px-2 text-xs leading-relaxed text-amber-300">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          {status.error}
        </p>
      )}

      <div className="-mx-2">
        {status.calendars.map((cal) => (
          <Tick
            key={cal.id}
            checked={selected.has(cal.id)}
            onChange={(checked) => onToggleCalendar(cal.id, checked)}
            label={cal.name}
            color={cal.color}
          />
        ))}
        {status.calendars.length === 0 && !status.error && (
          <p className="px-2 py-1 text-sm text-zinc-600">No calendars found.</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between px-2">
        <span className="truncate text-[11px] text-zinc-600" title={status.account_email ?? ""}>
          {status.account_email}
        </span>
        <button
          onClick={onDisconnect}
          title="Disconnect Google Calendar"
          className="shrink-0 text-zinc-600 transition-colors hover:text-rose-300"
        >
          <Link2Off size={13} />
        </button>
      </div>
    </>
  );
}
