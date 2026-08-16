import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Quote, Sparkle, Sparkles } from "lucide-react";
import { usePeriodReview } from "../../hooks/usePeriodReview";
import { satisfactionFor } from "../reflect/satisfaction";
import type { CompletedTaskBrief, PeriodReview, ReviewPeriod } from "../../types";

const PERIODS: { value: ReviewPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

/**
 * The look-back — what you actually finished in a week, month, or year, and an
 * LLM-written read on what it added up to.
 *
 * It lives on Insights rather than on the board because it's the one thing here
 * that looks backwards: the board is for what's left, this is for what's done.
 * The list of completed tasks and their reflections renders with no API cost at
 * all, so the panel is worth opening even on a day you don't want to spend a
 * generation — the written summary is strictly an addition to it.
 */
export function LookBack() {
  const [period, setPeriod] = useState<ReviewPeriod>("week");
  const { review, loading, generating, error, generate } = usePeriodReview(period);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <Sparkles size={14} className="text-indigo-300" /> Looking back
          </h2>
          {/* Scope is spelled out because this panel deliberately ignores the
              space filter above it — a look-back over one space would miss
              exactly the cross-space patterns it exists to notice. */}
          <p className="mt-0.5 text-xs text-zinc-500">
            {review
              ? `${review.label}, every space — ${review.completed.length} finished, ${review.reflected_count} reflected on`
              : "What you finished, and what it taught you."}
          </p>
        </div>

        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !review ? (
        <p className="text-sm text-zinc-500">Gathering what you finished…</p>
      ) : !review ? (
        <p className="text-sm text-rose-300">{error ?? "Couldn't load this period."}</p>
      ) : (
        <>
          {review.completed.length === 0 ? (
            <p className="text-sm italic text-zinc-500">
              Nothing finished in {review.label} yet. Move something to Done and it'll show up
              here.
            </p>
          ) : (
            <>
              {review.summary && <SummaryBody review={review} />}
              <CompletedList tasks={review.completed} />
            </>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <Actions review={review} generating={generating} onGenerate={generate} />
        </>
      )}
    </div>
  );
}

function SummaryBody({ review }: { review: PeriodReview }) {
  const summary = review.summary!;
  // The model is asked for blank-line-separated paragraphs; anything else
  // still renders, just as one block.
  const paragraphs = summary.narrative.split(/\n\s*\n/).filter((p) => p.trim());

  return (
    <div className="mb-5">
      <h3 className="text-base font-semibold leading-snug text-white">{summary.headline}</h3>

      {summary.themes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary.themes.map((theme) => (
            <span
              key={theme}
              className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[11px] text-indigo-200"
            >
              {theme}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-zinc-300">
            {p.trim()}
          </p>
        ))}
      </div>

      {summary.advice && (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-emerald-300/80">
            Carry this forward
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-200">{summary.advice}</p>
        </div>
      )}

      <p className="mt-2 text-[11px] text-zinc-600">
        Written {format(new Date(summary.created_at), "d MMM, HH:mm")} from{" "}
        {summary.task_count} finished {summary.task_count === 1 ? "task" : "tasks"}
        {review.stale && " — more has been finished since"}
      </p>
    </div>
  );
}

/** The raw material, always available and never costing a request. Collapsed by
 *  default once a summary exists — at that point the review is the headline and
 *  this is the evidence behind it. */
function CompletedList({ tasks }: { tasks: CompletedTaskBrief[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ChevronDown
          size={13}
          className={`transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        {tasks.length} finished {tasks.length === 1 ? "task" : "tasks"}
      </button>

      {open && (
        <ul className="mt-3 space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-200">{t.title}</p>
                {satisfactionFor(t.satisfaction) && (
                  <span
                    className="shrink-0 text-sm"
                    title={`${t.satisfaction}/5 — ${satisfactionFor(t.satisfaction)!.label}`}
                  >
                    {satisfactionFor(t.satisfaction)!.emoji}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {t.section_name}
                {t.completed_at && ` · ${format(new Date(t.completed_at), "d MMM")}`}
              </p>
              {t.reflection && (
                <p className="mt-1.5 flex gap-1.5 text-xs italic leading-relaxed text-zinc-400">
                  <Quote size={11} className="mt-0.5 shrink-0 text-zinc-600" />
                  {t.reflection}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Actions({
  review,
  generating,
  onGenerate,
}: {
  review: PeriodReview;
  generating: boolean;
  onGenerate: () => void;
}) {
  if (!review.configured) {
    return (
      <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-500">
        Written summaries aren't switched on. Add an{" "}
        <code className="rounded bg-white/10 px-1">OPENROUTER_API_KEY</code> to the server's
        environment and restart the backend.
      </p>
    );
  }

  const empty = review.completed.length === 0;
  const spent = review.remaining === 0;
  // Rewriting is only offered once it would actually say something different —
  // otherwise the button invites you to spend a request on the same answer.
  const canRewrite = review.summary !== null && review.stale;
  const disabled = generating || spent || empty || (review.summary !== null && !canRewrite);

  const label = generating
    ? "Reading it back…"
    : empty
      ? "Nothing to summarise"
      : spent
        ? "Back tomorrow"
        : canRewrite
          ? "Rewrite with the latest"
          : review.summary
            ? "Already written"
            : "Write my look-back";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
      <button
        onClick={onGenerate}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black
          transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Sparkle size={14} /> {label}
      </button>
      <span className="text-xs text-zinc-500">
        {review.remaining} of {review.daily_limit} summaries left today
      </span>
    </div>
  );
}
