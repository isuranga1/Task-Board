import { useEffect, useState } from "react";
import { Compass, History, Sparkles, X } from "lucide-react";
import { useGrowth } from "../../hooks/useGrowth";
import { orbMotionClass, orbPanelMotionClass } from "../../animations";
import type { GrowthTip } from "../../types";

/**
 * The Grow orb — a floating circle, always on screen, that hands you one
 * grown-up thing worth learning.
 *
 * It lives outside the four views on purpose. Everything else in this app is
 * work you've already committed to; this is the one control that gives you
 * something you didn't ask for, so it belongs beside the board rather than
 * inside any tab of it.
 *
 * Every click costs one of a small daily budget (25 by default, enforced by the
 * server), so the whole component is built around making that count visible
 * before you spend it, never after.
 */
export function GrowthOrb() {
  const { status, tip, history, loading, error, generate, loadHistory } = useGrowth();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const remaining = status?.remaining ?? 0;
  const limit = status?.daily_limit ?? 0;
  const configured = status?.configured ?? false;
  const spent = configured && remaining === 0;

  const handleOpen = () => {
    setOpen((wasOpen) => !wasOpen);
  };

  const handleHistory = () => {
    setShowHistory((was) => !was);
    loadHistory();
  };

  return (
    <>
      {open && (
        <div
          // Stacked above the orb, which is itself lifted above the mobile
          // bottom nav — hence the taller offset below sm.
          className={`glass-panel fixed bottom-[calc(8.75rem+env(safe-area-inset-bottom))] right-5 z-40
            w-[min(23rem,calc(100vw-2.5rem))] rounded-3xl p-5
            sm:bottom-24 sm:right-8 ${orbPanelMotionClass()}`}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Sparkles size={14} className="text-indigo-300" /> Something to grow into
              </h2>
              {configured && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  {remaining} of {limit} left today
                </p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-zinc-500 transition-colors hover:text-white"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {!configured ? (
            <p className="text-sm leading-relaxed text-zinc-400">
              The Grow orb isn't switched on. Add an{" "}
              <code className="rounded bg-white/10 px-1 text-xs">OPENROUTER_API_KEY</code> to the
              server's environment and restart the backend — see DEPLOY.md §9.
            </p>
          ) : showHistory ? (
            <HistoryList history={history} />
          ) : (
            <TipBody tip={tip} loading={loading} />
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          {configured && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={generate}
                disabled={loading || spent}
                className="flex-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-black
                  transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {loading ? "Thinking…" : spent ? "Back tomorrow" : tip ? "Something else" : "Show me something"}
              </button>
              <button
                onClick={handleHistory}
                className={`glass glass-hover rounded-full p-2.5 transition-colors ${
                  showHistory ? "text-white" : "text-zinc-400 hover:text-white"
                }`}
                aria-label={showHistory ? "Back to the current tip" : "Earlier tips"}
                title={showHistory ? "Back to the current tip" : "Earlier tips"}
              >
                <History size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* The wrapper owns the fixed positioning, the button owns the looks.
          Keeping them apart matters: motion.css loads after Tailwind, so any
          `position` the motion class set would beat the `fixed` utility and
          drop the orb into normal flow. */}
      {/* On a phone the nav is a bar along the bottom edge, so the orb has to
          sit above it rather than on top of it. */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-5 z-40 sm:bottom-5 sm:right-8">
        <button
          onClick={handleOpen}
          className={`glass relative flex h-14 w-14 items-center justify-center rounded-full
            text-indigo-200 transition-transform hover:scale-105 active:scale-95
            ${orbMotionClass(loading)}`}
          aria-label="Something to grow into"
          aria-expanded={open}
          title="Something to grow into"
        >
          <Compass size={22} className="relative z-10" />
        </button>
      </div>
    </>
  );
}

function TipBody({ tip, loading }: { tip: GrowthTip | null; loading: boolean }) {
  // The previous tip stays on screen while a new one is being written — a
  // panel that empties itself for two seconds feels broken, and there's
  // nothing wrong with the old suggestion in the meantime.
  if (!tip) {
    return (
      <p className="text-sm leading-relaxed text-zinc-400">
        {loading
          ? "Finding you something…"
          : "One small thing a capable adult is better for knowing — how an engine breathes, what your payslip is really saying, why bread needs salt. Tap below."}
      </p>
    );
  }

  return (
    <div className={loading ? "opacity-40 transition-opacity" : "transition-opacity"}>
      <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-indigo-300/80">
        {shortTopic(tip.topic)}
      </p>
      <h3 className="text-base font-semibold leading-snug text-white">{tip.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{tip.body}</p>
      {tip.try_this && (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-emerald-300/80">
            Try this
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-200">{tip.try_this}</p>
        </div>
      )}
    </div>
  );
}

function HistoryList({ history }: { history: GrowthTip[] | null }) {
  if (history === null) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (history.length === 0)
    return <p className="text-sm text-zinc-500">Nothing yet — your first tip will land here.</p>;

  return (
    <ul className="-mr-2 max-h-72 space-y-3 overflow-y-auto pr-2">
      {history.map((t) => (
        <li key={t.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-indigo-300/70">
            {shortTopic(t.topic)}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-zinc-200">{t.title}</p>
        </li>
      ))}
    </ul>
  );
}

/** Topics are stored with their full "Area — examples, of, it" prompt text;
 *  only the area before the dash is worth showing as a label. */
function shortTopic(topic: string): string {
  return topic.split("—")[0].trim();
}
