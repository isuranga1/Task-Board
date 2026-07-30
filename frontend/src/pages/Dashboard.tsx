import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { useTasks } from "../hooks/useTasks";
import { SectionTabs, slugify } from "../components/sections/SectionTabs";
import { SubsectionGroup } from "../components/sections/SubsectionGroup";
import { TaskDetailModal } from "../components/board/TaskDetailModal";
import type { Section, Task } from "../types";

export function Dashboard() {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [loadingSections, setLoadingSections] = useState(true);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  const {
    tasks,
    loading: loadingTasks,
    error: taskError,
    updateTaskStatus,
    updateTask,
    createTask,
    toggleSubtask,
  } = useTasks(activeSectionId);

  // Look the open task up fresh from `tasks` each render, rather than storing
  // the whole Task object in state — this way if a subtask gets toggled while
  // the modal is open, the modal always reflects the latest data instead of
  // a stale snapshot from the moment it was opened.
  const openTask: Task | null = tasks.find((t) => t.id === openTaskId) ?? null;

  const refreshSections = useCallback(async () => {
    setLoadingSections(true);
    setSectionError(null);
    try {
      const data = await api.listSections();
      setSections(data);
      // Auto-select the first section on initial load so the board isn't
      // empty the moment the page opens.
      if (data.length > 0) {
        setActiveSectionId((current) => current ?? data[0].id);
      }
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to load sections");
    } finally {
      setLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    refreshSections();
  }, [refreshSections]);

  async function handleCreateSection(name: string) {
    const created = await api.createSection({ name, slug: slugify(name) });
    setSections((current) => [...current, created]);
    setActiveSectionId(created.id);
  }

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;

  // Group tasks by subsection. `null` key holds tasks with no subsection at all.
  const tasksBySubsection = new Map<number | null, typeof tasks>();
  tasksBySubsection.set(null, []);
  activeSection?.subsections.forEach((sub) => tasksBySubsection.set(sub.id, []));
  for (const task of tasks) {
    const bucket = tasksBySubsection.get(task.subsection_id) ?? tasksBySubsection.get(null)!;
    bucket.push(task);
  }

  if (loadingSections) {
    return <div className="p-8 text-zinc-500">Loading sections…</div>;
  }

  if (sectionError) {
    return (
      <div className="p-8 text-red-400">
        Couldn't reach the API — is the backend running on port 8000?
        <div className="text-xs text-zinc-600 mt-2">{sectionError}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Task Dashboard</h1>

      <SectionTabs
        sections={sections}
        activeSectionId={activeSectionId}
        onSelect={setActiveSectionId}
        onCreate={handleCreateSection}
      />

      {sections.length === 0 && (
        <p className="text-zinc-500">
          No sections yet — add one above to get started (e.g. "Jobs", "Music", "Guitar").
        </p>
      )}

      {taskError && <p className="text-red-400 text-sm mb-4">{taskError}</p>}

      {loadingTasks ? (
        <p className="text-zinc-500">Loading tasks…</p>
      ) : (
        activeSection &&
        Array.from(tasksBySubsection.entries()).map(([subId, subTasks]) => {
          // Skip rendering the "Ungrouped" bucket entirely if it's empty
          // and there ARE named subsections — avoids a pointless empty group.
          if (subId === null && subTasks.length === 0 && activeSection.subsections.length > 0) {
            return null;
          }
          const subsection = activeSection.subsections.find((s) => s.id === subId) ?? null;
          return (
            <SubsectionGroup
              key={subId ?? "ungrouped"}
              subsection={subsection}
              tasks={subTasks}
              onStatusChange={updateTaskStatus}
              onToggleSubtask={toggleSubtask}
              onAddTask={(title) => createTask(title, subId)}
              onOpenTask={(task) => setOpenTaskId(task.id)}
            />
          );
        })
      )}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onSave={async (payload) => {
            await updateTask(openTask.id, payload);
          }}
        />
      )}
    </div>
  );
}
