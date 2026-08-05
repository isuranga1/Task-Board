import { useState, useMemo } from "react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { useAllTasks } from "../hooks/useAllTasks";
import { usePersistedState } from "../hooks/usePersistedState";
import { FilterPanel } from "../components/shared/FilterPanel";
import { TaskDetailHost } from "../components/shared/TaskDetailHost";
import { DeadlineRow } from "../components/deadlines/DeadlineRow";
import { groupByDeadline, countOverdue } from "../utils/deadlines";
import { sectionColorMap } from "../utils/sectionColors";
import type { Task } from "../types";

export function Deadlines() {
  const { sections, tasks, sectionById, subsectionById, loading, error, replaceTask, removeTask } =
    useAllTasks();

  // `null` means "everything", which is what a first-time visitor should see.
  // Storing an explicit list only once something is unticked keeps a newly
  // created space visible by default instead of silently filtered out.
  const [hiddenSectionIds, setHiddenSectionIds] = usePersistedState<number[]>(
    "deadlines.hiddenSections",
    []
  );
  const [showCompleted, setShowCompleted] = usePersistedState(
    "deadlines.showCompleted",
    false
  );
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  const hidden = useMemo(() => new Set(hiddenSectionIds), [hiddenSectionIds]);
  const visibleSectionIds = sections.filter((s) => !hidden.has(s.id)).map((s) => s.id);

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (t) => !hidden.has(t.section_id) && (showCompleted || t.status !== "done")
      ),
    [tasks, hidden, showCompleted]
  );

  const buckets = useMemo(() => groupByDeadline(visibleTasks), [visibleTasks]);
  const overdueCount = useMemo(() => countOverdue(visibleTasks), [visibleTasks]);

  // Counts shown next to each space are pre-filter for status but post-nothing
  // else, so unticking a space doesn't make its own count vanish.
  const taskCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of tasks) {
      if (!showCompleted && t.status === "done") continue;
      counts.set(t.section_id, (counts.get(t.section_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks, showCompleted]);

  const colorForSection = useMemo(() => sectionColorMap(sections), [sections]);

  const openTask: Task | null = tasks.find((t) => t.id === openTaskId) ?? null;

  if (loading) return <p className="text-zinc-400">Loading deadlines…</p>;

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
      <div className="mb-6">
        <h1 className="mb-1 flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
          <CalendarClock size={26} className="text-indigo-300" /> Deadlines
        </h1>
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          Every space, in the order things are actually due.
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 font-medium text-rose-300">
              <TriangleAlert size={13} />
              {overdueCount} overdue
            </span>
          )}
        </p>
      </div>

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
        />

        <div className="min-w-0 flex-1">
          {buckets.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-zinc-500">
              {tasks.length === 0
                ? "No tasks yet — add some on the board and their deadlines will show up here."
                : "Nothing matches the current filters."}
            </div>
          ) : (
            <div className="space-y-6">
              {buckets.map((bucket) => (
                <section key={bucket.key}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h2
                      className={`text-sm font-semibold ${
                        bucket.key === "overdue" ? "text-rose-300" : "text-zinc-300"
                      }`}
                    >
                      {bucket.label}
                    </h2>
                    <span className="text-xs text-zinc-600">{bucket.tasks.length}</span>
                    {bucket.hint && (
                      <span className="ml-auto text-[11px] text-zinc-600">{bucket.hint}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {bucket.tasks.map((task, i) => (
                      <DeadlineRow
                        key={task.id}
                        task={task}
                        index={i}
                        sectionName={sectionById.get(task.section_id)?.name ?? "Unknown"}
                        sectionColor={colorForSection.get(task.section_id) ?? "#7c8cff"}
                        subsectionName={
                          task.subsection_id
                            ? subsectionById.get(task.subsection_id)?.name
                            : undefined
                        }
                        onOpen={(t) => setOpenTaskId(t.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
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
        />
      )}
    </div>
  );
}
