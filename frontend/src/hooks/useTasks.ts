import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { Task, TaskStatus, TaskUpdatePayload } from "../types";

interface MoveTaskChanges {
  status: TaskStatus;
  subsection_id: number | null;
}

/**
 * Owns the task list for one section: fetching, optimistic status updates
 * (for drag-and-drop), and re-fetching on demand. Keeping this logic in a
 * hook instead of inline in a component means the Board component only
 * has to think about rendering, not data fetching.
 */
export function useTasks(sectionId: number | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (sectionId === null) {
      setTasks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.listTasksForSection(sectionId);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Optimistic update: change the UI immediately, send the PATCH in the
  // background, and roll back only if the request actually fails. This is
  // what makes drag-and-drop feel instant instead of waiting on a network
  // round trip before the card visibly moves. Covers both a same-group
  // status change AND a drag into a different group, since both just mean
  // "this task's status and/or subsection_id are now different."
  //
  // Returns the server's version of the task, or null if the move failed —
  // the board needs it to tell a real transition into Done from a no-op, and
  // must not raise the reflection prompt on a move that got rolled back.
  const moveTask = useCallback(
    async (taskId: number, changes: MoveTaskChanges): Promise<Task | null> => {
      const previous = tasks;
      setTasks((current) =>
        current.map((t) => (t.id === taskId ? { ...t, ...changes } : t))
      );
      try {
        // The server computes started_at/completed_at from this status
        // change (see backend crud.update_task) — swap in its response so
        // the time-tracking badges pick up the real timestamp instead of
        // staying stuck on whatever this task had before the drag.
        const updated = await api.updateTask(taskId, changes);
        setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
        return updated;
      } catch (err) {
        setTasks(previous); // rollback
        setError(err instanceof Error ? err.message : "Failed to move task");
        return null;
      }
    },
    [tasks]
  );

  const updateTask = useCallback(
    async (taskId: number, payload: TaskUpdatePayload) => {
      const updated = await api.updateTask(taskId, payload);
      setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    },
    []
  );

  const createTask = useCallback(
    async (title: string, subsectionId: number | null) => {
      if (sectionId === null) return;
      const created = await api.createTask({
        section_id: sectionId,
        title,
        subsection_id: subsectionId,
      });
      setTasks((current) => [...current, created]);
    },
    [sectionId]
  );

  const deleteTask = useCallback(async (taskId: number) => {
    await api.deleteTask(taskId);
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }, []);

  const addSubtask = useCallback(async (taskId: number, title: string) => {
    const created = await api.createSubtask(taskId, title);
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, created] } : t
      )
    );
    return created;
  }, []);

  const deleteSubtask = useCallback(async (taskId: number, subtaskId: number) => {
    await api.deleteSubtask(subtaskId);
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t
      )
    );
  }, []);

  const toggleSubtask = useCallback(
    async (taskId: number, subtaskId: number, isDone: boolean) => {
      const updated = await api.toggleSubtask(subtaskId, isDone);
      setTasks((current) =>
        current.map((t) =>
          t.id !== taskId
            ? t
            : {
                ...t,
                subtasks: t.subtasks.map((s) =>
                  s.id === subtaskId ? updated : s
                ),
              }
        )
      );
    },
    []
  );

  // These four all follow the same shape: the backend returns the FULL
  // updated task (not just the changed field), so each one simply replaces
  // that task wholesale in state rather than trying to patch pieces of it.
  const uploadAttachment = useCallback(async (taskId: number, file: File) => {
    const updated = await api.uploadAttachment(taskId, file);
    setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
    return updated;
  }, []);

  const deleteAttachment = useCallback(async (taskId: number, filename: string) => {
    const updated = await api.deleteAttachment(taskId, filename);
    setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
    return updated;
  }, []);

  const addDependency = useCallback(async (taskId: number, dependsOnId: number) => {
    const updated = await api.addDependency(taskId, dependsOnId);
    setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
    return updated;
  }, []);

  const removeDependency = useCallback(async (taskId: number, dependsOnId: number) => {
    const updated = await api.removeDependency(taskId, dependsOnId);
    setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
    return updated;
  }, []);

  return {
    tasks,
    loading,
    error,
    refresh,
    moveTask,
    updateTask,
    createTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    uploadAttachment,
    deleteAttachment,
    addDependency,
    removeDependency,
  };
}
