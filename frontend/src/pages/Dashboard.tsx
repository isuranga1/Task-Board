import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
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
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const {
    tasks,
    loading: loadingTasks,
    error: taskError,
    refresh: refreshTasks,
    updateTaskStatus,
    updateTask,
    createTask,
    deleteTask,
    toggleSubtask,
    uploadAttachment,
    deleteAttachment,
    addDependency,
    removeDependency,
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

  async function handleCreateSubsection(name: string) {
    if (activeSectionId === null) return;
    const created = await api.createSubsection(activeSectionId, { name });
    // Immutably update just the active section's subsections array so the
    // new group shows up without needing a full re-fetch of everything.
    setSections((current) =>
      current.map((s) =>
        s.id === activeSectionId ? { ...s, subsections: [...s.subsections, created] } : s
      )
    );
  }

  async function handleDeleteSection(id: number) {
    await api.deleteSection(id);
    setSections((current) => {
      const remaining = current.filter((s) => s.id !== id);
      // If the deleted section was the active one, fall back to whatever's
      // first in the remaining list (or nothing, if that was the last one).
      if (activeSectionId === id) {
        setActiveSectionId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  }

  async function handleDeleteSubsection(subsectionId: number) {
    if (activeSectionId === null) return;
    await api.deleteSubsection(subsectionId);
    // Remove the group from the active section's subsections list...
    setSections((current) =>
      current.map((s) =>
        s.id === activeSectionId
          ? { ...s, subsections: s.subsections.filter((sub) => sub.id !== subsectionId) }
          : s
      )
    );
    // ...and re-fetch tasks, since the backend just set subsection_id to null
    // on every task that was in this group (ON DELETE SET NULL) — the local
    // task objects still hold the old, now-deleted subsection_id until this
    // refresh happens.
    await refreshTasks();
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
    return <p className="text-zinc-500">Loading sections…</p>;
  }

  if (sectionError) {
    return (
      <div className="text-red-400">
        Couldn't reach the API — is the backend running on port 8000?
        <div className="text-xs text-zinc-600 mt-2">{sectionError}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Task Dashboard</h1>

      <SectionTabs
        sections={sections}
        activeSectionId={activeSectionId}
        onSelect={setActiveSectionId}
        onCreate={handleCreateSection}
        onDelete={handleDeleteSection}
      />

      {sections.length === 0 && (
        <p className="text-zinc-500">
          No sections yet — add one above to get started (e.g. "Jobs", "Music", "Guitar").
        </p>
      )}

      {taskError && <p className="text-red-400 text-sm mb-4">{taskError}</p>}

      {activeSection && (
        <div className="mb-4">
          {isAddingGroup ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newGroupName.trim()) return;
                await handleCreateSubsection(newGroupName.trim());
                setNewGroupName("");
                setIsAddingGroup(false);
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onBlur={() => !newGroupName && setIsAddingGroup(false)}
                placeholder="Group name (e.g. Evaluations)"
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
              />
              <button type="submit" className="text-xs text-blue-400">
                Add
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingGroup(true)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <Plus size={12} /> Add group
            </button>
          )}
        </div>
      )}

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
              onDeleteGroup={handleDeleteSubsection}
            />
          );
        })
      )}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          subsections={activeSection?.subsections ?? []}
          sectionTasks={tasks}
          onClose={() => setOpenTaskId(null)}
          onSave={async (payload) => {
            await updateTask(openTask.id, payload);
          }}
          onDelete={async () => {
            await deleteTask(openTask.id);
            setOpenTaskId(null);
          }}
          onUploadAttachment={(file) => uploadAttachment(openTask.id, file).then(() => {})}
          onDeleteAttachment={(filename) =>
            deleteAttachment(openTask.id, filename).then(() => {})
          }
          onAddDependency={(dependsOnId) =>
            addDependency(openTask.id, dependsOnId).then(() => {})
          }
          onRemoveDependency={(dependsOnId) =>
            removeDependency(openTask.id, dependsOnId).then(() => {})
          }
        />
      )}
    </div>
  );
}
