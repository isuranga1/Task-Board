import { useState, useRef, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string; // ISO date string "2026-07-10", or "" for none
  onChange: (value: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => (value ? parseISO(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on any click outside it — standard pattern for any
  // popover/dropdown: listen on the whole document, check if the click
  // landed inside our container, close if not.
  //
  // pointerdown rather than mousedown: iOS Safari only synthesises mouse
  // events for elements it considers clickable, so a tap on plain background
  // never reached this handler and the calendar stayed stuck open. Pointer
  // events fire for touch and mouse alike.
  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const selectedDate = value ? parseISO(value) : null;

  // Build a full 6-week grid so the calendar layout never jumps size between
  // months — includes the tail end of the previous month and start of next.
  const gridStart = startOfWeek(startOfMonth(viewMonth));
  const gridEnd = endOfWeek(endOfMonth(viewMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function selectDay(day: Date) {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none hover:border-white/25 transition-colors"
      >
        <Calendar size={14} className="text-zinc-500" />
        {selectedDate ? format(selectedDate, "MMM d, yyyy") : (
          <span className="text-zinc-500">Select date</span>
        )}
        {selectedDate && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="ml-auto text-zinc-500 hover:text-rose-300 transition-colors"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-10 mt-2 glass-panel rounded-2xl p-3 shadow-xl w-72 sm:w-64">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-white">
              {format(viewMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] text-zinc-500 font-medium">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inCurrentMonth = isSameMonth(day, viewMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => selectDay(day)}
                  // Fills its grid track on a phone rather than sitting as a
                  // 28px dot in the middle of it — same layout, a tap target
                  // you can actually hit.
                  className={`text-xs h-9 w-full rounded-lg flex items-center justify-center transition-colors sm:h-7 sm:w-7 sm:rounded-full
                    ${!inCurrentMonth ? "text-zinc-700" : "text-zinc-300"}
                    ${isSelected ? "bg-white text-black font-medium" : "hover:bg-white/10"}
                    ${isToday(day) && !isSelected ? "ring-1 ring-indigo-400" : ""}
                  `}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => selectDay(new Date())}
            className="w-full mt-2 pt-2 border-t border-white/10 text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
