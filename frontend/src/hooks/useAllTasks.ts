import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../api/client";
import type { Section, Task } from "../types";

/**
 * Sections + every task across all of them, for the two cross-section views
 * (Deadlines and Calendar).
 *
 * Deliberately separate from `useTasks`, which owns ONE section's tasks and all
 * the optimistic-update machinery drag-and-drop needs. These views are
 * read-only: they never move a card, so inheriting that write path would mean
 * carrying complexity neither of them uses.
 */
export function useAllTasks() {
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Both are needed before anything renders — a task without its section's
      // name and color can't be shown or filtered, so there's nothing to gain
      // from letting one land first.
      const [sectionData, taskData] = await Promise.all([
        api.listSections(),
        api.listAllTasks(),
      ]);
      setSections(sectionData);
      setTasks(taskData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lets a card show "Work · Evaluations" without every consumer re-deriving
  // the same two lookups from the sections tree.
  const sectionById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  const subsectionById = useMemo(() => {
    const map = new Map<number, { name: string; sectionId: number }>();
    for (const section of sections) {
      for (const sub of section.subsections) {
        map.set(sub.id, { name: sub.name, sectionId: section.id });
      }
    }
    return map;
  }, [sections]);

  // Updates a single task in place after an edit in the detail modal, so the
  // list doesn't have to re-fetch everything just to reflect one changed date.
  const replaceTask = useCallback((updated: Task) => {
    setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const removeTask = useCallback((taskId: number) => {
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }, []);

  return {
    sections,
    tasks,
    sectionById,
    subsectionById,
    loading,
    error,
    refresh,
    replaceTask,
    removeTask,
  };
}
